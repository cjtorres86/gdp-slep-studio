import { Routes } from '@angular/router';
import { administradorGuard, authGuard, publicoGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [publicoGuard], loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent) },
  {
    // Todas las páginas con sesión comparten el marco común (barra superior y pie).
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      {
        path: 'configuracion/usuarios',
        canActivate: [administradorGuard],
        loadComponent: () => import('./features/configuracion/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
