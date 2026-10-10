import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

// Solo con sesión: si no hay, va al ingreso.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .restaurarSesion()
    .pipe(map((ok) => ok || router.createUrlTree(['/login'])));
};

// Pantalla de ingreso: si ya hay sesión, no tiene sentido mostrarla.
export const publicoGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .restaurarSesion()
    .pipe(map((ok) => (ok ? router.createUrlTree(['/']) : true)));
};

// Solo Admin y Superadmin del portal (ej. "Usuarios y accesos"). La
// verificación que de verdad importa la hace el backend en cada petición.
export const administradorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  return auth.restaurarSesion().pipe(
    map((ok) => {
      const rol = auth.usuario()?.rolPortal;
      return ok && (rol === 'admin' || rol === 'superadmin') ? true : router.createUrlTree(['/']);
    }),
  );
};
