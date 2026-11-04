import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ArticleVersion } from '../../common/mongo/schemas/article-version.schema';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { toObjectIdOrNull } from '../../common/mongo/object-id';
import { ArticlesService } from '../articles/articles.service';
import { diffLines } from './diff.util';

type VersionLean = {
  _id: Types.ObjectId;
  articleId: Types.ObjectId;
  version: number;
  title: string;
  summary: string | null;
  contentJson: unknown;
  contentText: string | null;
  changelog: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
};

/**
 * Immutable article history. Snapshots are insert-only (service + test);
 * restore never rewrites history — it creates a NEW article version whose
 * content is copied from the chosen snapshot.
 * Depends on ArticlesService (direction: article-versions → articles).
 */
@Injectable()
export class ArticleVersionsService {
  constructor(
    @InjectModel(ArticleVersion.name) private readonly versionModel: Model<ArticleVersion>,
    private readonly articles: ArticlesService,
  ) {}

  private toListDto(v: VersionLean) {
    return {
      id: v._id.toHexString(),
      articleId: v.articleId.toHexString(),
      version: v.version,
      title: v.title,
      summary: v.summary,
      changelog: v.changelog,
      createdBy: v.createdBy.toHexString(),
      createdAt: v.createdAt,
    };
  }

  private toDto(v: VersionLean) {
    return {
      ...this.toListDto(v),
      contentJson: v.contentJson,
      contentText: v.contentText,
    };
  }

  async list(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, articleIdOrSlug: string) {
    const { article } = await this.articles.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const rows = (await this.versionModel
      .find({ articleId: article._id })
      .sort({ version: 1 })
      .lean()) as unknown as VersionLean[];
    return rows.map((r) => this.toListDto(r));
  }

  async findOne(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    version: number,
  ) {
    const { article } = await this.articles.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const row = (await this.versionModel
      .findOne({ articleId: article._id, version })
      .lean()) as unknown as VersionLean | null;
    if (!row) throw new NotFoundException('نسخه یافت نشد');
    return this.toDto(row);
  }

  /** Explicit "save version" of the current article state (writer). */
  async snapshotCurrent(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    changelog?: string,
  ) {
    const { article } = await this.articles.requireWriterArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const actorObjectId = toObjectIdOrNull(userId);
    if (!actorObjectId) throw new NotFoundException('کاربر یافت نشد');
    try {
      const created = await this.versionModel.create({
        articleId: article._id,
        version: article.version,
        title: article.title,
        summary: article.summary,
        contentJson: article.contentJson,
        contentText: article.contentText,
        changelog: changelog ?? null,
        createdBy: actorObjectId,
      });
      return this.toDto(created.toObject() as unknown as VersionLean);
    } catch (error) {
      throwConflictIfDuplicate(error, 'برای این نسخه قبلاً اسنپشات ثبت شده است');
      throw error;
    }
  }

  /** Restore-as-new-version: copies snapshot content into a fresh article version (writer). */
  async restore(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    version: number,
    changelog?: string,
  ) {
    const { article } = await this.articles.requireWriterArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const snap = (await this.versionModel
      .findOne({ articleId: article._id, version })
      .lean()) as unknown as VersionLean | null;
    if (!snap) throw new NotFoundException('نسخه یافت نشد');
    return this.articles.update(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug, {
      version: article.version,
      title: snap.title,
      summary: snap.summary ?? undefined,
      contentJson: snap.contentJson as Record<string, unknown>,
      contentText: snap.contentText ?? undefined,
      changelog: changelog ?? `بازیابی از نسخه ${version}`,
    });
  }

  async diff(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    articleIdOrSlug: string,
    from: number,
    to: number,
  ) {
    const { article } = await this.articles.requireReadableArticle(orgId, userId, orgRole, kbIdOrSlug, articleIdOrSlug);
    const [a, b] = await Promise.all([
      this.versionModel.findOne({ articleId: article._id, version: from }).lean() as unknown as Promise<VersionLean | null>,
      this.versionModel.findOne({ articleId: article._id, version: to }).lean() as unknown as Promise<VersionLean | null>,
    ]);
    if (!a || !b) throw new NotFoundException('نسخه یافت نشد');
    return {
      from: { version: a.version, title: a.title, changelog: a.changelog, createdAt: a.createdAt },
      to: { version: b.version, title: b.title, changelog: b.changelog, createdAt: b.createdAt },
      titleChanged: a.title !== b.title,
      summaryChanged: (a.summary ?? '') !== (b.summary ?? ''),
      hunks: diffLines(a.contentText ?? '', b.contentText ?? ''),
    };
  }
}
