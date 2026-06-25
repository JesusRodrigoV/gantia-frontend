import { NgOptimizedImage } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '@core/stores/auth.store';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [NgOptimizedImage, LetrasGantia, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth.styles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Login implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  public readonly authStore = inject(AuthStore);
  router = inject(Router);
  showPassword = signal(false);

  ngOnInit(): void {
    this.authStore.clearError();
  }

  loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.authStore.login({
      email: email!,
      password: password!,
    });
  }
}
