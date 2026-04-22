import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./core/layouts/public-layout/public-layout'),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/public/login/login'),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/public/register/register'),
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
    children: [
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
