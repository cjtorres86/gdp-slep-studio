import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginRespuesta, UsuarioPortal } from './models';

const CLAVE_TOKEN = 'gdp_studio_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<UsuarioPortal | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  token(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  login(usuario: string, contrasena: string): Observable<LoginRespuesta> {
    return this.http.post<LoginRespuesta>(`${environment.apiUrl}/auth/login`, { usuario, contrasena }).pipe(
      tap((r) => {
        localStorage.setItem(CLAVE_TOKEN, r.accessToken);
        this.usuario.set(r.usuario);
      }),
    );
  }

  // Al recargar la página la sesión sigue viva: si hay un token guardado,
  // se le pregunta al servidor quién es (y si todavía es válido).
  restaurarSesion(): Observable<boolean> {
    if (this.usuario()) return of(true);
    if (!this.token()) return of(false);
    return this.http.get<UsuarioPortal>(`${environment.apiUrl}/auth/me`).pipe(
      tap((u) => this.usuario.set(u)),
      map(() => true),
      catchError(() => {
        this.limpiar();
        return of(false);
      }),
    );
  }

  logout(): void {
    // Deja la salida registrada en la Bitácora (si el servidor no responde,
    // se sale igual: la sesión vive en este navegador).
    if (localStorage.getItem(CLAVE_TOKEN)) {
      this.http.post(`${environment.apiUrl}/auth/salir`, {}).subscribe({ error: () => undefined });
    }
    this.limpiar();
    this.router.navigate(['/login']);
  }

  private limpiar(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    this.usuario.set(null);
  }
}
