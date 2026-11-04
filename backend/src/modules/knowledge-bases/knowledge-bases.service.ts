import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { Article } from '../../common/mongo/schemas/article.schema';
import { ArticleVersion } from '../../common/mongo/schemas/article-version.schema';
import { Category } from '../../common/mongo/schemas/category.schema';
import { KbMember } from '../../common/mongo/schemas/kb-member.schema';
import { KnowledgeBase } from '../../common/mongo/schemas/knowledge-base.schema';
import { Membership } from '../../common/mongo/schemas/membership.schema';
import { User } from '../../common/mongo/schemas/user.schema';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { normalizeEmail, normalizeSlug, toObjectIdOrNull } from '../../common/mongo/object-id';
import { withTransaction } from '../../common/mongo/transaction.helper';
import {
  AddKbMemberDto,
  CreateKnowledgeBaseDto,
  UpdateKbMemberDto,
  UpdateKnowledgeBaseDto,
  type KbRoleName,
} from './dto/knowledge-bases.dto';

export type KbRole = KbRoleName | 'org-admin';

export interface KbAccess {
  kbId: Types.ObjectId;
  role: KbRole | null;
  isOrgAdmin: boolean;
}

/**
 * Knowledge bases + KB membership. All reads/writes are org-scoped via the
 * caller's orgId (from JWT). Missing KB and forbidden KB both resolve to 404
 * (no existence leak); management actions require manager/org-admin (403).
 * Exported for CategoriesService (direction: categories → knowledge-bases).
 */
@Injectable()
export class KnowledgeBasesService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(KnowledgeBase.name) private readonly kbModel: Model<KnowledgeBase>,
    @InjectModel(KbMember.name) private readonly kbMemberModel: Model<KbMember>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(Article.name) private readonly articleModel: Model<Article>,
    @InjectModel(ArticleVersion.name) private readonly articleVersionModel: Model<ArticleVersion>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
  ) {}

  /** Finds the KB by id-or-slug within the org; null when absent. */
  private async findKb(orgId: Types.ObjectId, kbIdOrSlug: string) {
    const byId = toObjectIdOrNull(kbIdOrSlug);
    if (byId) {
      const kb = await this.kbModel.findOne({ _id: byId, organizationId: orgId }).lean();
      if (kb) return kb;
    }
    return this.kbModel.findOne({ slug: kbIdOrSlug, organizationId: orgId }).lean();
  }

  /** Resolves the caller's effective role: org-admin bypasses, else KB membership. */
  async resolveAccess(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string): Promise<KbAccess | null> {
    const orgObjectId = toObjectIdOrNull(orgId);
    const userObjectId = toObjectIdOrNull(userId);
    if (!orgObjectId || !userObjectId) return null;
    const kb = await this.findKb(orgObjectId, kbIdOrSlug);
    if (!kb) return null;
    if (orgRole === 'org-admin') return { kbId: kb._id, role: 'org-admin', isOrgAdmin: true };
    const member = await this.kbMemberModel.findOne({ knowledgeBaseId: kb._id, userId: userObjectId }).lean();
    if (!member) {
      // internal/public KBs are visible to every org member (read-only).
      if (kb.visibility === 'internal' || kb.visibility === 'public') {
        return { kbId: kb._id, role: null, isOrgAdmin: false };
      }
      return null;
    }
    return { kbId: kb._id, role: member.role as KbRoleName, isOrgAdmin: false };
  }

  /** 404 for missing-or-forbidden (no leak). Exported for categories. */
  async requireAccess(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string): Promise<KbAccess> {
    const access = await this.resolveAccess(orgId, userId, orgRole, kbIdOrSlug);
    if (!access) throw new NotFoundException('پایگاه دانش یافت نشد');
    return access;
  }

  /** Manager or org-admin. Exported for categories. */
  requireManager(access: KbAccess): void {
    if (access.role !== 'manager' && access.role !== 'org-admin') {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
  }

  private async kbDto(kb: {
    _id: Types.ObjectId;
    title: string;
    slug: string;
    description: string | null;
    icon: string | null;
    visibility: string;
    ownerId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const [memberCount, categoryCount] = await Promise.all([
      this.kbMemberModel.countDocuments({ knowledgeBaseId: kb._id }),
      this.categoryModel.countDocuments({ knowledgeBaseId: kb._id }),
    ]);
    return {
      id: kb._id.toHexString(),
      title: kb.title,
      slug: kb.slug,
      description: kb.description,
      icon: kb.icon,
      visibility: kb.visibility,
      ownerId: kb.ownerId.toHexString(),
      memberCount,
      categoryCount,
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    };
  }

  async create(orgId: string, ownerId: string, dto: CreateKnowledgeBaseDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    const ownerObjectId = toObjectIdOrNull(ownerId);
    if (!orgObjectId || !ownerObjectId) throw new NotFoundException('سازمان یافت نشد');
    const slug = normalizeSlug(dto.slug);
    try {
      const kbId = await withTransaction(this.connection, async (tx) => {
        const [kb] = await this.kbModel.create(
          [
            {
              organizationId: orgObjectId,
              title: dto.title,
              slug,
              description: dto.description ?? null,
              icon: dto.icon ?? null,
              visibility: dto.visibility ?? 'internal',
              ownerId: ownerObjectId,
            },
          ],
          { session: tx },
        );
        if (!kb) throw new ConflictException('امکان ساخت پایگاه دانش وجود ندارد');
        await this.kbMemberModel.create(
          [{ knowledgeBaseId: kb._id, userId: ownerObjectId, role: 'manager' }],
          { session: tx },
        );
        return kb._id;
      });
      const kb = await this.kbModel.findById(kbId).lean();
      if (!kb) throw new NotFoundException('پایگاه دانش یافت نشد');
      return { ...(await this.kbDto(kb)), role: 'manager' as KbRole };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throwConflictIfDuplicate(error, 'شناسه پایگاه دانش در این سازمان تکراری است');
      throw error;
    }
  }

  async list(orgId: string, userId: string, orgRole: string) {
    const orgObjectId = toObjectIdOrNull(orgId);
    const userObjectId = toObjectIdOrNull(userId);
    if (!orgObjectId || !userObjectId) return [];
    const kbs = await this.kbModel.find({ organizationId: orgObjectId }).sort({ updatedAt: -1 }).lean();
    const isOrgAdmin = orgRole === 'org-admin';
    const memberships = isOrgAdmin
      ? []
      : await this.kbMemberModel.find({ userId: userObjectId }).lean();
    const roleByKb = new Map(memberships.map((m) => [m.knowledgeBaseId.toHexString(), m.role as KbRoleName]));
    const rows = [];
    for (const kb of kbs) {
      const role = isOrgAdmin ? ('org-admin' as const) : roleByKb.get(kb._id.toHexString()) ?? null;
      if (!isOrgAdmin && role === null && kb.visibility === 'private') continue;
      rows.push({ ...(await this.kbDto(kb)), role });
    }
    return rows;
  }

  async findOne(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string) {
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const kb = await this.kbModel.findById(access.kbId).lean();
    if (!kb) throw new NotFoundException('پایگاه دانش یافت نشد');
    return { ...(await this.kbDto(kb)), role: access.role };
  }

  async update(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, dto: UpdateKnowledgeBaseDto) {
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.requireManager(access);
    const kb = await this.kbModel
      .findByIdAndUpdate(
        access.kbId,
        {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        },
        { new: true },
      )
      .lean();
    if (!kb) throw new NotFoundException('پایگاه دانش یافت نشد');
    return { ...(await this.kbDto(kb)), role: access.role };
  }

  /**
   * Deletes a KB with its members + categories + articles + versions in one
   * transaction. Documents are org-owned and always retained.
   */
  async remove(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, confirm?: string): Promise<void> {
    if (confirm !== 'true') {
      throw new UnprocessableEntityException('برای حذف پایگاه دانش، confirm=true الزامی است');
    }
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.requireManager(access);
    await withTransaction(this.connection, async (tx) => {
      const articleIds = await this.articleModel
        .find({ knowledgeBaseId: access.kbId }, { _id: 1 })
        .session(tx)
        .lean();
      const ids = articleIds.map((a) => a._id);
      if (ids.length > 0) {
        await this.articleVersionModel.deleteMany({ articleId: { $in: ids } }, { session: tx });
      }
      await this.articleModel.deleteMany({ knowledgeBaseId: access.kbId }, { session: tx });
      await this.kbMemberModel.deleteMany({ knowledgeBaseId: access.kbId }, { session: tx });
      await this.categoryModel.deleteMany({ knowledgeBaseId: access.kbId }, { session: tx });
      await this.kbModel.deleteOne({ _id: access.kbId }, { session: tx });
    });
  }

  // ---------- Members ----------

  async listMembers(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string) {
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const rows = await this.kbMemberModel.find({ knowledgeBaseId: access.kbId }).sort({ createdAt: 1 }).lean();
    const result = [];
    for (const m of rows) {
      const user = await this.userModel.findById(m.userId).lean();
      if (!user) continue;
      result.push({
        userId: user._id.toHexString(),
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        role: m.role,
        memberSince: m.createdAt,
      });
    }
    return result;
  }

  /** Attaches an existing org member. The user must already belong to the org. */
  async addMember(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, dto: AddKbMemberDto) {
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.requireManager(access);
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    const user = await this.userModel.findOne({ email: normalizeEmail(dto.email) }).lean();
    if (!user) throw new NotFoundException('کاربری با این ایمیل یافت نشد');
    const orgMembership = await this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: user._id })
      .lean();
    if (!orgMembership) throw new NotFoundException('کاربر عضو این سازمان نیست');
    const dup = await this.kbMemberModel
      .findOne({ knowledgeBaseId: access.kbId, userId: user._id })
      .lean();
    if (dup) throw new ConflictException('این کاربر قبلاً عضو پایگاه دانش است');
    try {
      const created = await this.kbMemberModel.create({
        knowledgeBaseId: access.kbId,
        userId: user._id,
        role: dto.role,
      });
      return {
        userId: user._id.toHexString(),
        email: user.email,
        fullName: user.fullName,
        role: created.role,
      };
    } catch (error) {
      throwConflictIfDuplicate(error, 'این کاربر قبلاً عضو پایگاه دانش است');
      throw error;
    }
  }

  async updateMemberRole(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    targetId: string,
    dto: UpdateKbMemberDto,
  ) {
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.requireManager(access);
    const targetObjectId = toObjectIdOrNull(targetId);
    if (!targetObjectId) throw new NotFoundException('عضو یافت نشد');
    const updated = await this.kbMemberModel
      .findOneAndUpdate(
        { knowledgeBaseId: access.kbId, userId: targetObjectId },
        { role: dto.role },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException('عضو یافت نشد');
    return { userId: targetId, role: updated.role };
  }

  async removeMember(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, targetId: string): Promise<void> {
    const access = await this.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.requireManager(access);
    const targetObjectId = toObjectIdOrNull(targetId);
    if (!targetObjectId) throw new NotFoundException('عضو یافت نشد');
    const removed = await this.kbMemberModel.findOneAndDelete({
      knowledgeBaseId: access.kbId,
      userId: targetObjectId,
    });
    if (!removed) throw new NotFoundException('عضو یافت نشد');
  }
}
