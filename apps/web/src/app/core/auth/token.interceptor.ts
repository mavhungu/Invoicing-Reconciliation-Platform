import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const AUTH_ENDPOINTS_WITHOUT_ACCESS_TOKEN = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];

const AUTH_ENDPOINTS_WITHOUT_RETRY = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];

export const AUTH_REFRESH_RETRIED = new HttpContextToken<boolean>(() => false);

export const tokenInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isApiRequest = request.url.startsWith('/api/');
  const isPublicAuthRequest = AUTH_ENDPOINTS_WITHOUT_ACCESS_TOKEN.some((path) =>
    request.url.startsWith(path),
  );
  const token = isApiRequest && !isPublicAuthRequest ? auth.accessToken() : null;

  if (!token || request.headers.has('Authorization')) {
    return next(request);
  }

  const authorizedRequest = request.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        request.context.get(AUTH_REFRESH_RETRIED) ||
        AUTH_ENDPOINTS_WITHOUT_RETRY.some((path) => request.url.startsWith(path))
      ) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap((session) =>
          next(
            request.clone({
              context: request.context.set(AUTH_REFRESH_RETRIED, true),
              setHeaders: { Authorization: `Bearer ${session.accessToken}` },
            }),
          ),
        ),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
