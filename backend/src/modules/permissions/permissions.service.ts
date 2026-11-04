import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Central authorization choke point for organization scope.
 * Other modules import this service (never another module's repository).
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Membership row or null — callers map null to 404 to avoid org-existence leaks. */
  async membership(userId: string, orgId: string) {
    return this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
  }

  async requireMember(userId: string, orgId: string): Promise<void> {
    const m = await this.membership(userId, orgId);
    if (!m) throw new NotFoundException('یافت نشد');
  }

  async requireAdmin(userId: string, orgId: string): Promise<void> {
    const m = await this.membership(userId, orgId);
    if (!m) throw new NotFoundException('یافت نشد');
    if (m.role !== 'org-admin') throw new ForbiddenException('دسترسی غیرمجاز');
  }
}
