import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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

/**
 * Organization workspace: org profile, department tree, membership roster.
 * All reads/writes are scoped by the caller's orgId (from JWT).
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('سازمان یافت نشد');
    const [memberCount, departmentCount] = await this.prisma.$transaction([
      this.prisma.membership.count({ where: { organizationId: orgId } }),
      this.prisma.department.count({ where: { organizationId: orgId } }),
    ]);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      memberCount,
      departmentCount,
    };
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    try {
      return await this.prisma.organization.update({ where: { id: orgId }, data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('سازمان یافت نشد');
      }
      throw error;
    }
  }

  // ---------- Departments ----------

  async listDepartments(orgId: string): Promise<DepartmentNode[]> {
    const rows = await this.prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { path: 'asc' },
    });
    const byId = new Map<string, DepartmentNode>();
    const roots: DepartmentNode[] = [];
    for (const d of rows) {
      byId.set(d.id, {
        id: d.id,
        name: d.name,
        slug: d.slug,
        description: d.description,
        parentId: d.parentId,
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
    let parent: { id: string; path: string; depth: number } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, organizationId: orgId },
      });
      if (!parent) throw new NotFoundException('دپارتمان والد یافت نشد');
    }
    try {
      return await this.prisma.department.create({
        data: {
          organizationId: orgId,
          parentId: parent?.id,
          name: dto.name,
          slug: dto.slug,
          path: parent ? `${parent.path}/${dto.slug}` : `/${dto.slug}`,
          depth: parent ? parent.depth + 1 : 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('شناسه دپارتمان در این سازمان تکراری است');
      }
      throw error;
    }
  }

  /**
   * Rename / move a department. Moves are cycle-safe: a node can never
   * become a child of its own subtree. Subtree paths update in one tx.
   */
  async updateDepartment(orgId: string, id: string, dto: UpdateDepartmentDto) {
    const node = await this.prisma.department.findFirst({ where: { id, organizationId: orgId } });
    if (!node) throw new NotFoundException('دپارتمان یافت نشد');

    let parent: { id: string; path: string; depth: number } | null = null;
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new UnprocessableEntityException('دپارتمان نمی‌تواند والد خودش باشد');
      if (dto.parentId !== null) {
        parent = await this.prisma.department.findFirst({
          where: { id: dto.parentId, organizationId: orgId },
        });
        if (!parent) throw new NotFoundException('دپارتمان والد یافت نشد');
        const ownPrefix = `${node.path}/`;
        if (parent.path === node.path || parent.path.startsWith(ownPrefix)) {
          throw new UnprocessableEntityException('انتقال به زیرمجموعه خودش مجاز نیست');
        }
      }
    } else if (node.parentId) {
      parent = await this.prisma.department.findUnique({ where: { id: node.parentId } });
    }

    const newPath = parent ? `${parent.path}/${node.slug}` : `/${node.slug}`;
    const newDepth = parent ? parent.depth + 1 : 0;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          path: newPath,
          depth: newDepth,
        },
      });
      if (newPath !== node.path) {
        const descendants = await tx.department.findMany({
          where: { organizationId: orgId, path: { startsWith: `${node.path}/` } },
        });
        for (const child of descendants) {
          const suffix = child.path.slice(node.path.length);
          await tx.department.update({
            where: { id: child.id },
            data: { path: `${newPath}${suffix}`, depth: newDepth + suffix.split('/').filter(Boolean).length },
          });
        }
      }
      return updated;
    });
  }

  async deleteDepartment(orgId: string, id: string): Promise<void> {
    const node = await this.prisma.department.findFirst({ where: { id, organizationId: orgId } });
    if (!node) throw new NotFoundException('دپارتمان یافت نشد');
    const [children, members] = await this.prisma.$transaction([
      this.prisma.department.count({ where: { parentId: id } }),
      this.prisma.membership.count({ where: { departmentId: id } }),
    ]);
    if (children > 0) throw new UnprocessableEntityException('دپارتمان دارای زیرمجموعه است');
    if (members > 0) throw new UnprocessableEntityException('دپارتمان دارای عضو است');
    await this.prisma.department.delete({ where: { id } });
  }

  // ---------- Members (existing users only; creation lives in UsersService) ----------

  async listMembers(orgId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: true, department: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      fullName: m.user.fullName,
      isActive: m.user.isActive,
      role: m.role,
      department: m.department ? { id: m.department.id, name: m.department.name } : null,
      memberSince: m.createdAt,
    }));
  }

  async addMember(orgId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('کاربری با این ایمیل یافت نشد');
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: orgId },
      });
      if (!dept) throw new NotFoundException('دپارتمان یافت نشد');
    }
    try {
      return await this.prisma.membership.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: dto.role,
          departmentId: dto.departmentId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('این کاربر قبلاً عضو سازمان است');
      }
      throw error;
    }
  }

  async updateMember(orgId: string, targetId: string, dto: UpdateMemberDto) {
    const target = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
    });
    if (!target) throw new NotFoundException('عضو یافت نشد');
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: orgId },
      });
      if (!dept) throw new NotFoundException('دپارتمان یافت نشد');
    }
    if (target.role === 'org-admin' && dto.role && dto.role !== 'org-admin') {
      const remaining = await this.prisma.membership.count({
        where: { organizationId: orgId, role: 'org-admin', userId: { not: targetId } },
      });
      if (remaining === 0) throw new UnprocessableEntityException('سازمان باید حداقل یک مدیر داشته باشد');
    }
    return this.prisma.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      },
    });
  }

  async removeMember(orgId: string, callerId: string, targetId: string): Promise<void> {
    if (targetId === callerId) throw new UnprocessableEntityException('نمی‌توانید خودتان را حذف کنید');
    const target = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
    });
    if (!target) throw new NotFoundException('عضو یافت نشد');
    if (target.role === 'org-admin') {
      const remaining = await this.prisma.membership.count({
        where: { organizationId: orgId, role: 'org-admin', userId: { not: targetId } },
      });
      if (remaining === 0) throw new UnprocessableEntityException('سازمان باید حداقل یک مدیر داشته باشد');
    }
    await this.prisma.membership.delete({
      where: { organizationId_userId: { organizationId: orgId, userId: targetId } },
    });
  }
}
