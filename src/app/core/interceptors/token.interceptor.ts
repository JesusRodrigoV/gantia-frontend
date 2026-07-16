import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '@core/stores/auth.store';

const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  const token = authStore.token();

  let cloned = req;

  if (token) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(cloned).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const isAuthRoute = AUTH_ROUTES.some((r) => router.url.startsWith(r));
        if (!isAuthRoute) {
          authStore.logout();
        }
      }
      return throwError(() => err);
    }),
  );
};
