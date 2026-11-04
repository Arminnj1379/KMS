import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import type { Membership } from '../../common/mongo/schemas/membership.schema';
import { PermissionsService } from './permissions.service';

function makeModelMock() {
  return { findOne: jest.fn() };
}

function q<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

describe('PermissionsService', () => {
  it('requireMember maps missing membership to 404 (no org leak)', async () => {
    const memberships = makeModelMock();
    memberships.findOne.mockReturnValue(q(null));
    const svc = new PermissionsService(memberships as unknown as Model<Membership>);
    await expect(svc.requireMember('u1', 'o1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requireAdmin rejects members with 403 and passes admins', async () => {
    const memberships = makeModelMock();
    const svc = new PermissionsService(memberships as unknown as Model<Membership>);

    memberships.findOne.mockReturnValue(q({ role: 'member' }));
    await expect(
      svc.requireAdmin('000000000000000000000001', '000000000000000000000010'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    memberships.findOne.mockReturnValue(q({ role: 'org-admin' }));
    await expect(
      svc.requireAdmin('000000000000000000000001', '000000000000000000000010'),
    ).resolves.toBeUndefined();
  });

  it('maps malformed ids to 404 instead of throwing', async () => {
    const memberships = makeModelMock();
    const svc = new PermissionsService(memberships as unknown as Model<Membership>);
    await expect(svc.requireMember('not-an-id', 'also-bad')).rejects.toBeInstanceOf(NotFoundException);
    expect(memberships.findOne).not.toHaveBeenCalled();
  });
});
