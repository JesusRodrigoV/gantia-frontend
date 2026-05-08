import { computed, inject } from '@angular/core';
import { signalStore, patchState, withMethods, withState, withComputed } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth';
import { Router } from '@angular/router';
import { AuthRequest } from '@core/models/auth.model';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    isAuthenticated: computed(() => !!state.token()),
  })),
  withMethods((store, authService = inject(AuthService), router = inject(Router)) => ({
    login: rxMethod<AuthRequest>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((credentials) =>
          authService.login(credentials).pipe(
            tap((res) => {
              localStorage.setItem('token', res.access_token);
              patchState(store, { token: res.access_token, isLoading: false });
              router.navigateByUrl('/app/sensores');
            }),
            catchError((err) => {
              const detail = err.error?.detail;
              const message =
                typeof detail === 'string'
                  ? detail
                  : detail?.[0]?.msg || 'Error de autenticación';
              patchState(store, {
                isLoading: false,
                error: message,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),
    register: rxMethod<AuthRequest>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((credentials) =>
          authService.register(credentials).pipe(
            tap(() => {
              patchState(store, { isLoading: false });
              router.navigateByUrl('/auth/login');
            }),
            catchError((err) => {
              const detail = err.error?.detail;
              const message =
                typeof detail === 'string'
                  ? detail
                  : detail?.[0]?.msg || 'Error en el registro';
              patchState(store, {
                isLoading: false,
                error: message,
              });
              return of(null);
            }),
          ),
        ),
      ),
    ),
    logout() {
      localStorage.removeItem('token');
      patchState(store, { token: null });
      router.navigateByUrl('/auth/login');
    },
  })),
);
