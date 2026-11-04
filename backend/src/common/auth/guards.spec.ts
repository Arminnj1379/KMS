import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import type { Membership } from '../mongo/schemas/membership.schema';
import type { User } from '../mongo/schemas/user.schema';

const SECRET = 'guard-test-secret-at-least-32-chars!!';
const U1 = '000000000000000000000001';
const O1 = '000000000000000000000010';

function ctxWith(req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function q<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET });

  function makeGuard(publicRoute: boolean, membership: unknown, user: unknown) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(publicRoute);
    const membershipModel = {
      findOne: jest.fn().mockReturnValue(q(membership)),
    } as unknown as Model<Membership>;
    const userModel = {
      findById: jest.fn().mockReturnValue(q(user)),
    } as unknown as Model<User>;
    return new JwtAuthGuard(reflector, jwt, membershipModel, userModel);
  }

  it('skips @Public routes without a token', async () => {
    const guard = makeGuard(true, null, null);
    await expect(guard.canActivate(ctxWith({ headers: {} }))).resolves.toBe(true);
  });

  it('rejects missing and malformed tokens', async () => {
    const guard = makeGuard(false, null, null);
    await expect(guard.canActivate(ctxWith({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: 'Bearer bogus' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches org identity for valid tokens with active membership', async () => {
    process.env['JWT_ACCESS_SECRET'] = SECRET;
    const guard = makeGuard(
      false,
      { organizationId: new Types.ObjectId(O1), role: 'member' },
      { _id: new Types.ObjectId(U1), email: 'sara@example.com', isActive: true },
    );
    const token = await jwt.signAsync(
      { sub: U1, orgId: O1, orgRole: 'member', email: 'sara@example.com' },
      { secret: SECRET },
    );
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
    expect(req['user']).toMatchObject({ userId: U1, orgId: O1, orgRole: 'member' });
  });

  it('rejects when membership was removed or user deactivated', async () => {
    process.env['JWT_ACCESS_SECRET'] = SECRET;
    const token = await jwt.signAsync({ sub: U1, orgId: O1 }, { secret: SECRET });

    const noMembership = makeGuard(false, null, null);
    await expect(
      noMembership.canActivate(ctxWith({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const inactive = makeGuard(
      false,
      { organizationId: new Types.ObjectId(O1), role: 'member' },
      { _id: new Types.ObjectId(U1), email: 'sara@example.com', isActive: false },
    );
    await expect(
      inactive.canActivate(ctxWith({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard', () => {
  function makeGuard(required: string[] | undefined) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    return new RolesGuard(reflector);
  }

  it('passes when no roles are required', () => {
    expect(makeGuard(undefined).canActivate(ctxWith({ user: { orgRole: 'member' } }))).toBe(true);
  });

  it('allows org-admin and forbids member on admin routes', () => {
    const guard = makeGuard(['org-admin']);
    expect(guard.canActivate(ctxWith({ user: { orgRole: 'org-admin' } }))).toBe(true);
    expect(() => guard.canActivate(ctxWith({ user: { orgRole: 'member' } }))).toThrow(
      ForbiddenException,
    );
  });
});
