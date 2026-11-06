import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();
  });

  it('renders the Ledgerline sign-in page', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl('/sign-in');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Invoicing and bank reconciliation',
    );
    expect(compiled.querySelector('h2')?.textContent).toBe('Sign in');
    expect(compiled.querySelector('input[type="email"]')).not.toBeNull();
    expect(compiled.querySelector('input[type="password"]')).not.toBeNull();
  });
});
