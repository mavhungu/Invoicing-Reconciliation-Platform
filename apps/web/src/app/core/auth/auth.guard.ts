import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AccountRole } from '@invoice-reconciliation-platform/shared';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { TenantService } from '../tenant/tenant.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (auth.isAuthenticated()) {
    return true;
  }

  const signIn = router.createUrlTree(['/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
  if (!isPlatformBrowser(platformId)) {
    return signIn;
  }

  return auth.restoreSession().pipe(
    map((session) => (session ? true : signIn)),
  );
};

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenant = inject(TenantService);
  const allowedRoles = route.data['roles'] as AccountRole[] | undefined;

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/sign-in']);
  }

  const activeRole = tenant.activeRole();
  if (!allowedRoles?.length || (activeRole && allowedRoles.includes(activeRole))) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
