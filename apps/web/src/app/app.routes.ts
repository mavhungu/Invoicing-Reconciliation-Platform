import { Route } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { Dashboard } from './features/dashboard/dashboard';
import { PlaceholderPage } from './features/placeholder-page';
import { SignIn } from './features/login/sign-in';
import { Shell } from './layout/shell';

export const appRoutes: Route[] = [
  { path: 'sign-in', component: SignIn, title: 'Sign in | RonewaPay' },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard, title: 'Dashboard | RonewaPay' },
      {
        path: 'invoices',
        component: PlaceholderPage,
        title: 'Invoices | RonewaPay',
        data: {
          title: 'Invoices',
          message: 'Your invoices will appear here once invoicing is connected.',
        },
      },
      {
        path: 'reconciliation',
        component: PlaceholderPage,
        title: 'Reconciliation | RonewaPay',
        data: {
          title: 'Reconciliation',
          message: 'Import bank statements to start matching transactions.',
        },
      },
      {
        path: 'settings',
        component: PlaceholderPage,
        canActivate: [roleGuard],
        title: 'Settings | RonewaPay',
        data: {
          roles: ['owner'],
          title: 'Settings',
          message: 'Organisation settings will be available here.',
        },
      },
    ],
  },
  { path: '**', redirectTo: 'sign-in' },
];
