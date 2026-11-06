import type { AccountRole } from '../generated/prisma/enums';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  tenantId: string;
}

export interface AuthenticatedRequestUser extends AccessTokenClaims {
  role: AccountRole;
}

export interface MembershipSummary {
  tenantId: string;
  tenantName: string;
  role: AccountRole;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  memberships: MembershipSummary[];
  activeTenant: MembershipSummary;
}
