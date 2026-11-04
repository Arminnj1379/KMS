import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
import { Article } from '../../common/mongo/schemas/article.schema';
import { Category } from '../../common/mongo/schemas/category.schema';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { toObjectIdOrNull } from '../../common/mongo/object-id';
import { withTransaction } from '../../common/mongo/transaction.helper';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/knowledge-bases.dto';

export interface CategoryNode {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  path: string;
  depth: number;
  position: number;
  children: CategoryNode[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * KB-scoped category tree. Mirrors department rules: materialized path,
 * cycle-safe moves, non-empty delete guard. Any KB member with read access
 * sees the tree; only manager/org-admin mutates.
 */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(Article.name) private readonly articleModel: Model<Article>,
    private readonly kbs: KnowledgeBasesService,
  ) {}

  async listTree(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string): Promise<CategoryNode[]> {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    const rows = await this.categoryModel
      .find({ knowledgeBaseId: access.kbId })
      .sort({ path: 1 })
      .lean();
    const byId = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];
    for (const c of rows) {
      byId.set(c._id.toHexString(), {
        id: c._id.toHexString(),
        title: c.title,
        slug: c.slug,
        description: c.description,
        parentId: c.parentId ? c.parentId.toHexString() : null,
        path: c.path,
        depth: c.depth,
        position: c.position,
        children: [],
      });
    }
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        const parent = byId.get(node.parentId);
        if (parent) parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async create(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, dto: CreateCategoryDto) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.kbs.requireManager(access);
    let parent: { _id: Types.ObjectId; path: string; depth: number } | null = null;
    if (dto.parentId) {
      const parentId = toObjectIdOrNull(dto.parentId);
      parent = parentId
        ? await this.categoryModel.findOne({ _id: parentId, knowledgeBaseId: access.kbId }).lean()
        : null;
      if (!parent) throw new NotFoundException('دسته‌بندی والد یافت نشد');
    }
    try {
      const created = await this.categoryModel.create({
        knowledgeBaseId: access.kbId,
        parentId: parent?._id ?? null,
        title: dto.title,
        slug: dto.slug,
        description: dto.description ?? null,
        path: parent ? `${parent.path}/${dto.slug}` : `/${dto.slug}`,
        depth: parent ? parent.depth + 1 : 0,
      });
      return this.toDto(created.toObject());
    } catch (error) {
      throwConflictIfDuplicate(error, 'شناسه دسته‌بندی در این پایگاه دانش تکراری است');
      throw error;
    }
  }

  async update(
    orgId: string,
    userId: string,
    orgRole: string,
    kbIdOrSlug: string,
    id: string,
    dto: UpdateCategoryDto,
  ) {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.kbs.requireManager(access);
    const nodeId = toObjectIdOrNull(id);
    if (!nodeId) throw new NotFoundException('دسته‌بندی یافت نشد');
    const node = await this.categoryModel
      .findOne({ _id: nodeId, knowledgeBaseId: access.kbId })
      .lean();
    if (!node) throw new NotFoundException('دسته‌بندی یافت نشد');

    let parent: { _id: Types.ObjectId; path: string; depth: number } | null = null;
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new UnprocessableEntityException('دسته‌بندی نمی‌تواند والد خودش باشد');
      if (dto.parentId !== null) {
        const parentId = toObjectIdOrNull(dto.parentId);
        parent = parentId
          ? await this.categoryModel.findOne({ _id: parentId, knowledgeBaseId: access.kbId }).lean()
          : null;
        if (!parent) throw new NotFoundException('دسته‌بندی والد یافت نشد');
        const ownPrefix = `${node.path}/`;
        if (parent.path === node.path || parent.path.startsWith(ownPrefix)) {
          throw new UnprocessableEntityException('انتقال به زیرمجموعه خودش مجاز نیست');
        }
      }
    } else if (node.parentId) {
      parent = await this.categoryModel.findById(node.parentId).lean();
    }

    const newPath = parent ? `${parent.path}/${node.slug}` : `/${node.slug}`;
    const newDepth = parent ? parent.depth + 1 : 0;

    return withTransaction(this.connection, async (tx) => {
      const updated = await this.categoryModel
        .findByIdAndUpdate(
          nodeId,
          {
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.parentId !== undefined
              ? { parentId: dto.parentId ? toObjectIdOrNull(dto.parentId) : null }
              : {}),
            path: newPath,
            depth: newDepth,
          },
          { new: true, session: tx },
        )
        .lean();
      if (!updated) throw new NotFoundException('دسته‌بندی یافت نشد');
      if (newPath !== node.path) {
        await this.rewriteSubtreePaths(access.kbId, node.path, newPath, newDepth, tx);
      }
      return this.toDto(updated);
    });
  }

  private async rewriteSubtreePaths(
    kbId: Types.ObjectId,
    oldPath: string,
    newPath: string,
    newDepth: number,
    session: ClientSession,
  ): Promise<void> {
    const descendants = await this.categoryModel
      .find({ knowledgeBaseId: kbId, path: { $regex: `^${escapeRegExp(oldPath)}/` } })
      .session(session)
      .lean();
    for (const child of descendants) {
      const suffix = child.path.slice(oldPath.length);
      await this.categoryModel.updateOne(
        { _id: child._id },
        {
          path: `${newPath}${suffix}`,
          depth: newDepth + suffix.split('/').filter(Boolean).length,
        },
        { session },
      );
    }
  }

  async remove(orgId: string, userId: string, orgRole: string, kbIdOrSlug: string, id: string): Promise<void> {
    const access = await this.kbs.requireAccess(orgId, userId, orgRole, kbIdOrSlug);
    this.kbs.requireManager(access);
    const nodeId = toObjectIdOrNull(id);
    if (!nodeId) throw new NotFoundException('دسته‌بندی یافت نشد');
    const node = await this.categoryModel
      .findOne({ _id: nodeId, knowledgeBaseId: access.kbId })
      .lean();
    if (!node) throw new NotFoundException('دسته‌بندی یافت نشد');
    const children = await this.categoryModel.countDocuments({ parentId: nodeId });
    if (children > 0) throw new UnprocessableEntityException('دسته‌بندی دارای زیرمجموعه است');
    const referenced = await this.articleModel.countDocuments({
      knowledgeBaseId: access.kbId,
      categoryId: nodeId,
      deletedAt: null,
    });
    if (referenced > 0) throw new UnprocessableEntityException('دسته‌بندی دارای مقاله است');
    await this.categoryModel.deleteOne({ _id: nodeId });
  }

  private toDto(c: {
    _id: Types.ObjectId;
    title: string;
    slug: string;
    description: string | null;
    parentId: Types.ObjectId | null;
    path: string;
    depth: number;
    position: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: c._id.toHexString(),
      title: c.title,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId ? c.parentId.toHexString() : null,
      path: c.path,
      depth: c.depth,
      position: c.position,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
