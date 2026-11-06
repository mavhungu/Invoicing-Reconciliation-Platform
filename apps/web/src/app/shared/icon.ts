import { Component, input } from '@angular/core';

export type IconName = 'dashboard' | 'invoices' | 'reconciliation' | 'settings' | 'logout';

@Component({
  selector: 'app-icon',
  template: `
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('dashboard') {
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        }
        @case ('invoices') {
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5M9 13h7M9 17h7" />
        }
        @case ('reconciliation') {
          <path d="M20 7h-5V2M4 17h5v5" />
          <path d="M5.6 9A7 7 0 0 1 18 5l2 2M4 17l2 2a7 7 0 0 0 12.4-4" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" />
        }
        @case ('logout') {
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
