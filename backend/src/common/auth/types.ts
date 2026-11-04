/** Organization-level roles. Single source of truth shared by guards and modules. */
export type OrgRole = 'org-admin' | 'member';

export const ORG_ROLES: readonly OrgRole[] = ['org-admin', 'member'];

/** Minimal identity attached to every authenticated request by JwtAuthGuard. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  orgId: string;
  orgRole: OrgRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
