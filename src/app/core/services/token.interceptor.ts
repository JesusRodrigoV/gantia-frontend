import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
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
        localStorage.removeItem('token');
        router.navigateByUrl('/auth/login');
      }
      return throwError(() => err);
    }),
  );
};
