import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth-guard';
import { publicGuard } from '@core/guards/public-guard';

export const routes: Routes = [
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
        path: 'sensores',
        loadComponent: () => import('./components/hand-canvas/hand-canvas'),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/private/sensores/sensores'),
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
        path: '',
        redirectTo: 'sensores',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
