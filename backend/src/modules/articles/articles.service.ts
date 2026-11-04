import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
import { Article } from '../../common/mongo/schemas/article.schema';
import { ArticleVersion } from '../../common/mongo/schemas/article-version.schema';
import { Category } from '../../common/mongo/schemas/category.schema';
import { Tag } from '../../common/mongo/schemas/tag.schema';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { normalizeSlug, toObjectIdOrNull } from '../../common/mongo/object-id';
import { withTransaction } from '../../common/mongo/transaction.helper';
import {
  KnowledgeBasesService,
  type KbAccess,
} from '../knowledge-bases/knowledge-bases.service';
import {
  CreateArticleDto,
  ListArticlesQuery,
  UpdateArticleDto,
} from './dto/articles.dto';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Recursively extracts plain text from a Tiptap JSON doc (server-side fallback). */
export function extractTextFromTiptap(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    return node.map((c) => extractTextFromTiptap(c)).join(' ');
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj['text'] === 'string') parts.push(obj['text']);
    if (Array.isArray(obj['content'])) {
      parts.push(extractTextFromTiptap(obj['content']));
    }
    return parts.join(' ');
  }
  return '';
}

type AttachmentLinkLean = {
  documentId: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
};

type ArticleLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  knowledgeBaseId: Types.ObjectId;
  categoryId: Types.ObjectId | null;
  authorId: Types.ObjectId;
  title: string;
  slug: string;
  summary: string | null;
  contentJson: unknown;
  contentText: string;
  contentHtml: string | null;
  status: string;
  version: number;
  viewCount: number;
  tagIds: Types.ObjectId[];
  attachments: AttachmentLinkLean[];
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Max attachments per article (bounded embedding, D-017). */
export const MAX_ARTICLE_ATTACHMENTS = 20;

/**
 * Articles within one KB. Read: any KB-visible member. Write (create/update):
 * manager/contributor/org-admin. Status transitions + delete: manager/org-admin.
 * Missing KB, foreign KB, and invalid ids all resolve to 404 (no leak).
 * Concurrent edits resolve via optimistic `version` — mismatch yields 409
 * carrying the current document for the conflict dialog.
 */
@Injectable()
export class ArticlesService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Article.name) private readonly articleModel: Model<Article>,
    @InjectModel(ArticleVersion.name) private readonly versionModel: Model<ArticleVersion>,
    @InjectModel(Tag.name) private readonly tagModel: Model<Tag>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    private readonly kbs: KnowledgeBasesService,
  ) {}

  private assertWriter(access: KbAccess): void {
    if (access.role !== 'manager' && access.role !== 'contributor' && access.role !== 'org-admin') {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
  }

  private async findArticle(kbId: Types.ObjectId, articleIdOrSlug: string) {
    const byId = toObjectIdOrNull(articleIdOrSlug);
    if (byId) {
      const doc = await this.articleModel
        .findOne({ _id: byId, knowledgeBaseId: kbId, deletedAt: null })
        .lean();
      if (doc) return doc as unknown as ArticleLean;
    }
    return (await this.articleModel
      .findOne({ slug: articleIdOrSlug, knowledgeBaseId: kbId, deletedAt: null })
      .lean()) as unknown as ArticleLean | null;
  }

  private async resolveTagIds(orgId: Types.ObjectId, tagNames?: string[]): Promise<Types.ObjectId[]> {
    if (!tagNames || tagNames.length === 0) return [];
    const seen = new Map<string, string>();
    for (const raw of tagNames) {
      const name = raw.trim();
      if (!name) continue;
      const slug = normalizeSlug(name);
      if (!seen.has(slug)) seen.set(slug, name);
      if (seen.size >= 20) break;
    }
    const ids: Types.ObjectId[] = [];
    for (const [slug, name] of seen) {
      const tag = (await this.tagModel
        .findOneAndUpdate(
          { organizationId: orgId, slug },
          { $setOnInsert: { organizationId: orgId, name, slug } },
          { new: true, upsert: true },
        )
        .lean()) as unknown as { _id: Types.ObjectId } | null;
      if (tag) ids.push(tag._id);
    }
    return ids;
  }

  private async tagNamesById(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const tags = await this.tagModel.find({ _id: { $in: ids } }).lean();
    for (const t of tags) map.set(t._id.toHexString(), t.name);
    return map;
  }

  private toDto(a: ArticleLean, tagNames: Map<string, string>) {
    return {
      id: a._id.toHexString(),
      knowledgeBaseId: a.knowledgeBaseId.toHexString(),
      categoryId: a.categoryId ? a.categoryId.toHexString() : null,
      authorId: a.authorId.toHexString(),
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      contentJson: a.contentJson,
      contentText: a.contentText,
      status: a.status,
      version: a.version,
      viewCount: a.viewCount,
      tagIds: a.tagIds.map((t) => t.toHexString()),
      tagNames: a.tagIds.map((t) => tagNames.get(t.toHexString()) ?? t.toHexString()),
      attachments: a.attachments.map((l) => ({
        documentId: l.documentId.toHexString(),
        createdBy: l.createdBy.toHexString(),
        createdAt: l.createdAt,
      })),
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private async resolveCategory(
    kbId: Types.ObjectId,
    categoryId?: string | null,
  ): Promise<Types.ObjectId | null | undefined> {
    if (categoryId === undefined) return undefined;
    if (categoryId === null) return null;
    const catId = toObjectIdOrNull(categoryId);
    const cat = catId
      ? await this.categoryModel.findOne({ _id: catId, knowledgeBaseId: kbId }).lean()
      : null;
    if (!cat) throw new NotFoundException('دسته‌بندی یافت نشد');
    return cat._id;
  }

  /** Immutable snapshot row for the given article state (insert-only, never updated). */
  private snapshotOf(a: ArticleLean, createdBy: Types.ObjectId, changelog: string | null) {
    return {
      articleId: a._id,
      version: a.version,
      title: a.title,
      summary: a.summary,
      contentJson: a.contentJson,
      contentText: a.contentText,
      changelog,
      createdBy,
    };
  }

  private async insertSnapshot(
    a: ArticleLean,
    createdBy: Types.ObjectId,
    changelog: string | null,
    session?: ClientSession,
  ): Promise<void> {
    await this.versionModel.create([this.snapshotOf(a, createdBy, changelog)], session ? { session } : undefined);
  }

  /** Read check without side effects (unlike findOne, no viewCount bump). Exported for versions/documents. */
  async requireReadableArticle(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
  ) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const article = await this.findArticle(access.kbId, articleIdOrSlug);
    if (!article) throw new NotFoundException('مقاله یافت نشد');
    return { article, access };
  }

  /** Writer check (manager/contributor/org-admin). Exported for versions/documents. */
  async requireWriterArticle(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
  ) {
    const result = await this.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    this.assertWriter(result.access);
    return result;
  }

  async create(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, dto: CreateArticleDto) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.assertWriter(access);
    const orgObjectId = toObjectIdOrNull(orgId);
    const authorObjectId = toObjectIdOrNull(userId);
    if (!orgObjectId || !authorObjectId) throw new NotFoundException('سازمان یافت نشد');
    if (!dto.contentJson || (dto.contentJson as { type?: unknown }).type !== 'doc') {
      throw new UnprocessableEntityException('ساختار محتوای مقاله معتبر نیست');
    }
    const categoryId = await this.resolveCategory(access.kbId, dto.categoryId);
    const tagIds = await this.resolveTagIds(orgObjectId, dto.tagNames);
    try {
      const created = await this.articleModel.create({
        organizationId: orgObjectId,
        knowledgeBaseId: access.kbId,
        categoryId: categoryId ?? null,
        authorId: authorObjectId,
        title: dto.title,
        slug: normalizeSlug(dto.slug),
        summary: dto.summary ?? null,
        contentJson: dto.contentJson,
        contentText: dto.contentText ?? extractTextFromTiptap(dto.contentJson),
        status: 'draft',
        version: 1,
        viewCount: 0,
        tagIds,
        attachments: [],
        publishedAt: null,
        deletedAt: null,
      });
      const lean = created.toObject() as unknown as ArticleLean;
      return this.toDto(lean, await this.tagNamesById(lean.tagIds));
    } catch (error) {
      throwConflictIfDuplicate(error, 'شناسه مقاله در این پایگاه دانش تکراری است');
      throw error;
    }
  }

  async list(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    query: ListArticlesQuery,
  ) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const orgObjectId = toObjectIdOrNull(orgId);
    const filter: Record<string, unknown> = {
      knowledgeBaseId: access.kbId,
      deletedAt: null,
    };
    if (query.status) filter['status'] = query.status;
    if (query.categoryId) {
      const catId = toObjectIdOrNull(query.categoryId);
      const cat = catId
        ? await this.categoryModel.findOne({ _id: catId, knowledgeBaseId: access.kbId }).lean()
        : null;
      if (!cat) throw new NotFoundException('دسته‌بندی یافت نشد');
      if (query.includeSubtree) {
        const descendants = await this.categoryModel
          .find({
            knowledgeBaseId: access.kbId,
            path: { $regex: `^${escapeRegExp(cat.path)}/` },
          })
          .lean();
        filter['categoryId'] = { $in: [cat._id, ...descendants.map((d) => d._id)] };
      } else {
        filter['categoryId'] = cat._id;
      }
    }
    if (query.tag && orgObjectId) {
      const tag = await this.tagModel
        .findOne({ organizationId: orgObjectId, slug: normalizeSlug(query.tag) })
        .lean();
      if (!tag) return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      filter['tagIds'] = tag._id;
    }
    if (query.search) filter['$text'] = { $search: query.search };
    if (query.authorId) {
      const authorObjectId = toObjectIdOrNull(query.authorId);
      if (!authorObjectId) throw new NotFoundException('مقاله‌ای یافت نشد');
      filter['authorId'] = authorObjectId;
    }
    const sort: { title?: 1; updatedAt?: -1; createdAt?: -1 } =
      query.sort === 'title'
        ? { title: 1 }
        : query.sort === 'updated'
          ? { updatedAt: -1 }
          : { createdAt: -1 };
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.articleModel.countDocuments(filter),
      this.articleModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    const allTagIds = [...new Set((rows as unknown as ArticleLean[]).flatMap((r) => r.tagIds.map((t) => t.toHexString())))].map(
      (hex) => new Types.ObjectId(hex),
    );
    const names = await this.tagNamesById(allTagIds);
    return {
      items: (rows as unknown as ArticleLean[]).map((r) => this.toDto(r, names)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, articleIdOrSlug: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const article = await this.findArticle(access.kbId, articleIdOrSlug);
    if (!article) throw new NotFoundException('مقاله یافت نشد');
    await this.articleModel.updateOne({ _id: article._id }, { $inc: { viewCount: 1 } });
    return this.toDto({ ...article, viewCount: article.viewCount + 1 }, await this.tagNamesById(article.tagIds));
  }

  async update(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    dto: UpdateArticleDto,
  ) {
    const { access } = await this.requireWriterArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    if (dto.contentJson && (dto.contentJson as { type?: unknown }).type !== 'doc') {
      throw new UnprocessableEntityException('ساختار محتوای مقاله معتبر نیست');
    }
    const orgObjectId = toObjectIdOrNull(orgId);
    const actorObjectId = toObjectIdOrNull(userId);
    if (!orgObjectId || !actorObjectId) throw new NotFoundException('سازمان یافت نشد');
    const categoryId = await this.resolveCategory(access.kbId, dto.categoryId);
    const tagIds = dto.tagNames !== undefined ? await this.resolveTagIds(orgObjectId, dto.tagNames) : undefined;
    const articleId = toObjectIdOrNull(articleIdOrSlug);
    const idFilter = articleId
      ? { _id: articleId, knowledgeBaseId: access.kbId, deletedAt: null }
      : { slug: articleIdOrSlug, knowledgeBaseId: access.kbId, deletedAt: null };
    // Snapshot policy (D-019): a named version is stored only when the client
    // sends `changelog` (explicit "save version") — plain autosaves just bump
    // the monotonic counter. Transitions always snapshot (see transition()).
    const updated = await withTransaction(this.connection, async (tx) => {
      const next = (await this.articleModel
        .findOneAndUpdate(
          { ...idFilter, version: dto.version },
          {
            $set: {
              ...(dto.title !== undefined ? { title: dto.title } : {}),
              ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
              ...(dto.contentJson !== undefined ? { contentJson: dto.contentJson } : {}),
              ...(dto.contentText !== undefined
                ? { contentText: dto.contentText }
                : dto.contentJson !== undefined
                  ? { contentText: extractTextFromTiptap(dto.contentJson) }
                  : {}),
              ...(categoryId !== undefined ? { categoryId } : {}),
              ...(tagIds !== undefined ? { tagIds } : {}),
            },
            $inc: { version: 1 },
          },
          { new: true },
        )
        .session(tx)
        .lean()) as unknown as ArticleLean | null;
      if (next && dto.changelog) {
        await this.insertSnapshot(next, actorObjectId, dto.changelog, tx);
      }
      return next;
    });
    if (updated) return this.toDto(updated, await this.tagNamesById(updated.tagIds));
    const current = await this.findArticle(access.kbId, articleIdOrSlug);
    if (!current) throw new NotFoundException('مقاله یافت نشد');
    throw new ConflictException({
      message: 'نسخه مقاله تغییر کرده است؛ لطفاً بازخوانی کنید',
      current: this.toDto(current, await this.tagNamesById(current.tagIds)),
    });
  }

  /** Soft-delete (sets `deletedAt`; row retained for audit). Manager only. */
  async remove(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, articleIdOrSlug: string): Promise<void> {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.kbs.requireManager(access);
    const article = await this.findArticle(access.kbId, articleIdOrSlug);
    if (!article) throw new NotFoundException('مقاله یافت نشد');
    await this.articleModel.updateOne({ _id: article._id }, { $set: { deletedAt: new Date() } });
  }

  private async transition(
    access: KbAccess,
    actorId: string,
    articleIdOrSlug: string,
    from: string[],
    to: string,
    changelog: string,
  ) {
    this.kbs.requireManager(access);
    const actorObjectId = toObjectIdOrNull(actorId);
    if (!actorObjectId) throw new NotFoundException('کاربر یافت نشد');
    const article = await this.findArticle(access.kbId, articleIdOrSlug);
    if (!article) throw new NotFoundException('مقاله یافت نشد');
    return withTransaction(this.connection, (tx) =>
      this.flipStatusInSession({
        kbId: access.kbId,
        articleId: article._id,
        expectedVersion: article.version,
        from,
        to,
        changelog,
        actorId: actorObjectId,
        session: tx,
      }),
    );
  }

  /**
   * Session-aware status flip + immutable snapshot. No permission check —
   * the caller verified access (used by the approval workflow so the article
   * flip, snapshot, review-request write and history row commit atomically).
   * Exported for approval-workflow (direction: approval → articles).
   */
  async flipStatusInSession(input: {
    kbId: Types.ObjectId;
    articleId: Types.ObjectId;
    expectedVersion: number;
    from: string[];
    to: string;
    changelog: string;
    actorId: Types.ObjectId;
    session: ClientSession;
  }) {
    const article = (await this.articleModel
      .findOne({ _id: input.articleId, knowledgeBaseId: input.kbId, deletedAt: null })
      .session(input.session)
      .lean()) as unknown as ArticleLean | null;
    if (!article) throw new NotFoundException('مقاله یافت نشد');
    if (!input.from.includes(article.status)) {
      throw new UnprocessableEntityException(`تغییر وضعیت از «${article.status}» مجاز نیست`);
    }
    const now = new Date();
    const next = (await this.articleModel
      .findOneAndUpdate(
        { _id: article._id, version: input.expectedVersion },
        {
          $set: {
            status: input.to,
            ...(input.to === 'published' ? { publishedAt: now } : {}),
            ...(article.status === 'published' && input.to !== 'published' && input.to !== 'archived'
              ? { publishedAt: null }
              : {}),
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
      .session(input.session)
      .lean()) as unknown as ArticleLean | null;
    if (!next) throw new ConflictException('نسخه مقاله تغییر کرده است؛ لطفاً بازخوانی کنید');
    await this.insertSnapshot(next, input.actorId, input.changelog, input.session);
    return this.toDto(next, await this.tagNamesById(next.tagIds));
  }

  async publish(orgId: string, userId: string, orgRole: string, kb: string, id: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kb);
    return this.transition(access, userId, id, ['draft', 'in_review'], 'published', 'انتشار مقاله');
  }

  async unpublish(orgId: string, userId: string, orgRole: string, kb: string, id: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kb);
    return this.transition(access, userId, id, ['published'], 'draft', 'بازگردانی منتشرشده به پیش‌نویس');
  }

  async archive(orgId: string, userId: string, orgRole: string, kb: string, id: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kb);
    return this.transition(access, userId, id, ['draft', 'in_review', 'published'], 'archived', 'بایگانی مقاله');
  }

  async restore(orgId: string, userId: string, orgRole: string, kb: string, id: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kb);
    return this.transition(access, userId, id, ['archived'], 'draft', 'بازیابی از بایگانی');
  }

  async attachDocument(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    input: { documentId: Types.ObjectId; createdBy: Types.ObjectId },
  ) {
    const { article } = await this.requireWriterArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    if (article.attachments.length >= MAX_ARTICLE_ATTACHMENTS) {
      throw new UnprocessableEntityException(`سقف پیوست مقاله (${MAX_ARTICLE_ATTACHMENTS}) پر شده است`);
    }
    if (article.attachments.some((l) => l.documentId.toHexString() === input.documentId.toHexString())) {
      throw new ConflictException('این فایل قبلاً به مقاله پیوست شده است');
    }
    const updated = (await this.articleModel
      .findOneAndUpdate(
        { _id: article._id },
        { $push: { attachments: { documentId: input.documentId, createdBy: input.createdBy, createdAt: new Date() } } },
        { new: true },
      )
      .lean()) as unknown as ArticleLean | null;
    if (!updated) throw new NotFoundException('مقاله یافت نشد');
    return this.toDto(updated, await this.tagNamesById(updated.tagIds));
  }

  async detachDocument(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    documentId: string,
  ): Promise<void> {
    const { article } = await this.requireWriterArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const docObjectId = toObjectIdOrNull(documentId);
    if (!docObjectId) throw new NotFoundException('پیوست یافت نشد');
    if (!article.attachments.some((l) => l.documentId.toHexString() === docObjectId.toHexString())) {
      throw new NotFoundException('پیوست یافت نشد');
    }
    await this.articleModel.updateOne({ _id: article._id }, { $pull: { attachments: { documentId: docObjectId } } });
  }

  /** Raw attachment links (read permission). Enrichment lives in DocumentsService. */
  async listAttachmentLinks(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
  ) {
    const { article } = await this.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    return article.attachments.map((l) => ({
      documentId: l.documentId.toHexString(),
      createdBy: l.createdBy.toHexString(),
      createdAt: l.createdAt,
    }));
  }

  async related(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, articleIdOrSlug: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const article = await this.findArticle(access.kbId, articleIdOrSlug);
    if (!article) throw new NotFoundException('مقاله یافت نشد');
    const ors: Record<string, unknown>[] = [];
    if (article.categoryId) ors.push({ categoryId: article.categoryId });
    if (article.tagIds.length > 0) ors.push({ tagIds: { $in: article.tagIds } });
    const filter: Record<string, unknown> = {
      knowledgeBaseId: access.kbId,
      deletedAt: null,
      status: 'published',
      _id: { $ne: article._id },
      ...(ors.length > 0 ? { $or: ors } : {}),
    };
    const rows = (await this.articleModel.find(filter).sort({ createdAt: -1 }).limit(5).lean()) as unknown as ArticleLean[];
    const allTagIds = [...new Set(rows.flatMap((r) => r.tagIds.map((t) => t.toHexString())))].map(
      (hex) => new Types.ObjectId(hex),
    );
    const names = await this.tagNamesById(allTagIds);
    return rows.map((r) => this.toDto(r, names));
  }

  async listTags(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const agg = (await this.articleModel.aggregate([
      { $match: { knowledgeBaseId: access.kbId, deletedAt: null } },
      { $unwind: '$tagIds' },
      { $group: { _id: '$tagIds', count: { $sum: 1 } } },
    ])) as unknown as { _id: Types.ObjectId; count: number }[];
    if (agg.length === 0) return [];
    const tags = await this.tagModel.find({ _id: { $in: agg.map((a) => a._id) } }).lean();
    const countBy = new Map(agg.map((a) => [a._id.toHexString(), a.count]));
    return tags.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      slug: t.slug,
      articleCount: countBy.get(t._id.toHexString()) ?? 0,
    }));
  }
}
