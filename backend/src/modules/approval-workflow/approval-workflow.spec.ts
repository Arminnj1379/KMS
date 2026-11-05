import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { Model, Types } from 'mongoose';
import type { ReviewRequest } from '../../common/mongo/schemas/review-request.schema';
import type { WorkflowHistory } from '../../common/mongo/schemas/workflow-history.schema';
import { ApprovalWorkflowService } from './approval-workflow.service';
import type { ArticlesService } from '../articles/articles.service';
import type { KnowledgeBasesService } from '../knowledge-bases/knowledge-bases.service';
import type { PermissionsService } from '../permissions/permissions.service';
import type { NotificationsPort } from '../../common/notifications/notifications.port';

const ORG = '000000000000000000000010';
const ALI = '0000000000000000000000a1';
const SARA = '0000000000000000000000b2';
const REZA = '0000000000000000000000c3';
const KB = '0000000000000000000000c1';
const AID = '0000000000000000000000d1';
const RID = '0000000000000000000000e1';

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

// SAFETY: test-only stub of Mongoose's chainable Query API.
interface ChainStub<T> {
  lean: jest.Mock<Promise<T>>;
  sort: jest.Mock<ChainStub<T>>;
  skip: jest.Mock<ChainStub<T>>;
  limit: jest.Mock<ChainStub<T>>;
  session: jest.Mock<ChainStub<T>>;
}

function q<T>(value: T): ChainStub<T> {
  const stub = {} as ChainStub<T>;
  stub.lean = jest.fn().mockResolvedValue(value);
  stub.sort = jest.fn().mockReturnValue(stub);
  stub.skip = jest.fn().mockReturnValue(stub);
  stub.limit = jest.fn().mockReturnValue(stub);
  stub.session = jest.fn().mockReturnValue(stub);
  return stub;
}

function makeModelMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
  };
}

type ModelMock = ReturnType<typeof makeModelMock>;

function makeTx() {
  return {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
      endSession: jest.fn(),
    }),
  } as unknown as Connection;
}

const articleDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: oid(AID),
  organizationId: oid(ORG),
  knowledgeBaseId: oid(KB),
  title: 'A',
  slug: 'a',
  status: 'draft',
  version: 2,
  ...overrides,
});

const requestDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: oid(RID),
  organizationId: oid(ORG),
  knowledgeBaseId: oid(KB),
  articleId: oid(AID),
  articleTitle: 'A',
  articleSlug: 'a',
  kbTitle: 'KB',
  kbSlug: 'kb',
  requesterId: oid(ALI),
  reviewerId: oid(SARA),
  status: 'pending',
  comment: null,
  decidedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

interface Deps {
  svc: ApprovalWorkflowService;
  reviews: ModelMock;
  history: ModelMock;
  articles: {
    requireWriterArticle: jest.Mock;
    requireReadableArticle: jest.Mock;
    flipStatusInSession: jest.Mock;
  };
  kbs: {
    requireAccess: jest.Mock;
    requireManager: jest.Mock;
    getMemberRole: jest.Mock;
    findOne: jest.Mock;
  };
  permissions: { membership: jest.Mock };
  notifications: { notify: jest.Mock };
}

function makeDeps(): Deps {
  const reviews = makeModelMock();
  const history = makeModelMock();
  const article = articleDoc();
  const articles = {
    requireWriterArticle: jest.fn().mockResolvedValue({ article, access: { kbId: oid(KB), role: 'contributor' } }),
    requireReadableArticle: jest.fn().mockResolvedValue({ article, access: { kbId: oid(KB), role: 'contributor' } }),
    flipStatusInSession: jest.fn().mockImplementation(async (input: { to: string }) => ({ id: AID, status: input.to })),
  };
  const kbs = {
    requireAccess: jest.fn().mockResolvedValue({ kbId: oid(KB), role: 'contributor', isOrgAdmin: false }),
    requireManager: jest.fn().mockImplementation((access: { role: string | null }) => {
      if (access.role !== 'manager' && access.role !== 'org-admin') {
        throw new ForbiddenException('دسترسی غیرمجاز');
      }
    }),
    getMemberRole: jest.fn().mockResolvedValue('reviewer'),
    findOne: jest.fn().mockResolvedValue({ title: 'KB', slug: 'kb' }),
  };
  const permissions = { membership: jest.fn().mockResolvedValue({ role: 'member' }) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const svc = new ApprovalWorkflowService(
    makeTx(),
    reviews as unknown as Model<ReviewRequest>,
    history as unknown as Model<WorkflowHistory>,
    articles as unknown as ArticlesService,
    kbs as unknown as KnowledgeBasesService,
    permissions as unknown as PermissionsService,
    notifications as unknown as NotificationsPort,
    audit as unknown as import('../audit-logs/audit-logs.service').AuditLogsService,
  );
  return { svc, reviews, history, articles, kbs, permissions, notifications };
}

describe('ApprovalWorkflowService', () => {
  it('reader cannot submit (403)', async () => {
    const d = makeDeps();
    d.articles.requireWriterArticle.mockRejectedValue(new ForbiddenException('دسترسی غیرمجاز'));
    await expect(d.svc.submit(ORG, SARA, 'member', 'kb', 'a', { reviewerId: ALI })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(d.reviews.create).not.toHaveBeenCalled();
  });

  it('submit requires draft (422)', async () => {
    const d = makeDeps();
    d.articles.requireWriterArticle.mockResolvedValue({
      article: articleDoc({ status: 'published' }),
      access: { kbId: oid(KB), role: 'contributor' },
    });
    await expect(d.svc.submit(ORG, ALI, 'member', 'kb', 'a', { reviewerId: SARA })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('self-review is rejected (422)', async () => {
    const d = makeDeps();
    await expect(d.svc.submit(ORG, ALI, 'member', 'kb', 'a', { reviewerId: ALI })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('reviewer outside the org is rejected (422)', async () => {
    const d = makeDeps();
    d.permissions.membership.mockResolvedValue(null);
    await expect(d.svc.submit(ORG, ALI, 'member', 'kb', 'a', { reviewerId: SARA })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('reviewer without reviewer/manager KB role is rejected (422)', async () => {
    const d = makeDeps();
    d.kbs.getMemberRole.mockResolvedValue('contributor');
    await expect(d.svc.submit(ORG, ALI, 'member', 'kb', 'a', { reviewerId: SARA })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('duplicate pending request maps to 409', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    await expect(d.svc.submit(ORG, ALI, 'member', 'kb', 'a', { reviewerId: SARA })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('submit flips to in_review + writes request/history + notifies reviewer', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(null));
    d.reviews.create.mockResolvedValue([requestDoc()]);
    d.history.create.mockResolvedValue([]);
    const res = await d.svc.submit(ORG, ALI, 'member', 'kb', 'a', { reviewerId: SARA, comment: 'لطفاً بررسی کن' });
    expect(d.articles.flipStatusInSession).toHaveBeenCalledWith(
      expect.objectContaining({ from: ['draft'], to: 'in_review' }),
    );
    expect(d.reviews.create).toHaveBeenCalledTimes(1);
    expect(d.history.create).toHaveBeenCalledTimes(1);
    expect(d.notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: SARA, type: 'review.submitted' }),
    );
    expect(res.reviewRequest.status).toBe('pending');
  });

  it('non-reviewer contributor cannot approve (403)', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    // REZA is a plain contributor, neither reviewer nor manager.
    await expect(d.svc.decide(ORG, REZA, 'member', RID, 'approve', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(d.articles.flipStatusInSession).not.toHaveBeenCalled();
  });

  it('decide on a settled request maps to 422', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc({ status: 'approved' })));
    await expect(d.svc.decide(ORG, SARA, 'member', RID, 'approve', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('approve requires the article to be in_review (422)', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    d.articles.requireReadableArticle.mockResolvedValue({
      article: articleDoc({ status: 'draft' }),
      access: { kbId: oid(KB), role: 'reviewer' },
    });
    await expect(d.svc.decide(ORG, SARA, 'member', RID, 'approve', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('approve publishes + records history + notifies requester', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    d.articles.requireReadableArticle.mockResolvedValue({
      article: articleDoc({ status: 'in_review' }),
      access: { kbId: oid(KB), role: 'reviewer' },
    });
    d.reviews.findOneAndUpdate.mockReturnValue(q(requestDoc({ status: 'approved' })));
    d.history.create.mockResolvedValue([]);
    const res = await d.svc.decide(ORG, SARA, 'member', RID, 'approve', { comment: 'خوب است' });
    expect(d.articles.flipStatusInSession).toHaveBeenCalledWith(
      expect.objectContaining({ from: ['in_review'], to: 'published' }),
    );
    expect(d.history.create).toHaveBeenCalledTimes(1);
    expect(d.notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ALI, type: 'review.approved' }),
    );
    expect(res.reviewRequest.status).toBe('approved');
  });

  it('reject returns the article to draft', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    d.articles.requireReadableArticle.mockResolvedValue({
      article: articleDoc({ status: 'in_review' }),
      access: { kbId: oid(KB), role: 'reviewer' },
    });
    d.reviews.findOneAndUpdate.mockReturnValue(q(requestDoc({ status: 'rejected' })));
    d.history.create.mockResolvedValue([]);
    const res = await d.svc.decide(ORG, SARA, 'member', RID, 'reject', {});
    expect(d.articles.flipStatusInSession).toHaveBeenCalledWith(
      expect.objectContaining({ from: ['in_review'], to: 'draft' }),
    );
    expect(res.reviewRequest.status).toBe('rejected');
  });

  it('stranger cannot cancel (403)', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    await expect(d.svc.cancel(ORG, REZA, 'member', RID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requester cancel returns to draft + notifies reviewer', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    d.articles.requireReadableArticle.mockResolvedValue({
      article: articleDoc({ status: 'in_review' }),
      access: { kbId: oid(KB), role: 'contributor' },
    });
    d.reviews.findOneAndUpdate.mockReturnValue(q(requestDoc({ status: 'cancelled' })));
    d.history.create.mockResolvedValue([]);
    const res = await d.svc.cancel(ORG, ALI, 'member', RID);
    expect(d.articles.flipStatusInSession).toHaveBeenCalledWith(
      expect.objectContaining({ from: ['in_review'], to: 'draft' }),
    );
    expect(d.notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: SARA, type: 'review.cancelled' }),
    );
    expect(res.reviewRequest.status).toBe('cancelled');
  });

  it('stranger cannot read a request (403)', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(requestDoc()));
    await expect(d.svc.findOne(ORG, REZA, 'member', RID)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('missing request maps to 404', async () => {
    const d = makeDeps();
    d.reviews.findOne.mockReturnValue(q(null));
    await expect(d.svc.findOne(ORG, ALI, 'member', RID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(d.svc.decide(ORG, SARA, 'member', RID, 'approve', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
