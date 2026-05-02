import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth-guard';
import { publicGuard } from '@core/guards/public-guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./core/layouts/public-layout/public-layout'),
    // canActivateChild: [publicGuard],
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
    loadComponent: () => import('./core/layouts/base-layout/base-layout'),
    // canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./components/hand-canvas/hand-canvas'),
      },
      {
        path: 'sensores',
        loadComponent: () => import('./features/private/sensores/sensores'),
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
