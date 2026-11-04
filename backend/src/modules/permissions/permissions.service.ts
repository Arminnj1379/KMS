import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership } from '../../common/mongo/schemas/membership.schema';
import { toObjectIdOrNull } from '../../common/mongo/object-id';

/**
 * Central authorization choke point for organization scope.
 * Other modules import this service (never another module's model).
 */
@Injectable()
export class PermissionsService {
  constructor(@InjectModel(Membership.name) private readonly membershipModel: Model<Membership>) {}

  /** Membership doc or null — callers map null to 404 to avoid org-existence leaks. */
  async membership(userId: string, orgId: string) {
    const userObjectId = toObjectIdOrNull(userId);
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!userObjectId || !orgObjectId) return null;
    return this.membershipModel.findOne({ organizationId: orgObjectId, userId: userObjectId }).lean();
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
