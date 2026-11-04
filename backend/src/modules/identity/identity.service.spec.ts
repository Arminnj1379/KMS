import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Connection } from 'mongoose';
import { Model, Types } from 'mongoose';
import type { Membership } from '../../common/mongo/schemas/membership.schema';
import type { Organization } from '../../common/mongo/schemas/organization.schema';
import type { RefreshSession } from '../../common/mongo/schemas/session.schema';
import type { Department } from '../../common/mongo/schemas/department.schema';
import type { User } from '../../common/mongo/schemas/user.schema';
import { IdentityService } from './identity.service';

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));

const mockHash = bcrypt.hash as unknown as jest.Mock;
const mockCompare = bcrypt.compare as unknown as jest.Mock;

process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-at-least-32-chars!!';
process.env['JWT_ACCESS_TTL'] = '900';
process.env['JWT_REFRESH_TTL_DAYS'] = '7';

// SAFETY: test-only stub of Mongoose's chainable Query API (sort/skip/limit/session/select + lean).
interface ChainStub<T> {
  lean: jest.Mock<Promise<T>>;
  sort: jest.Mock<ChainStub<T>>;
  skip: jest.Mock<ChainStub<T>>;
  limit: jest.Mock<ChainStub<T>>;
  session: jest.Mock<ChainStub<T>>;
  select: jest.Mock<ChainStub<T>>;
}

function q<T>(value: T): ChainStub<T> {
  const stub = {} as ChainStub<T>;
  stub.lean = jest.fn().mockResolvedValue(value);
  stub.sort = jest.fn().mockReturnValue(stub);
  stub.skip = jest.fn().mockReturnValue(stub);
  stub.limit = jest.fn().mockReturnValue(stub);
  stub.session = jest.fn().mockReturnValue(stub);
  stub.select = jest.fn().mockReturnValue(stub);
  return stub;
}

function oid(hex: string): Types.ObjectId {
  return new Types.ObjectId(hex);
}

const U1 = '000000000000000000000001';
const O1 = '000000000000000000000010';

function makeModelMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  };
}

function makeConnectionMock() {
  const session = {
    withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
    endSession: jest.fn(),
  };
  return { startSession: jest.fn().mockResolvedValue(session), session };
}

type ModelMock = ReturnType<typeof makeModelMock>;

describe('IdentityService', () => {
  let connection: { startSession: jest.Mock; session: { withTransaction: jest.Mock; endSession: jest.Mock } };
  let users: ModelMock;
  let orgs: ModelMock;
  let memberships: ModelMock;
  let sessions: ModelMock;
  let depts: ModelMock;
  let svc: IdentityService;

  const userDoc = {
    _id: oid(U1),
    email: 'test@example.com',
    fullName: 'کاربر تست',
    avatarUrl: null,
    locale: 'fa',
    isActive: true,
    passwordHash: 'hashed-pw',
  };
  const orgDoc = { _id: oid(O1), name: 'سازمان تست', slug: 'org-abc123' };

  beforeEach(() => {
    jest.clearAllMocks();
    connection = makeConnectionMock();
    users = makeModelMock();
    orgs = makeModelMock();
    memberships = makeModelMock();
    sessions = makeModelMock();
    depts = makeModelMock();
    svc = new IdentityService(
      connection as unknown as Connection,
      users as unknown as Model<User>,
      orgs as unknown as Model<Organization>,
      memberships as unknown as Model<Membership>,
      sessions as unknown as Model<RefreshSession>,
      depts as unknown as Model<Department>,
      new JwtService({ secret: 'test' }),
    );
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
      users.findOne.mockReturnValue(q(null));
      orgs.findOne.mockReturnValue(q(null));
      users.create.mockResolvedValue([{ _id: oid(U1) }]);
      orgs.create.mockResolvedValue([{ _id: oid(O1) }]);
      memberships.create.mockResolvedValue([{}]);
      sessions.create.mockResolvedValue([{}]);
      users.findById.mockReturnValue(q(userDoc));
      orgs.findOne.mockReturnValueOnce(q(null)).mockReturnValueOnce(q(orgDoc));

      const res = await svc.register(dto);
      expect(res.user.email).toBe(dto.email);
      expect(res.organization.slug).toBe('org-abc123');
      expect(res.orgRole).toBe('org-admin');
      expect(res.accessToken.length).toBeGreaterThan(10);
      expect(connection.startSession).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate email with 409', async () => {
      users.findOne.mockReturnValue(q({ _id: oid(U1) }));
      await expect(svc.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(connection.startSession).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { email: 'sara@example.com', password: 'Secret123' };
    const loginUser = { ...userDoc, email: dto.email, fullName: 'سارا' };

    it('issues tokens and touches lastLoginAt', async () => {
      users.findOne.mockReturnValue(q(loginUser));
      mockCompare.mockResolvedValue(true);
      memberships.findOne.mockReturnValue(
        q({ organizationId: oid(O1), role: 'member' }),
      );
      orgs.findById.mockReturnValue(q({ _id: oid(O1), name: 'Org', slug: 'org-1' }));
      sessions.create.mockResolvedValue([{}]);
      users.updateOne.mockResolvedValue({});

      const res = await svc.login(dto, {});
      expect(res.orgRole).toBe('member');
      expect(res.organization.slug).toBe('org-1');
      expect(users.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: loginUser._id }),
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        expect.anything(),
      );
    });

    it('rejects unknown email, inactive user, and wrong password identically', async () => {
      users.findOne.mockReturnValue(q(null));
      await expect(svc.login(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);

      users.findOne.mockReturnValue(q({ ...loginUser, isActive: false }));
      await expect(svc.login(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);

      users.findOne.mockReturnValue(q(loginUser));
      mockCompare.mockResolvedValue(false);
      await expect(svc.login(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rejects unknown tokens', async () => {
      sessions.findOne.mockReturnValue(q(null));
      await expect(svc.refresh({ refreshToken: 'nope-token-value' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes the whole family on reuse of a rotated token', async () => {
      sessions.findOne.mockReturnValue(
        q({ _id: oid('000000000000000000000099'), familyId: 'f1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1000) }),
      );
      sessions.updateMany.mockResolvedValue({});
      await expect(
        svc.refresh({ refreshToken: 'reused-token-value' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'f1' }),
        expect.anything(),
      );
    });

    it('rotates exactly once: old revoked, new issued', async () => {
      sessions.findOne.mockReturnValue(
        q({
          _id: oid('000000000000000000000099'),
          familyId: 'f1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 3600_000),
          userId: oid(U1),
        }),
      );
      users.findById.mockReturnValue(q(userDoc));
      memberships.findOne.mockReturnValue(q({ organizationId: oid(O1), role: 'member' }));
      sessions.updateOne.mockResolvedValue({});
      sessions.create.mockResolvedValue([{}]);

      const res = await svc.refresh({ refreshToken: 'valid-token-value-123' });
      expect(res.accessToken.length).toBeGreaterThan(10);
      expect(res.refreshToken).not.toBe('valid-token-value-123');
      expect(sessions.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
        expect.anything(),
      );
    });
  });

  describe('changePassword', () => {
    it('rejects wrong current password', async () => {
      users.findById.mockReturnValue(q(userDoc));
      mockCompare.mockResolvedValue(false);
      await expect(
        svc.changePassword(U1, { currentPassword: 'Wrong123', newPassword: 'NewSecret123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates hash and revokes all sessions', async () => {
      users.findById.mockReturnValue(q(userDoc));
      mockCompare.mockResolvedValue(true);
      users.updateOne.mockResolvedValue({});
      sessions.updateMany.mockResolvedValue({});

      await svc.changePassword(U1, { currentPassword: 'Secret123', newPassword: 'NewSecret123' });
      expect(users.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ passwordHash: 'hashed-pw' }),
        expect.anything(),
      );
      expect(sessions.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: userDoc._id }),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
