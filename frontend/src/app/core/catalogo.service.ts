import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { ModuloVista } from './models';

// Catálogo del portal (módulos y aplicaciones que ve esta persona). Se pide
// una vez y lo comparten el marco común (botón Configuración) y la pantalla
// de inicio (módulos).
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  readonly modulos = signal<ModuloVista[]>([]);
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly mensajeError = signal('');

  readonly configuracion = computed(() => this.modulos().find((m) => m.id === 'configuracion') ?? null);

  constructor(private readonly http: HttpClient) {}

  cargar(): void {
    this.estado.set('cargando');
    this.http.get<ModuloVista[]>(`${environment.apiUrl}/portal/catalogo`).subscribe({
      next: (m) => {
        this.modulos.set(m);
        this.estado.set('listo');
      },
      error: (err: HttpErrorResponse) => {
        this.mensajeError.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. Si el sistema estuvo un tiempo sin uso, espera un minuto y vuelve a intentar.'
            : typeof err.error?.message === 'string'
              ? err.error.message
              : 'No se pudieron cargar tus aplicaciones.',
        );
        this.estado.set('error');
      },
    });
  }
}
