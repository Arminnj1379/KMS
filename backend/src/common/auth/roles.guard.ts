import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import type { AuthenticatedUser, OrgRole } from './types';

/** Enforces @Roles() metadata against req.user.orgRole (set by JwtAuthGuard). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) throw new ForbiddenException('دسترسی غیرمجاز');
    if (!required.includes(req.user.orgRole)) throw new ForbiddenException('دسترسی غیرمجاز');
    return true;
  }
}
