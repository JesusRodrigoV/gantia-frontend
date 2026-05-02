import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '@core/stores/auth.store';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [NgOptimizedImage, LetrasGantia, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth.styles.scss',
})
export default class Login {
  private readonly formBuilder = inject(FormBuilder);
  public readonly authStore = inject(AuthStore);
  router = inject(Router);

  loginForm = this.formBuilder.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  onSubmit(): void {
    this.router.navigateByUrl('app');
    //   const { username, password } = this.loginForm.getRawValue();

    //   this.authStore.login({
    //     email: username!,
    //     password: password!,
    //   });
    // } else {
    //   this.loginForm.markAllAsTouched();
    // }
  }
}
