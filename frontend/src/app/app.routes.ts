import { Routes } from '@angular/router';
import { authGuard, publicoGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [publicoGuard], loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent) },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
  { path: '**', redirectTo: '' },
];
