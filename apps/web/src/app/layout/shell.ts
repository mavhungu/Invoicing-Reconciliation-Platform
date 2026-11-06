import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccountRole } from '@invoice-reconciliation-platform/shared';
import { AuthService } from '../core/auth/auth.service';
import { TenantService } from '../core/tenant/tenant.service';
import { Icon, IconName } from '../shared/icon';

interface NavigationItem {
  label: string;
  path: string;
  icon: IconName;
  roles: AccountRole[];
}

@Component({
  selector: 'app-shell',
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly tenant = inject(TenantService);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly displayName = computed(
    () => this.auth.currentUser()?.displayName || this.auth.currentUser()?.email || 'Account',
  );
  protected readonly navigationItems: NavigationItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', roles: ['owner', 'accountant', 'viewer'] },
    { label: 'Invoices', path: '/invoices', icon: 'invoices', roles: ['owner', 'accountant', 'viewer'] },
    { label: 'Reconciliation', path: '/reconciliation', icon: 'reconciliation', roles: ['owner', 'accountant', 'viewer'] },
    { label: 'Settings', path: '/settings', icon: 'settings', roles: ['owner'] },
  ];
  protected readonly visibleNavigationItems = computed(() => {
    const role = this.tenant.activeRole();
    return this.navigationItems.filter((item) => role && item.roles.includes(role));
  });

  protected onTenantChange(tenantId: string): void {
    if (!tenantId || tenantId === this.tenant.activeTenantId() || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.message.set('');
    this.auth.selectTenant(tenantId).subscribe({
      next: () => {
        this.busy.set(false);
        if (this.router.url.startsWith('/settings') && this.tenant.activeRole() !== 'owner') {
          void this.router.navigate(['/dashboard']);
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(this.getErrorMessage(error));
      },
    });
  }

  protected signOut(): void {
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    this.message.set('');
    this.auth.logout().subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/sign-in']);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(this.getErrorMessage(error));
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500) {
      return 'The request could not be completed. Please try again.';
    }

    const message = error.error?.message;
    return typeof message === 'string'
      ? message
      : 'The request could not be completed. Please try again.';
  }
}
