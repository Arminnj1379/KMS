import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from './types';

/**
 * Extracts the authenticated user attached by JwtAuthGuard.
 * Must only be used on non-@Public routes (guard guarantees presence).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user) throw new Error('CurrentUser used without JwtAuthGuard');
    return req.user;
  },
);
