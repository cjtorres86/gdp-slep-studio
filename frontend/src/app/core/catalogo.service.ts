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

  // El botón Configuración de la barra superior: solo con las opciones a las
  // que la persona puede entrar (el catálogo ahora trae todo, para todos).
  readonly configuracion = computed(() => {
    const m = this.modulos().find((x) => x.id === 'configuracion');
    const aplicaciones = m?.aplicaciones.filter((a) => a.autorizado) ?? [];
    return m && aplicaciones.length ? { ...m, aplicaciones } : null;
  });

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
