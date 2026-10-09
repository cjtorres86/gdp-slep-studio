import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const haciaNuestroBackend = req.url.startsWith(environment.apiUrl);
  const conSesion = token && haciaNuestroBackend ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(conSesion).pipe(
    catchError((err: HttpErrorResponse) => {
      // Sesión vencida o cuenta desactivada: de vuelta al ingreso. (El
      // propio intento de login también devuelve 401 — ahí no se redirige,
      // se muestra el mensaje.)
      if (err.status === 401 && haciaNuestroBackend && !req.url.endsWith('/auth/login')) auth.logout();
      return throwError(() => err);
    }),
  );
};
