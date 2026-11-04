import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../prisma/prisma.service';

const SECRET = 'guard-test-secret-at-least-32-chars!!';

function ctxWith(req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET });

  function makeGuard(publicRoute: boolean, membership: unknown) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(publicRoute);
    const prisma = {
      membership: { findUnique: jest.fn().mockResolvedValue(membership) },
    } as unknown as PrismaService;
    return new JwtAuthGuard(reflector, jwt, prisma);
  }

  it('skips @Public routes without a token', async () => {
    const guard = makeGuard(true, null);
    await expect(guard.canActivate(ctxWith({ headers: {} }))).resolves.toBe(true);
  });

  it('rejects missing and malformed tokens', async () => {
    const guard = makeGuard(false, null);
    await expect(guard.canActivate(ctxWith({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: 'Bearer bogus' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches org identity for valid tokens with active membership', async () => {
    // Single secret for signing and verification (env is shared per worker).
    process.env['JWT_ACCESS_SECRET'] = SECRET;
    const guard = makeGuard(false, {
      organizationId: 'o1',
      role: 'member',
      user: { id: 'u1', email: 'sara@example.com', isActive: true },
    });
    const token = await jwt.signAsync(
      { sub: 'u1', orgId: 'o1', orgRole: 'member', email: 'sara@example.com' },
      { secret: SECRET },
    );
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
    expect(req['user']).toMatchObject({ userId: 'u1', orgId: 'o1', orgRole: 'member' });
  });

  it('rejects when membership was removed', async () => {
    process.env['JWT_ACCESS_SECRET'] = SECRET;
    const guard = makeGuard(false, null);
    const token = await jwt.signAsync({ sub: 'u1', orgId: 'o1' }, { secret: SECRET });
    await expect(
      guard.canActivate(ctxWith({ headers: { authorization: `Bearer ${token}` } })),
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
