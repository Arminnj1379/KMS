import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { NOTIFICATIONS_PORT, NotificationsPort } from '../../common/notifications/notifications.port';
import { ReviewRequest } from '../../common/mongo/schemas/review-request.schema';
import { WorkflowHistory } from '../../common/mongo/schemas/workflow-history.schema';
import { toObjectIdOrNull } from '../../common/mongo/object-id';
import { withTransaction } from '../../common/mongo/transaction.helper';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ArticlesService } from '../articles/articles.service';
import { KnowledgeBasesService, type KbAccess } from '../knowledge-bases/knowledge-bases.service';
import { PermissionsService } from '../permissions/permissions.service';
import { DecideReviewDto, InboxQuery, SubmitReviewDto } from './dto/approval.dto';

type ReviewLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  knowledgeBaseId: Types.ObjectId;
  articleId: Types.ObjectId;
  articleTitle: string;
  articleSlug: string;
  kbTitle: string;
  kbSlug: string;
  requesterId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  status: string;
  comment: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type HistoryLean = {
  _id: Types.ObjectId;
  articleId: Types.ObjectId;
  fromStatus: string;
  toStatus: string;
  actorId: Types.ObjectId;
  comment: string | null;
  createdAt: Date;
};

const DECIDABLE = 'درخواست بررسی قبلاً تعیین تکلیف شده است';

/**
 * Review state machine (ARCHITECTURE §7):
 * draft ──submit──► in_review ──approve──► published
 * in_review ──reject──► draft · in_review ──cancel──► draft (requester/manager)
 * Single choke point: illegal transitions throw 422. Every review-driven
 * transition flips the article + snapshots + writes the review row and a
 * workflow_history row in ONE transaction, then notifies via the seam.
 * Depends on ArticlesService, KnowledgeBasesService, PermissionsService
 * (direction: approval → articles → kbs → orgs; permissions is a sink).
 */
@Injectable()
export class ApprovalWorkflowService {
  private readonly logger = new Logger(ApprovalWorkflowService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ReviewRequest.name) private readonly reviewModel: Model<ReviewRequest>,
    @InjectModel(WorkflowHistory.name) private readonly historyModel: Model<WorkflowHistory>,
    private readonly articles: ArticlesService,
    private readonly kbs: KnowledgeBasesService,
    private readonly permissions: PermissionsService,
    @Inject(NOTIFICATIONS_PORT) private readonly notifications: NotificationsPort,
    private readonly audit: AuditLogsService,
  ) {}

  private toDto(r: ReviewLean) {
    return {
      id: r._id.toHexString(),
      organizationId: r.organizationId.toHexString(),
      knowledgeBaseId: r.knowledgeBaseId.toHexString(),
      articleId: r.articleId.toHexString(),
      articleTitle: r.articleTitle,
      articleSlug: r.articleSlug,
      kbTitle: r.kbTitle,
      kbSlug: r.kbSlug,
      requesterId: r.requesterId.toHexString(),
      reviewerId: r.reviewerId.toHexString(),
      status: r.status,
      comment: r.comment,
      decidedAt: r.decidedAt,
      createdAt: r.createdAt,
    };
  }

  private historyDto(h: HistoryLean) {
    return {
      id: h._id.toHexString(),
      articleId: h.articleId.toHexString(),
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorId: h.actorId.toHexString(),
      comment: h.comment,
      createdAt: h.createdAt,
    };
  }

  /** Best-effort post-commit hook (never fails the request). */
  private async safeNotify(input: Parameters<NotificationsPort['notify']>[0]): Promise<void> {
    try {
      await this.notifications.notify(input);
    } catch (error) {
      this.logger.warn(`notification hook failed: ${(error as Error).message}`);
    }
  }

  private cleanComment(comment?: string): string | null {
    const trimmed = comment?.trim();
    return trimmed ? trimmed : null;
  }

  async submit(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    dto: SubmitReviewDto,
  ) {
    const { article, access } = await this.articles.requireWriterArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const actorObjectId = toObjectIdOrNull(userId);
    const reviewerObjectId = toObjectIdOrNull(dto.reviewerId);
    if (!actorObjectId || !reviewerObjectId) throw new NotFoundException('کاربر یافت نشد');
    if (article.status !== 'draft') {
      throw new UnprocessableEntityException('فقط پیش‌نویس قابل ارسال برای بررسی است');
    }
    if (reviewerObjectId.equals(actorObjectId)) {
      throw new UnprocessableEntityException('خودبازبینی مجاز نیست');
    }
    const membership = await this.permissions.membership(dto.reviewerId, orgId);
    if (!membership) throw new UnprocessableEntityException('داور باید عضو سازمان باشد');
    const kbRole = await this.kbs.getMemberRole(access.kbId, reviewerObjectId);
    const reviewerIsAdmin = (membership as { role?: unknown }).role === 'org-admin';
    if (kbRole !== 'reviewer' && kbRole !== 'manager' && !reviewerIsAdmin) {
      throw new UnprocessableEntityException('داور باید عضو پایگاه دانش با نقش بررسی‌کننده یا مدیر باشد');
    }
    const pending = await this.reviewModel.findOne({ articleId: article._id, status: 'pending' }).lean();
    if (pending) throw new ConflictException('درخواست بررسی باز برای این مقاله وجود دارد');
    const kb = await this.kbs.findOne(orgId, userId, orgRole, kbIdOrSlug);
    const comment = this.cleanComment(dto.comment);
    const created = await withTransaction(this.connection, async (tx) => {
      const flipped = await this.articles.flipStatusInSession({
        kbId: access.kbId,
        articleId: article._id,
        expectedVersion: article.version,
        from: ['draft'],
        to: 'in_review',
        changelog: 'ارسال برای بررسی',
        actorId: actorObjectId,
        session: tx,
      });
      const [row] = (await this.reviewModel.create(
        [
          {
            organizationId: article.organizationId,
            knowledgeBaseId: access.kbId,
            articleId: article._id,
            articleTitle: article.title,
            articleSlug: article.slug,
            kbTitle: kb.title,
            kbSlug: kb.slug,
            requesterId: actorObjectId,
            reviewerId: reviewerObjectId,
            status: 'pending',
            comment,
            decidedAt: null,
          },
        ],
        { session: tx },
      )) as unknown as ReviewLean[];
      if (!row) throw new NotFoundException('درخواست بررسی یافت نشد');
      await this.historyModel.create(
        [
          {
            articleId: article._id,
            fromStatus: 'draft',
            toStatus: 'in_review',
            actorId: actorObjectId,
            comment,
          },
        ],
        { session: tx },
      );
      return { flipped, row };
    });
    await this.safeNotify({
      userId: reviewerObjectId.toHexString(),
      type: 'review.submitted',
      title: `درخواست بررسی: ${article.title}`,
      body: comment ?? undefined,
      data: { reviewRequestId: created.row._id.toHexString(), articleId: article._id.toHexString(), kbSlug: kb.slug },
    });
    await this.audit.write({
      organizationId: orgId,
      actorId: userId,
      action: 'review.submitted',
      resourceType: 'review-request',
      resourceId: created.row._id.toHexString(),
      metadata: { articleId: article._id.toHexString(), articleTitle: article.title },
    });
    return { article: created.flipped, reviewRequest: this.toDto(created.row) };
  }

  /** Loads request + its live article; 404 when missing, foreign, or cross-org. */
  private async loadRequest(orgId: string, requestId: string) {
    const requestObjectId = toObjectIdOrNull(requestId);
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!requestObjectId || !orgObjectId) throw new NotFoundException('درخواست بررسی یافت نشد');
    const request = (await this.reviewModel.findOne({ _id: requestObjectId, organizationId: orgObjectId }).lean()) as unknown as ReviewLean | null;
    if (!request) throw new NotFoundException('درخواست بررسی یافت نشد');
    return request;
  }

  private assertPending(request: ReviewLean): void {
    if (request.status !== 'pending') throw new UnprocessableEntityException(DECIDABLE);
  }

  /** Reviewer-or-manager gate for decisions. Returns the KB access. */
  private async requireDecider(
    orgId: string,
    userId: string,
    orgRole: string,
    request: ReviewLean,
  ): Promise<KbAccess> {
    if (request.reviewerId.toHexString() === userId) {
      return this.kbs.requireAccess(orgId, userId, orgRole, request.knowledgeBaseId.toHexString());
    }
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, request.knowledgeBaseId.toHexString());
    this.kbs.requireManager(access);
    return access;
  }

  async decide(
    orgId: string,
    userId: string,
    orgRole: string,
    requestId: string,
    action: 'approve' | 'reject',
    dto: DecideReviewDto,
  ) {
    const request = await this.loadRequest(orgId, requestId);
    this.assertPending(request);
    const access = await this.requireDecider(orgId, userId, orgRole, request);
    const { article } = await this.articles.requireReadableArticle(
      orgId,
      userId,
      orgRole,
      access.kbId.toHexString(),
      request.articleId.toHexString(),
    );
    if (article.status !== 'in_review') {
      throw new UnprocessableEntityException('مقاله در وضعیت بررسی نیست');
    }
    const actorObjectId = toObjectIdOrNull(userId);
    if (!actorObjectId) throw new NotFoundException('کاربر یافت نشد');
    const comment = this.cleanComment(dto.comment);
    const to = action === 'approve' ? 'published' : 'draft';
    const changelog = action === 'approve' ? 'تأیید بررسی و انتشار' : 'بازگردانی پس از بررسی';
    const decided = await withTransaction(this.connection, async (tx) => {
      const flipped = await this.articles.flipStatusInSession({
        kbId: access.kbId,
        articleId: article._id,
        expectedVersion: article.version,
        from: ['in_review'],
        to,
        changelog,
        actorId: actorObjectId,
        session: tx,
      });
      const next = (await this.reviewModel
        .findOneAndUpdate(
          { _id: request._id, status: 'pending' },
          { $set: { status: action === 'approve' ? 'approved' : 'rejected', decidedAt: new Date(), ...(comment !== null ? { comment } : {}) } },
          { new: true },
        )
        .session(tx)
        .lean()) as unknown as ReviewLean | null;
      if (!next) throw new UnprocessableEntityException(DECIDABLE);
      await this.historyModel.create(
        [{ articleId: article._id, fromStatus: 'in_review', toStatus: to, actorId: actorObjectId, comment }],
        { session: tx },
      );
      return { flipped, next };
    });
    await this.safeNotify({
      userId: request.requesterId.toHexString(),
      type: action === 'approve' ? 'review.approved' : 'review.rejected',
      title: action === 'approve' ? `بررسی تأیید شد: ${request.articleTitle}` : `بررسی رد شد: ${request.articleTitle}`,
      body: comment ?? undefined,
      data: { reviewRequestId: request._id.toHexString(), articleId: request.articleId.toHexString() },
    });
    await this.audit.write({
      organizationId: orgId,
      actorId: userId,
      action: action === 'approve' ? 'review.approved' : 'review.rejected',
      resourceType: 'review-request',
      resourceId: request._id.toHexString(),
      metadata: { articleId: request.articleId.toHexString(), articleTitle: request.articleTitle },
    });
    return { article: decided.flipped, reviewRequest: this.toDto(decided.next) };
  }

  async cancel(orgId: string, userId: string, orgRole: string, requestId: string) {
    const request = await this.loadRequest(orgId, requestId);
    this.assertPending(request);
    if (request.requesterId.toHexString() !== userId) {
      const access = await this.kbs.requireAccess(orgId, userId, orgRole, request.knowledgeBaseId.toHexString());
      this.kbs.requireManager(access);
    }
    const reader = await this.articles.requireReadableArticle(
      orgId,
      userId,
      orgRole,
      request.knowledgeBaseId.toHexString(),
      request.articleId.toHexString(),
    );
    if (reader.article.status !== 'in_review') {
      throw new UnprocessableEntityException('مقاله در وضعیت بررسی نیست');
    }
    const actorObjectId = toObjectIdOrNull(userId);
    if (!actorObjectId) throw new NotFoundException('کاربر یافت نشد');
    const cancelled = await withTransaction(this.connection, async (tx) => {
      const flipped = await this.articles.flipStatusInSession({
        kbId: reader.access.kbId,
        articleId: reader.article._id,
        expectedVersion: reader.article.version,
        from: ['in_review'],
        to: 'draft',
        changelog: 'لغو درخواست بررسی',
        actorId: actorObjectId,
        session: tx,
      });
      const next = (await this.reviewModel
        .findOneAndUpdate(
          { _id: request._id, status: 'pending' },
          { $set: { status: 'cancelled', decidedAt: new Date() } },
          { new: true },
        )
        .session(tx)
        .lean()) as unknown as ReviewLean | null;
      if (!next) throw new UnprocessableEntityException(DECIDABLE);
      await this.historyModel.create(
        [{ articleId: reader.article._id, fromStatus: 'in_review', toStatus: 'draft', actorId: actorObjectId, comment: null }],
        { session: tx },
      );
      return { flipped, next };
    });
    await this.safeNotify({
      userId: request.reviewerId.toHexString(),
      type: 'review.cancelled',
      title: `درخواست بررسی لغو شد: ${request.articleTitle}`,
      data: { reviewRequestId: request._id.toHexString(), articleId: request.articleId.toHexString() },
    });
    await this.audit.write({
      organizationId: orgId,
      actorId: userId,
      action: 'review.cancelled',
      resourceType: 'review-request',
      resourceId: request._id.toHexString(),
      metadata: { articleId: request.articleId.toHexString(), articleTitle: request.articleTitle },
    });
    return { article: cancelled.flipped, reviewRequest: this.toDto(cancelled.next) };
  }

  async findOne(orgId: string, userId: string, orgRole: string, requestId: string) {
    const request = await this.loadRequest(orgId, requestId);
    const isParty = request.requesterId.toHexString() === userId || request.reviewerId.toHexString() === userId;
    if (!isParty) {
      const access = await this.kbs.requireAccess(orgId, userId, orgRole, request.knowledgeBaseId.toHexString());
      this.kbs.requireManager(access);
    }
    return this.toDto(request);
  }

  async listForArticle(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, articleIdOrSlug: string) {
    const { article } = await this.articles.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const rows = (await this.reviewModel
      .find({ articleId: article._id })
      .sort({ createdAt: -1 })
      .lean()) as unknown as ReviewLean[];
    return rows.map((r) => this.toDto(r));
  }

  async historyForArticle(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, articleIdOrSlug: string) {
    const { article } = await this.articles.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const rows = (await this.historyModel
      .find({ articleId: article._id })
      .sort({ createdAt: 1 })
      .lean()) as unknown as HistoryLean[];
    return rows.map((h) => this.historyDto(h));
  }

  async inbox(orgId: string, userId: string, query: InboxQuery) {
    const meObjectId = toObjectIdOrNull(userId);
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!meObjectId || !orgObjectId) throw new NotFoundException('کاربر یافت نشد');
    const filter: Record<string, unknown> = {
      organizationId: orgObjectId,
      ...(query.role === 'reviewer' ? { reviewerId: meObjectId } : { requesterId: meObjectId }),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.reviewModel.countDocuments(filter),
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    return {
      items: (rows as unknown as ReviewLean[]).map((r) => this.toDto(r)),
      total,
      page,
      pageSize,
    };
  }
}
