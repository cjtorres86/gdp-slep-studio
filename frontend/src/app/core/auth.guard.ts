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
