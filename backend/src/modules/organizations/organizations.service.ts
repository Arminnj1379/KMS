import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
import { Department } from '../../common/mongo/schemas/department.schema';
import { Membership } from '../../common/mongo/schemas/membership.schema';
import { Organization } from '../../common/mongo/schemas/organization.schema';
import { User } from '../../common/mongo/schemas/user.schema';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { normalizeEmail, toObjectIdOrNull } from '../../common/mongo/object-id';
import { withTransaction } from '../../common/mongo/transaction.helper';
import {
  AddMemberDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';

export interface DepartmentNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  path: string;
  depth: number;
  children: DepartmentNode[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Organization workspace: org profile, department tree, membership roster.
 * All reads/writes are scoped by the caller's orgId (from JWT).
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Organization.name) private readonly organizationModel: Model<Organization>,
    @InjectModel(Department.name) private readonly departmentModel: Model<Department>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getCurrent(orgId: string) {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    const org = await this.organizationModel.findById(orgObjectId).lean();
    if (!org) throw new NotFoundException('سازمان یافت نشد');
    const [memberCount, departmentCount] = await Promise.all([
      this.membershipModel.countDocuments({ organizationId: orgObjectId }),
      this.departmentModel.countDocuments({ organizationId: orgObjectId }),
    ]);
    return {
      id: org._id.toHexString(),
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      memberCount,
      departmentCount,
    };
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    const org = await this.organizationModel
      .findByIdAndUpdate(orgObjectId, { ...dto }, { new: true })
      .lean();
    if (!org) throw new NotFoundException('سازمان یافت نشد');
    return {
      id: org._id.toHexString(),
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  // ---------- Departments ----------

  async listDepartments(orgId: string): Promise<DepartmentNode[]> {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) return [];
    const rows = await this.departmentModel
      .find({ organizationId: orgObjectId })
      .sort({ path: 1 })
      .lean();
    const byId = new Map<string, DepartmentNode>();
    const roots: DepartmentNode[] = [];
    for (const d of rows) {
      byId.set(d._id.toHexString(), {
        id: d._id.toHexString(),
        name: d.name,
        slug: d.slug,
        description: d.description,
        parentId: d.parentId ? d.parentId.toHexString() : null,
        path: d.path,
        depth: d.depth,
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

  async createDepartment(orgId: string, dto: CreateDepartmentDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    let parent: { _id: Types.ObjectId; path: string; depth: number } | null = null;
    if (dto.parentId) {
      const parentId = toObjectIdOrNull(dto.parentId);
      parent = parentId
        ? await this.departmentModel.findOne({ _id: parentId, organizationId: orgObjectId }).lean()
        : null;
      if (!parent) throw new NotFoundException('دپارتمان والد یافت نشد');
    }
    try {
      const created = await this.departmentModel.create({
        organizationId: orgObjectId,
        parentId: parent?._id ?? null,
        name: dto.name,
        slug: dto.slug,
        path: parent ? `${parent.path}/${dto.slug}` : `/${dto.slug}`,
        depth: parent ? parent.depth + 1 : 0,
      });
      return this.toDepartmentDto(created.toObject());
    } catch (error) {
      throwConflictIfDuplicate(error, 'شناسه دپارتمان در این سازمان تکراری است');
      throw error;
    }
  }

  /**
   * Rename / move a department. Moves are cycle-safe: a node can never
   * become a child of its own subtree. Subtree paths update in one tx.
   */
  async updateDepartment(orgId: string, id: string, dto: UpdateDepartmentDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    const nodeId = toObjectIdOrNull(id);
    if (!orgObjectId || !nodeId) throw new NotFoundException('دپارتمان یافت نشد');
    const node = await this.departmentModel
      .findOne({ _id: nodeId, organizationId: orgObjectId })
      .lean();
    if (!node) throw new NotFoundException('دپارتمان یافت نشد');

    let parent: { _id: Types.ObjectId; path: string; depth: number } | null = null;
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new UnprocessableEntityException('دپارتمان نمی‌تواند والد خودش باشد');
      if (dto.parentId !== null) {
        const parentId = toObjectIdOrNull(dto.parentId);
        parent = parentId
          ? await this.departmentModel.findOne({ _id: parentId, organizationId: orgObjectId }).lean()
          : null;
        if (!parent) throw new NotFoundException('دپارتمان والد یافت نشد');
        const ownPrefix = `${node.path}/`;
        if (parent.path === node.path || parent.path.startsWith(ownPrefix)) {
          throw new UnprocessableEntityException('انتقال به زیرمجموعه خودش مجاز نیست');
        }
      }
    } else if (node.parentId) {
      parent = await this.departmentModel.findById(node.parentId).lean();
    }

    const newPath = parent ? `${parent.path}/${node.slug}` : `/${node.slug}`;
    const newDepth = parent ? parent.depth + 1 : 0;

    return withTransaction(this.connection, async (tx) => {
      const updated = await this.departmentModel
        .findByIdAndUpdate(
          nodeId,
          {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
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
      if (!updated) throw new NotFoundException('دپارتمان یافت نشد');
      if (newPath !== node.path) {
        await this.rewriteSubtreePaths(orgObjectId, node.path, newPath, newDepth, tx);
      }
      return this.toDepartmentDto(updated);
    });
  }

  private async rewriteSubtreePaths(
    orgId: Types.ObjectId,
    oldPath: string,
    newPath: string,
    newDepth: number,
    session: ClientSession,
  ): Promise<void> {
    const descendants = await this.departmentModel
      .find({
        organizationId: orgId,
        path: { $regex: `^${escapeRegExp(oldPath)}/` },
      })
      .session(session)
      .lean();
    for (const child of descendants) {
      const suffix = child.path.slice(oldPath.length);
      await this.departmentModel.updateOne(
        { _id: child._id },
        {
          path: `${newPath}${suffix}`,
          depth: newDepth + suffix.split('/').filter(Boolean).length,
        },
        { session },
      );
    }
  }

  async deleteDepartment(orgId: string, id: string): Promise<void> {
    const orgObjectId = toObjectIdOrNull(orgId);
    const nodeId = toObjectIdOrNull(id);
    if (!orgObjectId || !nodeId) throw new NotFoundException('دپارتمان یافت نشد');
    const node = await this.departmentModel
      .findOne({ _id: nodeId, organizationId: orgObjectId })
      .lean();
    if (!node) throw new NotFoundException('دپارتمان یافت نشد');
    const [children, members] = await Promise.all([
      this.departmentModel.countDocuments({ parentId: nodeId }),
      this.membershipModel.countDocuments({ departmentId: nodeId }),
    ]);
    if (children > 0) throw new UnprocessableEntityException('دپارتمان دارای زیرمجموعه است');
    if (members > 0) throw new UnprocessableEntityException('دپارتمان دارای عضو است');
    await this.departmentModel.deleteOne({ _id: nodeId });
  }

  // ---------- Members (existing users only; creation lives in UsersService) ----------

  async listMembers(orgId: string) {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) return [];
    const rows = await this.membershipModel
      .find({ organizationId: orgObjectId })
      .sort({ createdAt: 1 })
      .lean();
    const result = [];
    for (const m of rows) {
      const [user, department] = await Promise.all([
        this.userModel.findById(m.userId).lean(),
        m.departmentId ? this.departmentModel.findById(m.departmentId).lean() : null,
      ]);
      if (!user) continue;
      result.push({
        userId: user._id.toHexString(),
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        role: m.role,
        department: department ? { id: department._id.toHexString(), name: department.name } : null,
        memberSince: m.createdAt,
      });
    }
    return result;
  }

  async addMember(orgId: string, dto: AddMemberDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    const user = await this.userModel.findOne({ email: normalizeEmail(dto.email) }).lean();
    if (!user) throw new NotFoundException('کاربری با این ایمیل یافت نشد');
    if (dto.departmentId) {
      const deptId = toObjectIdOrNull(dto.departmentId);
      const dept = deptId
        ? await this.departmentModel.findOne({ _id: deptId, organizationId: orgObjectId }).lean()
        : null;
      if (!dept) throw new NotFoundException('دپارتمان یافت نشد');
    }
    try {
      const created = await this.membershipModel.create({
        organizationId: orgObjectId,
        userId: user._id,
        role: dto.role,
        departmentId: dto.departmentId ? toObjectIdOrNull(dto.departmentId) : null,
      });
      return {
        organizationId: orgObjectId.toHexString(),
        userId: user._id.toHexString(),
        role: created.role,
        id: created._id.toHexString(),
      };
    } catch (error) {
      throwConflictIfDuplicate(error, 'این کاربر قبلاً عضو سازمان است');
      throw error;
    }
  }

  async updateMember(orgId: string, targetId: string, dto: UpdateMemberDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    const targetObjectId = toObjectIdOrNull(targetId);
    if (!orgObjectId || !targetObjectId) throw new NotFoundException('عضو یافت نشد');
    const target = await this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: targetObjectId })
      .lean();
    if (!target) throw new NotFoundException('عضو یافت نشد');
    if (dto.departmentId) {
      const deptId = toObjectIdOrNull(dto.departmentId);
      const dept = deptId
        ? await this.departmentModel.findOne({ _id: deptId, organizationId: orgObjectId }).lean()
        : null;
      if (!dept) throw new NotFoundException('دپارتمان یافت نشد');
    }
    if (target.role === 'org-admin' && dto.role && dto.role !== 'org-admin') {
      const remaining = await this.membershipModel.countDocuments({
        organizationId: orgObjectId,
        role: 'org-admin',
        userId: { $ne: targetObjectId },
      });
      if (remaining === 0) throw new UnprocessableEntityException('سازمان باید حداقل یک مدیر داشته باشد');
    }
    const updated = await this.membershipModel
      .findOneAndUpdate(
        { organizationId: orgObjectId, userId: targetObjectId },
        {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId ? toObjectIdOrNull(dto.departmentId) : null }
            : {}),
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException('عضو یافت نشد');
    return {
      userId: targetId,
      role: updated.role,
      departmentId: updated.departmentId ? updated.departmentId.toHexString() : null,
    };
  }

  async removeMember(orgId: string, callerId: string, targetId: string): Promise<void> {
    if (targetId === callerId) throw new UnprocessableEntityException('نمی‌توانید خودتان را حذف کنید');
    const orgObjectId = toObjectIdOrNull(orgId);
    const targetObjectId = toObjectIdOrNull(targetId);
    if (!orgObjectId || !targetObjectId) throw new NotFoundException('عضو یافت نشد');
    const target = await this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: targetObjectId })
      .lean();
    if (!target) throw new NotFoundException('عضو یافت نشد');
    if (target.role === 'org-admin') {
      const remaining = await this.membershipModel.countDocuments({
        organizationId: orgObjectId,
        role: 'org-admin',
        userId: { $ne: targetObjectId },
      });
      if (remaining === 0) throw new UnprocessableEntityException('سازمان باید حداقل یک مدیر داشته باشد');
    }
    await this.membershipModel.deleteOne({ organizationId: orgObjectId, userId: targetObjectId });
  }

  private toDepartmentDto(d: {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    description: string | null;
    parentId: Types.ObjectId | null;
    path: string;
    depth: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: d._id.toHexString(),
      name: d.name,
      slug: d.slug,
      description: d.description,
      parentId: d.parentId ? d.parentId.toHexString() : null,
      path: d.path,
      depth: d.depth,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
