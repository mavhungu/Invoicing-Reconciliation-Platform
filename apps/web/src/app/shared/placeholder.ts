import { Component, input } from '@angular/core';

@Component({
  selector: 'app-placeholder',
  template: `
    <section class="placeholder">
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
    </section>
  `,
  styles: `
    .placeholder {
      padding: 28px;
      border: 1px dashed var(--color-border);
      border-radius: 12px;
      color: var(--color-muted);
      background: var(--color-surface);
    }

    h2 {
      margin: 0 0 8px;
      color: var(--color-text);
      font-size: 18px;
    }

    p {
      margin: 0;
    }
  `,
})
export class Placeholder {
  readonly title = input.required<string>();
  readonly message = input('This section is not available yet.');
}
