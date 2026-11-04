import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IdentityService } from './identity.service';

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));

const mockHash = bcrypt.hash as unknown as jest.Mock;
const mockCompare = bcrypt.compare as unknown as jest.Mock;

process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-at-least-32-chars!!';
process.env['JWT_ACCESS_TTL'] = '900';
process.env['JWT_REFRESH_TTL_DAYS'] = '7';

function makePrismaMock() {
  const mock = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    organization: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    membership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    session: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg as Array<Promise<unknown>>)
      : (arg as (tx: unknown) => Promise<unknown>)(mock),
  );
  return mock;
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

describe('IdentityService', () => {
  let prisma: PrismaMock;
  let svc: IdentityService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrismaMock();
    svc = new IdentityService(prisma as unknown as PrismaService, new JwtService({ secret: 'test' }));
    mockHash.mockResolvedValue('hashed-pw');
  });

  describe('register', () => {
    const dto = {
      fullName: 'کاربر تست',
      email: 'test@example.com',
      password: 'Secret123',
      organizationName: 'سازمان تست',
    };

    it('creates user + isolated org + org-admin membership atomically', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: dto.email, fullName: dto.fullName, avatarUrl: null, locale: 'fa', isActive: true });
      prisma.organization.create.mockResolvedValue({ id: 'o1', name: dto.organizationName, slug: 'org-abc123' });
      prisma.membership.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      const res = await svc.register(dto);
      expect(res.user.email).toBe(dto.email);
      expect(res.organization.slug).toBe('org-abc123');
      expect(res.orgRole).toBe('org-admin');
      expect(res.accessToken.length).toBeGreaterThan(10);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate email with 409', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u9' });
      await expect(svc.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { email: 'sara@example.com', password: 'Secret123' };
    const userRow = { id: 'u1', email: dto.email, fullName: 'سارا', avatarUrl: null, locale: 'fa', isActive: true, passwordHash: 'hashed-pw' };

    it('issues tokens and touches lastLoginAt', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow);
      mockCompare.mockResolvedValue(true);
      prisma.membership.findFirst.mockResolvedValue({
        organizationId: 'o1',
        role: 'member',
        organization: { id: 'o1', name: 'Org', slug: 'org-1' },
      });
      prisma.session.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const res = await svc.login(dto, {});
      expect(res.orgRole).toBe('member');
      expect(res.organization.slug).toBe('org-1');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
    });

    it('rejects unknown email, inactive user, and wrong password identically', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.login(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValue({ ...userRow, isActive: false });
      await expect(svc.login(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.user.findUnique.mockResolvedValue(userRow);
      mockCompare.mockResolvedValue(false);
      await expect(svc.login(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rejects unknown tokens', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      await expect(svc.refresh({ refreshToken: 'nope-token-value' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes the whole family on reuse of a rotated token', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 's1',
        familyId: 'f1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(
        svc.refresh({ refreshToken: 'reused-token-value' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ familyId: 'f1' }) }),
      );
    });

    it('rotates exactly once: old revoked, new issued', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 's1',
        familyId: 'f1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600_000),
        user: {
          id: 'u1',
          email: 'sara@example.com',
          isActive: true,
          memberships: [{ organizationId: 'o1', role: 'member' }],
        },
      });
      prisma.session.update.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      const res = await svc.refresh({ refreshToken: 'valid-token-value-123' });
      expect(res.accessToken.length).toBeGreaterThan(10);
      expect(res.refreshToken).not.toBe('valid-token-value-123');
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('rejects wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed-pw' });
      mockCompare.mockResolvedValue(false);
      await expect(
        svc.changePassword('u1', { currentPassword: 'Wrong123', newPassword: 'NewSecret123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates hash and revokes all sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hashed-pw' });
      mockCompare.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      prisma.session.updateMany.mockResolvedValue({});

      await svc.changePassword('u1', { currentPassword: 'Secret123', newPassword: 'NewSecret123' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed-pw' }) }),
      );
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
      );
    });
  });
});
