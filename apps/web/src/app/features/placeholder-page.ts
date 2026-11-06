import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Placeholder } from '../shared/placeholder';

@Component({
  selector: 'app-placeholder-page',
  imports: [Placeholder],
  template: `
    <header class="page-header">
      <p class="eyebrow">RonewaPay</p>
      <h1>{{ title }}</h1>
    </header>
    <app-placeholder [title]="title" [message]="message" />
  `,
  styles: `
    .page-header {
      margin-bottom: 24px;
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
      font-size: 32px;
    }
  `,
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = String(this.route.snapshot.data['title']);
  protected readonly message = String(this.route.snapshot.data['message']);
}
