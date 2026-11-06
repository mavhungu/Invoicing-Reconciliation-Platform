import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import {
  AuthSession,
  AuthenticatedUser,
  LoginRequest,
  RegisterRequest,
} from './auth.models';
import { TenantService } from '../tenant/tenant.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly tenant = inject(TenantService);
  private readonly sessionState = signal<AuthSession | null>(null);
  private refreshRequest: Observable<AuthSession> | null = null;

  readonly session = this.sessionState.asReadonly();
  readonly currentUser = computed<AuthenticatedUser | null>(
    () => this.sessionState()?.user ?? null,
  );
  readonly accessToken = computed(() => this.sessionState()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  login(request: LoginRequest): Observable<AuthSession> {
    return this.authApi.login(request).pipe(tap((session) => this.setSession(session)));
  }

  register(request: RegisterRequest): Observable<AuthSession> {
    return this.authApi
      .register(request)
      .pipe(tap((session) => this.setSession(session)));
  }

  refreshSession(): Observable<AuthSession> {
    if (this.refreshRequest) {
      return this.refreshRequest;
    }

    this.refreshRequest = this.authApi.refresh().pipe(
      tap((session) => this.setSession(session)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearSession();
        }
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.refreshRequest;
  }

  restoreSession(): Observable<AuthSession | null> {
    if (this.sessionState()) {
      return of(this.sessionState());
    }

    return this.refreshSession().pipe(
      map((session) => session),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return of(null);
        }
        return throwError(() => error);
      }),
    );
  }

  selectTenant(tenantId: string): Observable<AuthSession> {
    return this.authApi
      .selectTenant(tenantId)
      .pipe(tap((session) => this.setSession(session)));
  }

  logout(): Observable<void> {
    return this.authApi
      .logout()
      .pipe(finalize(() => this.clearSession()));
  }

  clearSession(): void {
    this.sessionState.set(null);
    this.tenant.clear();
  }

  private setSession(session: AuthSession): void {
    this.sessionState.set(session);
    this.tenant.setSession(
      session.memberships,
      session.activeTenant.tenantId,
    );
  }
}
