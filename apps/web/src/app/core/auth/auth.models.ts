import { AccountRole } from '@invoice-reconciliation-platform/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthenticatedUser;
  memberships: TenantMembership[];
  activeTenant: TenantMembership;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string;
}

export interface RegisterRequest extends LoginRequest {
  displayName: string;
  organizationName: string;
}

export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  role: AccountRole;
}
