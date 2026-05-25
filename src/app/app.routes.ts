import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth-guard';
import { publicGuard } from '@core/guards/public-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    canActivateChild: [publicGuard],
    loadComponent: () => import('./core/layouts/public-layout/public-layout'),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/public/auth/login/login'),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/public/auth/register/register'),
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'app',
    canActivateChild: [authGuard],
    loadComponent: () => import('./core/layouts/base-layout/base-layout'),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/private/sensores/sensores'),
      },
      {
        path: 'visualizador',
        loadComponent: () => import('./components/hand-canvas/hand-canvas'),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/private/settings/settings'),
      },
      {
        path: 'config',
        loadComponent: () => import('./features/private/config/config'),
      },
      {
        path: 'history',
        loadComponent: () => import('./features/private/history/history'),
      },
      {
        path: 'not-found',
        loadComponent: () => import('./features/not-found/not-found'),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'not-found',
    loadComponent: () => import('./features/not-found/not-found'),
  },
  {
    path: '**',
    redirectTo: 'not-found',
  },
];
