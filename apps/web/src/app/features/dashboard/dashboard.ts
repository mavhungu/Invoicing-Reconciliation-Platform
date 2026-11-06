import { Component } from '@angular/core';
import { Placeholder } from '../../shared/placeholder';

@Component({
  selector: 'app-dashboard',
  imports: [Placeholder],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Overview</p>
        <h1>Dashboard</h1>
        <p class="subtitle">Your invoicing and reconciliation at a glance.</p>
      </div>
      <span class="period">This month</span>
    </header>

    <section class="summary-grid" aria-label="Monthly summary">
      <article class="summary-card">
        <span>Outstanding invoices</span>
        <strong>—</strong>
        <small>Invoice data will appear here</small>
      </article>
      <article class="summary-card">
        <span>Payments received</span>
        <strong>—</strong>
        <small>Payment data will appear here</small>
      </article>
      <article class="summary-card">
        <span>Unmatched transactions</span>
        <strong>—</strong>
        <small>Import a statement to get started</small>
      </article>
    </section>

    <app-placeholder
      title="Your workspace is ready"
      message="Invoices, bank statements, and reconciliation activity will appear here once connected."
    />
  `,
  styles: `
    :host {
      display: block;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 30px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: var(--color-brand);
      font-size: 13px;
      font-weight: 650;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: var(--color-text);
      font-size: clamp(28px, 4vw, 36px);
      letter-spacing: -1px;
    }

    .subtitle {
      margin: 10px 0 0;
      color: var(--color-muted);
    }

    .period {
      padding: 9px 12px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-muted);
      background: var(--color-surface);
      font-size: 13px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      display: grid;
      min-height: 135px;
      align-content: space-between;
      gap: 14px;
      padding: 20px;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      background: var(--color-surface);
    }

    .summary-card span,
    .summary-card small {
      color: var(--color-muted);
      font-size: 13px;
    }

    .summary-card strong {
      color: var(--color-text);
      font-size: 26px;
    }

    @media (max-width: 720px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .page-header {
        align-items: center;
      }
    }
  `,
})
export class Dashboard {}
