import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types, type Connection } from 'mongoose';
import { Membership } from '../../common/mongo/schemas/membership.schema';
import { User } from '../../common/mongo/schemas/user.schema';
import { Department } from '../../common/mongo/schemas/department.schema';
import { normalizeEmail, toObjectIdOrNull } from '../../common/mongo/object-id';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { withTransaction } from '../../common/mongo/transaction.helper';
import type { SafeUser } from '../identity/identity.service';
import { hashPassword } from '../identity/password.util';
import { InviteUserDto, ListUsersQuery, UpdateMeDto, UpdateUserDto } from './dto/users.dto';

export interface OrgUserRow {
  user: SafeUser;
  role: string;
  department: { id: string; name: string } | null;
  memberSince: Date;
}

interface MembershipLean {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: string;
  departmentId: Types.ObjectId | null;
  createdAt: Date;
}

function safe(u: {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
}): SafeUser {
  return {
    id: u._id.toHexString(),
    email: u.email,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl,
    locale: u.locale,
    isActive: u.isActive,
  };
}

/**
 * Organization-scoped user management. Every method takes the caller's
 * orgId from the JWT (never from the client) — cross-org ids resolve to 404.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(Department.name) private readonly departmentModel: Model<Department>,
  ) {}

  private orgObjectId(orgId: string): Types.ObjectId | null {
    return toObjectIdOrNull(orgId);
  }

  async list(orgId: string, query: ListUsersQuery): Promise<{ data: OrgUserRow[]; total: number }> {
    const orgObjectId = this.orgObjectId(orgId);
    if (!orgObjectId) return { data: [], total: 0 };
    const filter: FilterQuery<Membership> = { organizationId: orgObjectId };

    let userIds: Types.ObjectId[] | null = null;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matched = await this.userModel
        .find({ $or: [{ email: rx }, { fullName: rx }] })
        .select('_id')
        .lean();
      userIds = matched.map((u) => u._id);
      if (userIds.length === 0) return { data: [], total: 0 };
      filter.userId = { $in: userIds };
    }

    const [rows, total] = await Promise.all([
      this.membershipModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean(),
      this.membershipModel.countDocuments(filter),
    ]);
    return { data: await this.toRows(rows), total };
  }

  /** Org-admin invite: attaches an existing user or creates a new one. */
  async invite(orgId: string, dto: InviteUserDto): Promise<OrgUserRow> {
    const orgObjectId = this.orgObjectId(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    if (dto.departmentId) await this.assertDepartmentInOrg(orgObjectId, dto.departmentId);

    const existingUser = await this.userModel.findOne({ email: normalizeEmail(dto.email) }).lean();
    if (existingUser) {
      const dup = await this.membershipModel
        .findOne({ organizationId: orgObjectId, userId: existingUser._id })
        .lean();
      if (dup) throw new ConflictException('این کاربر قبلاً عضو سازمان است');
      try {
        const m = await this.membershipModel.create({
          organizationId: orgObjectId,
          userId: existingUser._id,
          role: dto.role,
          departmentId: dto.departmentId ? toObjectIdOrNull(dto.departmentId) : null,
        });
        return this.toRow(m.toObject() as unknown as MembershipLean & { _id: Types.ObjectId });
      } catch (error) {
        throwConflictIfDuplicate(error, 'این کاربر قبلاً عضو سازمان است');
        throw error;
      }
    }

    try {
      const created = await withTransaction(this.connection, async (tx) => {
        const [user] = await this.userModel.create(
          [
            {
              email: normalizeEmail(dto.email),
              fullName: dto.fullName,
              passwordHash: await hashPassword(dto.password),
            },
          ],
          { session: tx },
        );
        if (!user) throw new ConflictException('امکان ساخت کاربر وجود ندارد');
        const [m] = await this.membershipModel.create(
          [
            {
              organizationId: orgObjectId,
              userId: user._id,
              role: dto.role,
              departmentId: dto.departmentId ? toObjectIdOrNull(dto.departmentId) : null,
            },
          ],
          { session: tx },
        );
        if (!m) throw new ConflictException('امکان ساخت کاربر وجود ندارد');
        return m._id;
      });
      const m = await this.membershipModel.findById(created).lean();
      if (!m) throw new NotFoundException('کاربر یافت نشد');
      return this.toRow(m);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      throwConflictIfDuplicate(error, 'این ایمیل قبلاً ثبت شده است');
      throw error;
    }
  }

  async findOne(orgId: string, userId: string): Promise<OrgUserRow> {
    const m = await this.findMembership(orgId, userId);
    if (!m) throw new NotFoundException('کاربر یافت نشد');
    return this.toRow(m);
  }

  /**
   * Org-admin update. Guards: cannot deactivate yourself, cannot demote or
   * deactivate the last remaining org-admin.
   */
  async update(orgId: string, callerId: string, targetId: string, dto: UpdateUserDto): Promise<OrgUserRow> {
    const orgObjectId = this.orgObjectId(orgId);
    const targetObjectId = toObjectIdOrNull(targetId);
    if (!orgObjectId || !targetObjectId) throw new NotFoundException('کاربر یافت نشد');
    const target = await this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: targetObjectId })
      .lean();
    if (!target) throw new NotFoundException('کاربر یافت نشد');

    if (dto.departmentId) await this.assertDepartmentInOrg(orgObjectId, dto.departmentId);
    if (targetId === callerId && dto.isActive === false) {
      throw new UnprocessableEntityException('نمی‌توانید حساب خودتان را غیرفعال کنید');
    }
    const demotingAdmin = target.role === 'org-admin' && dto.role && dto.role !== 'org-admin';
    const deactivatingAdmin = target.role === 'org-admin' && dto.isActive === false;
    if (demotingAdmin || deactivatingAdmin) await this.assertNotLastAdmin(orgObjectId, targetId);

    await withTransaction(this.connection, async (tx) => {
      if (dto.fullName !== undefined || dto.isActive !== undefined) {
        await this.userModel.updateOne(
          { _id: targetObjectId },
          {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
          { session: tx },
        );
      }
      await this.membershipModel.updateOne(
        { organizationId: orgObjectId, userId: targetObjectId },
        {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId ? toObjectIdOrNull(dto.departmentId) : null }
            : {}),
        },
        { session: tx },
      );
    });
    const updated = await this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: targetObjectId })
      .lean();
    if (!updated) throw new NotFoundException('کاربر یافت نشد');
    return this.toRow(updated);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<SafeUser> {
    const id = toObjectIdOrNull(userId);
    if (!id) throw new NotFoundException('کاربر یافت نشد');
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
          ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        },
        { new: true },
      )
      .lean();
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return safe(user);
  }

  private async findMembership(orgId: string, userId: string) {
    const orgObjectId = this.orgObjectId(orgId);
    const userObjectId = toObjectIdOrNull(userId);
    if (!orgObjectId || !userObjectId) return null;
    return this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: userObjectId })
      .lean();
  }

  private async toRow(m: MembershipLean): Promise<OrgUserRow> {
    const [user, department] = await Promise.all([
      this.userModel.findById(m.userId).lean(),
      m.departmentId ? this.departmentModel.findById(m.departmentId).lean() : null,
    ]);
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return {
      user: safe(user),
      role: m.role,
      department: department ? { id: department._id.toHexString(), name: department.name } : null,
      memberSince: m.createdAt,
    };
  }

  private async toRows(members: MembershipLean[]): Promise<OrgUserRow[]> {
    if (members.length === 0) return [];
    const userIds = [...new Set(members.map((m) => m.userId.toHexString()))].map((h) => new Types.ObjectId(h));
    const deptIds = [...new Set(members.map((m) => m.departmentId?.toHexString()).filter((h): h is string => Boolean(h)))].map(
      (h) => new Types.ObjectId(h),
    );
    const [users, departments] = await Promise.all([
      this.userModel.find({ _id: { $in: userIds } }).lean(),
      deptIds.length === 0 ? Promise.resolve([]) : this.departmentModel.find({ _id: { $in: deptIds } }).lean(),
    ]);
    const userById = new Map(users.map((u) => [u._id.toHexString(), u]));
    const deptById = new Map(departments.map((d) => [d._id.toHexString(), d]));
    const rows: OrgUserRow[] = [];
    for (const m of members) {
      const user = userById.get(m.userId.toHexString());
      if (!user) continue;
      const department = m.departmentId ? deptById.get(m.departmentId.toHexString()) ?? null : null;
      rows.push({
        user: safe(user),
        role: m.role,
        department: department ? { id: department._id.toHexString(), name: department.name } : null,
        memberSince: m.createdAt,
      });
    }
    return rows;
  }

  private async assertDepartmentInOrg(orgId: Types.ObjectId, departmentId: string): Promise<void> {
    const deptId = toObjectIdOrNull(departmentId);
    const dept = deptId
      ? await this.departmentModel.findOne({ _id: deptId, organizationId: orgId }).lean()
      : null;
    if (!dept) throw new NotFoundException('دپارتمان یافت نشد');
  }

  private async assertNotLastAdmin(orgId: Types.ObjectId, excludedUserId: string): Promise<void> {
    const excluded = toObjectIdOrNull(excludedUserId);
    const remaining = await this.membershipModel.countDocuments({
      organizationId: orgId,
      role: 'org-admin',
      ...(excluded ? { userId: { $ne: excluded } } : {}),
    });
    if (remaining === 0) {
      throw new UnprocessableEntityException('سازمان باید حداقل یک مدیر داشته باشد');
    }
  }
}
