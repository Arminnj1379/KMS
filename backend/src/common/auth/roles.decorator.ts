import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from './types';

export const ROLES_KEY = 'kms_roles';

/**
 * Restricts a route to the given organization roles.
 * No metadata = any authenticated org member (JwtAuthGuard already enforces membership).
 */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
