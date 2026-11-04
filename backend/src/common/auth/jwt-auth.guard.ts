import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Model } from 'mongoose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Membership } from '../mongo/schemas/membership.schema';
import { User } from '../mongo/schemas/user.schema';
import { toObjectIdOrNull } from '../mongo/object-id';
import type { AuthenticatedUser, OrgRole } from './types';

interface AccessPayload {
  sub: string;
  orgId: string;
  email: string;
  orgRole: OrgRole;
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token;
}

/**
 * Global authentication guard (registered as APP_GUARD).
 * Skips @Public() routes. Verifies the access JWT, then re-reads the
 * membership from the database so deactivation / role changes / org removal
 * take effect within one access-token lifetime instead of lingering in claims.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException('توکن احراز هویت ارائه نشده است');

    let payload: AccessPayload;
    try {
      const verified: unknown = await this.jwt.verifyAsync(token, {
        secret: process.env['JWT_ACCESS_SECRET'],
      });
      payload = verified as AccessPayload;
    } catch {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است');
    }
    if (!payload?.sub || !payload?.orgId) throw new UnauthorizedException('توکن نامعتبر است');

    const orgObjectId = toObjectIdOrNull(payload.orgId);
    const userObjectId = toObjectIdOrNull(payload.sub);
    if (!orgObjectId || !userObjectId) throw new UnauthorizedException('توکن نامعتبر است');
    const membership = await this.membershipModel
      .findOne({ organizationId: orgObjectId, userId: userObjectId })
      .lean();
    if (!membership) throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است');
    const user = await this.userModel.findById(userObjectId).lean();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است');
    }
    req.user = {
      userId: user._id.toHexString(),
      email: user.email,
      orgId: membership.organizationId.toHexString(),
      orgRole: membership.role as OrgRole,
    };
    return true;
  }
}

/** Rejects any access attempt that escaped JwtAuthGuard without an identity. */
export function requireRequestUser(req: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!req.user) throw new ForbiddenException('دسترسی غیرمجاز');
  return req.user;
}
