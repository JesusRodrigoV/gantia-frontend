import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '@core/stores/auth.store';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  const token = localStorage.getItem('token');

  let cloned = req;

  if (token) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(cloned).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        authStore.logout();
      }
      return throwError(() => err);
    }),
  );
};
