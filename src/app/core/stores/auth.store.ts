import { computed, inject } from '@angular/core';
import { signalStore, patchState, withMethods, withState, withComputed } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../services/auth';
import { SoundService } from '../services/sound.service';
import { Router } from '@angular/router';
import { AuthRequest } from '@core/models/auth.model';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isLoading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    isAuthenticated: computed(() => !!state.token()),
  })),
  withMethods((store, authService = inject(AuthService), router = inject(Router), messageService = inject(MessageService), soundService = inject(SoundService)) => ({
    login: rxMethod<AuthRequest>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap((credentials) =>
          authService.login(credentials).pipe(
            tap((res) => {
              localStorage.setItem('token', res.access_token);
              localStorage.setItem('refreshToken', res.refresh_token);
              patchState(store, { token: res.access_token, refreshToken: res.refresh_token, isLoading: false });
              soundService.play('success');
              messageService.add({ severity: 'success', summary: 'Bienvenido', detail: 'Inicio de sesión exitoso', life: 2000 });
              router.navigateByUrl('/app/dashboard');
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
              soundService.play('success');
              messageService.add({ severity: 'success', summary: 'Registrado', detail: 'Tu cuenta se creó correctamente. Ahora iniciá sesión.', life: 4000 });
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
      localStorage.removeItem('refreshToken');
      patchState(store, { token: null, refreshToken: null });
      router.navigateByUrl('/auth/login');
    },
    refresh: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap(() => {
          const rt = store.refreshToken();
          if (!rt) {
            patchState(store, { isLoading: false });
            return of(null);
          }
          return authService.refresh(rt).pipe(
            tap((res) => {
              localStorage.setItem('token', res.access_token);
              localStorage.setItem('refreshToken', res.refresh_token);
              patchState(store, { token: res.access_token, refreshToken: res.refresh_token, isLoading: false });
            }),
            catchError(() => {
              store.logout();
              return of(null);
            }),
          );
        }),
      ),
    ),
    clearError() {
      patchState(store, { error: null });
    },
  })),
);
