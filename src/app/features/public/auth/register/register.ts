import { NgOptimizedImage } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthStore } from '@core/stores/auth.store';

@Component({
  selector: 'app-register',
  imports: [NgOptimizedImage, LetrasGantia, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../auth.styles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Register implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  public readonly authStore = inject(AuthStore);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  ngOnInit(): void {
    this.authStore.clearError();
  }

  registerForm = this.formBuilder.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordsMatch },
  );

  onSubmit(): void {
    if (this.registerForm.valid) {
      const { email, password } = this.registerForm.getRawValue();

      this.authStore.register({
        email: email!,
        password: password!,
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }

  private passwordsMatch(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }
}
