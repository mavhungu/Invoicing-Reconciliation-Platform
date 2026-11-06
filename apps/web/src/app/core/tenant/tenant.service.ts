import { Injectable, computed, signal } from '@angular/core';
import { AccountRole } from '@invoice-reconciliation-platform/shared';
import { TenantMembership } from '../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly membershipsState = signal<TenantMembership[]>([]);
  private readonly activeTenantIdState = signal<string | null>(null);

  readonly memberships = this.membershipsState.asReadonly();
  readonly activeTenantId = this.activeTenantIdState.asReadonly();
  readonly activeTenant = computed(
    () =>
      this.membershipsState().find(
        (membership) => membership.tenantId === this.activeTenantIdState(),
      ) ?? null,
  );
  readonly activeRole = computed<AccountRole | null>(
    () => this.activeTenant()?.role ?? null,
  );

  setMemberships(memberships: TenantMembership[]): void {
    this.membershipsState.set(memberships);

    const activeId = this.activeTenantIdState();
    if (!memberships.some((membership) => membership.tenantId === activeId)) {
      this.activeTenantIdState.set(memberships[0]?.tenantId ?? null);
    }
  }

  setSession(memberships: TenantMembership[], activeTenantId: string): void {
    if (!memberships.some((membership) => membership.tenantId === activeTenantId)) {
      throw new Error('The active tenant is not present in the authenticated memberships.');
    }

    this.membershipsState.set(memberships);
    this.activeTenantIdState.set(activeTenantId);
  }

  setActiveTenant(tenantId: string): void {
    if (!this.membershipsState().some((membership) => membership.tenantId === tenantId)) {
      throw new Error(`Unknown tenant membership: ${tenantId}`);
    }

    this.activeTenantIdState.set(tenantId);
  }

  clear(): void {
    this.membershipsState.set([]);
    this.activeTenantIdState.set(null);
  }
}
