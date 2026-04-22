import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LetrasGantia } from '@components/letras-gantia/letras-gantia';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [NgOptimizedImage, LetrasGantia, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export default class Login {
  private formBuilder = inject(FormBuilder);
  router = inject(Router);

  loginForm = this.formBuilder.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  onSubmit(): void {
    if (this.loginForm.valid) {
      const credenciales = this.loginForm.value;
      this.router.navigateByUrl('/app/sensores');
      console.log(credenciales);
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
