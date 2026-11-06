import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { AuthSession, LoginRequest, RegisterRequest } from './auth.models';

export interface AuthenticatedProfile {
  user: AuthSession['user'];
  memberships: AuthSession['memberships'];
  activeTenant: AuthSession['activeTenant'];
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiClient);

  login(request: LoginRequest) {
    return this.api.post<AuthSession>('/auth/login', request, {
      withCredentials: true,
    });
  }

  register(request: RegisterRequest) {
    return this.api.post<AuthSession>('/auth/register', request, {
      withCredentials: true,
    });
  }

  refresh() {
    return this.api.post<AuthSession>(
      '/auth/refresh',
      {},
      { withCredentials: true },
    );
  }

  logout() {
    return this.api.post<void>('/auth/logout', {}, { withCredentials: true });
  }

  selectTenant(tenantId: string) {
    return this.api.post<AuthSession>(
      '/auth/tenant',
      { tenantId },
      { withCredentials: true },
    );
  }

  me() {
    return this.api.get<AuthenticatedProfile>('/auth/me');
  }
}
