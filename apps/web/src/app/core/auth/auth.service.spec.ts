import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AuthSession } from './auth.models';
import { tokenInterceptor } from './token.interceptor';
import { TenantService } from '../tenant/tenant.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpClient;
  let controller: HttpTestingController;

  const firstSession: AuthSession = {
    accessToken: 'access-token-1',
    user: {
      id: 'user-1',
      email: 'owner@example.test',
      displayName: 'Owner',
    },
    memberships: [
      {
        tenantId: 'tenant-1',
        tenantName: 'Acme',
        role: 'owner',
      },
    ],
    activeTenant: {
      tenantId: 'tenant-1',
      tenantName: 'Acme',
      role: 'owner',
    },
  };

  const refreshedSession: AuthSession = {
    ...firstSession,
    accessToken: 'access-token-2',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('stores the login response and synchronizes tenant memberships', () => {
    auth.login({ email: 'owner@example.test', password: 'a-long-password' }).subscribe();

    const request = controller.expectOne('/api/auth/login');
    expect(request.request.withCredentials).toBe(true);
    request.flush(firstSession);

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('access-token-1');
    expect(auth.currentUser()?.email).toBe('owner@example.test');
    expect(TestBed.inject(TenantService).activeTenantId()).toBe('tenant-1');
    expect(TestBed.inject(TenantService).activeRole()).toBe('owner');
  });

  it('refreshes once after an API 401 and retries with the new access token', () => {
    auth.login({ email: 'owner@example.test', password: 'a-long-password' }).subscribe();
    controller.expectOne('/api/auth/login').flush(firstSession);

    let response: unknown;
    http.get('/api/customers').subscribe((value) => (response = value));

    const expiredRequest = controller.expectOne('/api/customers');
    expect(expiredRequest.request.headers.get('Authorization')).toBe(
      'Bearer access-token-1',
    );
    expiredRequest.flush(
      { message: 'Expired token' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const refreshRequest = controller.expectOne('/api/auth/refresh');
    expect(refreshRequest.request.withCredentials).toBe(true);
    refreshRequest.flush(refreshedSession);

    const retryRequest = controller.expectOne('/api/customers');
    expect(retryRequest.request.headers.get('Authorization')).toBe(
      'Bearer access-token-2',
    );
    retryRequest.flush([{ id: 'invoice-1' }]);

    expect(response).toEqual([{ id: 'invoice-1' }]);
    expect(auth.accessToken()).toBe('access-token-2');
  });

  it('clears local session state after logout, including when the request errors', () => {
    auth.login({ email: 'owner@example.test', password: 'a-long-password' }).subscribe();
    controller.expectOne('/api/auth/login').flush(firstSession);

    auth.logout().subscribe({ error: () => undefined });
    const request = controller.expectOne('/api/auth/logout');
    expect(request.request.withCredentials).toBe(true);
    request.flush(null, { status: 503, statusText: 'Unavailable' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(TestBed.inject(TenantService).memberships()).toEqual([]);
  });
});
