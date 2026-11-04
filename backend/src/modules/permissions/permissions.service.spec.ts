import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionsService } from './permissions.service';

function makePrismaMock() {
  return {
    membership: { findUnique: jest.fn() },
  };
}

describe('PermissionsService', () => {
  it('requireMember maps missing membership to 404 (no org leak)', async () => {
    const prisma = makePrismaMock();
    prisma.membership.findUnique.mockResolvedValue(null);
    const svc = new PermissionsService(prisma as unknown as PrismaService);
    await expect(svc.requireMember('u1', 'o1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requireAdmin rejects members with 403 and passes admins', async () => {
    const prisma = makePrismaMock();
    const svc = new PermissionsService(prisma as unknown as PrismaService);

    prisma.membership.findUnique.mockResolvedValue({ role: 'member' });
    await expect(svc.requireAdmin('u1', 'o1')).rejects.toBeInstanceOf(ForbiddenException);

    prisma.membership.findUnique.mockResolvedValue({ role: 'org-admin' });
    await expect(svc.requireAdmin('u1', 'o1')).resolves.toBeUndefined();
  });
});
