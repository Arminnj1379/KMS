import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { SafeUser } from '../identity/identity.service';
import { hashPassword } from '../identity/password.util';
import { InviteUserDto, ListUsersQuery, UpdateMeDto, UpdateUserDto } from './dto/users.dto';

export interface OrgUserRow {
  user: SafeUser;
  role: string;
  department: { id: string; name: string } | null;
  memberSince: Date;
}

function safe(u: {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
}): SafeUser {
  return {
    id: u.id,
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
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, query: ListUsersQuery): Promise<{ data: OrgUserRow[]; total: number }> {
    const where: Prisma.MembershipWhereInput = { organizationId: orgId };
    if (query.search) {
      where.user = {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { fullName: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        include: { user: true, department: true },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.membership.count({ where }),
    ]);
    return {
      data: rows.map((m) => ({
        user: safe(m.user),
        role: m.role,
        department: m.department ? { id: m.department.id, name: m.department.name } : null,
        memberSince: m.createdAt,
      })),
      total,
    };
  }

  /** Org-admin invite: attaches an existing user or creates a new one. */
  async invite(orgId: string, dto: InviteUserDto): Promise<OrgUserRow> {
    if (dto.departmentId) await this.assertDepartmentInOrg(orgId, dto.departmentId);

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      const dup = await this.prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (dup) throw new ConflictException('این کاربر قبلاً عضو سازمان است');
      const m = await this.prisma.membership.create({
        data: {
          organizationId: orgId,
          userId: existingUser.id,
          role: dto.role,
          departmentId: dto.departmentId,
        },
        include: { user: true, department: true },
      });
      return this.row(m);
    }

    try {
      const m = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: dto.email, fullName: dto.fullName, passwordHash: await hashPassword(dto.password) },
        });
        return tx.membership.create({
          data: {
            organizationId: orgId,
            userId: user.id,
            role: dto.role,
            departmentId: dto.departmentId,
          },
          include: { user: true, department: true },
        });
      });
      return this.row(m);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('این ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }
  }

  async findOne(orgId: string, userId: string): Promise<OrgUserRow> {
    const m = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      include: { user: true, department: true },
    });
    if (!m) throw new NotFoundException('کاربر یافت نشد');
    return this.row(m);
  }

  /**
   * Org-admin update. Guards: cannot deactivate yourself, cannot demote or
   * deactivate the last remaining org-admin.
   */
  async update(orgId: string, callerId: string, targetId: string, dto: UpdateUserDto): Promise<OrgUserRow> {
    const target = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
      include: { user: true },
    });
    if (!target) throw new NotFoundException('کاربر یافت نشد');

    if (dto.departmentId) await this.assertDepartmentInOrg(orgId, dto.departmentId);
    if (targetId === callerId && dto.isActive === false) {
      throw new UnprocessableEntityException('نمی‌توانید حساب خودتان را غیرفعال کنید');
    }
    const demotingAdmin = target.role === 'org-admin' && dto.role && dto.role !== 'org-admin';
    const deactivatingAdmin = target.role === 'org-admin' && dto.isActive === false;
    if (demotingAdmin || deactivatingAdmin) await this.assertNotLastAdmin(orgId, targetId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.fullName !== undefined || dto.isActive !== undefined) {
        await tx.user.update({
          where: { id: targetId },
          data: {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });
      }
      return tx.membership.update({
        where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
        data: {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        },
        include: { user: true, department: true },
      });
    });
    return this.row(updated);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      },
    });
    return safe(user);
  }

  private row(m: {
    user: Parameters<typeof safe>[0];
    role: string;
    department: { id: string; name: string } | null;
    createdAt: Date;
  }): OrgUserRow {
    return {
      user: safe(m.user),
      role: m.role,
      department: m.department ? { id: m.department.id, name: m.department.name } : null,
      memberSince: m.createdAt,
    };
  }

  private async assertDepartmentInOrg(orgId: string, departmentId: string): Promise<void> {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } });
    if (!dept) throw new NotFoundException('دپارتمان یافت نشد');
  }

  private async assertNotLastAdmin(orgId: string, excludedUserId: string): Promise<void> {
    const remaining = await this.prisma.membership.count({
      where: { organizationId: orgId, role: 'org-admin', userId: { not: excludedUserId } },
    });
    if (remaining === 0) {
      throw new UnprocessableEntityException('سازمان باید حداقل یک مدیر داشته باشد');
    }
  }
}
