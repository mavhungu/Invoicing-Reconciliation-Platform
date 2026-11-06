import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

type FormMode = 'login' | 'register';

@Component({
  selector: 'app-sign-in',
  imports: [FormsModule],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode = signal<FormMode>('login');
  protected readonly busy = signal(false);
  protected readonly message = signal('');

  protected onSubmit(form: NgForm): void {
    if (form.invalid || this.busy()) {
      form.control.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.message.set('');
    const values = form.value as {
      email: string;
      password: string;
      displayName?: string;
      organizationName?: string;
    };
    const request =
      this.mode() === 'register'
        ? this.auth.register({
            email: values.email,
            password: values.password,
            displayName: values.displayName ?? '',
            organizationName: values.organizationName ?? '',
          })
        : this.auth.login({
            email: values.email,
            password: values.password,
          });

    request.subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl(this.getReturnUrl());
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.message.set(this.getErrorMessage(error));
      },
    });
  }

  protected setMode(mode: FormMode): void {
    this.mode.set(mode);
    this.message.set('');
  }

  private getReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
      ? returnUrl
      : '/dashboard';
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to reach the server. Please try again.';
    }

    const serverMessage = error.error?.message;
    if (Array.isArray(serverMessage)) {
      return serverMessage.join(' ');
    }
    if (typeof serverMessage === 'string') {
      return serverMessage;
    }

    if (error.status === 0 || error.status >= 500) {
      return 'The service is temporarily unavailable. Please try again.';
    }
    return 'Unable to authenticate with those details.';
  }
}
