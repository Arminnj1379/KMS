import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { UsersService } from '../users/users.service';

function orgPrisma(overrides: Record<string, unknown> = {}) {
  return {
    organization: { findUnique: jest.fn(), update: jest.fn() },
    membership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    department: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    session: { updateMany: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg as Array<Promise<unknown>>)
        : (arg as (tx: unknown) => Promise<unknown>)({} as unknown),
    ),
    ...overrides,
  } as unknown as PrismaService;
}

describe('Organization safety rules', () => {
  it('removeMember refuses self-removal', async () => {
    const svc = new OrganizationsService(orgPrisma());
    await expect(svc.removeMember('o1', 'u1', 'u1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('removeMember refuses to drop the last org-admin', async () => {
    const prisma = orgPrisma();
    const membership = prisma.membership as unknown as { findUnique: jest.Mock; count: jest.Mock };
    membership.findUnique.mockResolvedValue({ role: 'org-admin' });
    membership.count.mockResolvedValue(0);
    const svc = new OrganizationsService(prisma);
    await expect(svc.removeMember('o1', 'admin2', 'admin1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('updateDepartment refuses moves into its own subtree', async () => {
    const prisma = orgPrisma();
    const dept = prisma.department as unknown as { findFirst: jest.Mock };
    dept.findFirst
      .mockResolvedValueOnce({ id: 'a', path: '/x', slug: 'x' })
      .mockResolvedValueOnce({ id: 'b', path: '/x/y', depth: 1 });
    const svc = new OrganizationsService(prisma);
    await expect(svc.updateDepartment('o1', 'a', { parentId: 'b' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('users.update refuses self-deactivation and last-admin demotion', async () => {
    const prisma = orgPrisma();
    const membership = prisma.membership as unknown as { findUnique: jest.Mock; count: jest.Mock };
    const svc = new UsersService(prisma);

    membership.findUnique.mockResolvedValue({ role: 'member', user: { id: 'u1' } });
    await expect(svc.update('o1', 'u1', 'u1', { isActive: false })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    membership.findUnique.mockResolvedValue({ role: 'org-admin', user: { id: 'u9' } });
    membership.count.mockResolvedValue(0);
    await expect(svc.update('o1', 'u1', 'u9', { role: 'member' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
