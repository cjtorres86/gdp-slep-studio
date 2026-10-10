import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AplicacionVista } from '../../core/models';
import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CatalogoService } from '../../core/catalogo.service';
import { atraparTab } from '../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../core/bloquear-fondo';

// Pantalla de inicio: los módulos de trabajo y, aparte (separado por una
// línea), Documentación. Configuración vive en la barra superior (marco
// común). Todo viene del catálogo del backend, que decide qué ve cada persona.
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private readonly catalogo = inject(CatalogoService);
  readonly modulos = this.catalogo.modulos;
  readonly estado = this.catalogo.estado;
  readonly mensajeError = this.catalogo.mensajeError;
  readonly principales = computed(() => this.modulos().filter((m) => m.id !== 'configuracion' && m.id !== 'documentacion'));
  readonly documentacion = computed(() => this.modulos().find((m) => m.id === 'documentacion') ?? null);

  // Error al abrir una aplicación integrada (ej. el servidor estaba dormido).
  readonly errorApertura = signal('');

  // Ventana "Marco legal" (se abre desde la franja de Documentación).
  readonly marcoAbierto = signal(false);
  private readonly ventanaMarco = viewChild<ElementRef<HTMLElement>>('ventanaMarco');
  private disparadorMarco: HTMLElement | null = null;

  private readonly http = inject(HttpClient);

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.marcoAbierto);
  }

  cargar(): void {
    this.catalogo.cargar();
  }

  // Ingreso único: en una aplicación integrada, la tarjeta pide al portal un
  // pase de un solo uso y abre la aplicación con él (sin volver a escribir la
  // clave). La pestaña se abre en el mismo instante del clic —si se abriera
  // después de esperar al servidor, el navegador la bloquearía como ventana
  // emergente— y se dirige a la aplicación apenas llega el pase.
  entrar(e: MouseEvent, a: AplicacionVista): void {
    if (!a.ingresoUnico) return; // enlace normal (ej. Documentación)
    e.preventDefault();
    this.errorApertura.set('');
    const pestana = window.open('', '_blank');
    if (pestana) {
      pestana.document.title = a.nombre;
      pestana.document.body.innerHTML = `<p style="font-family:system-ui,sans-serif;color:#25306B;padding:2.5rem;font-size:15px">Abriendo ${a.nombre}…</p>`;
    }
    this.http.post<{ url: string }>(`${environment.apiUrl}/ingreso-unico/pase`, { aplicacionId: a.id }).subscribe({
      next: ({ url }) => {
        if (pestana) {
          pestana.opener = null; // la aplicación no puede tocar la pestaña del portal
          pestana.location.href = url;
        } else {
          window.location.href = url; // el navegador no dejó abrir pestaña: se abre aquí mismo
        }
      },
      error: (err: HttpErrorResponse) => {
        pestana?.close();
        this.errorApertura.set(
          err.status === 0
            ? `No se pudo abrir ${a.nombre}: el servidor no respondió. Espera un minuto y vuelve a intentar.`
            : (err.error?.message ?? `No se pudo abrir ${a.nombre}.`),
        );
      },
    });
  }

  abrirMarco(e: Event): void {
    this.disparadorMarco = e.currentTarget as HTMLElement;
    this.marcoAbierto.set(true);
    setTimeout(() => this.ventanaMarco()?.nativeElement.querySelector<HTMLElement>('[data-cerrar]')?.focus());
  }

  cerrarMarco(): void {
    if (!this.marcoAbierto()) return;
    this.marcoAbierto.set(false);
    setTimeout(() => this.disparadorMarco?.focus());
  }

  @HostListener('document:keydown', ['$event'])
  alPresionarTecla(e: KeyboardEvent): void {
    if (!this.marcoAbierto()) return;
    if (e.key === 'Escape') this.cerrarMarco();
    else atraparTab(e, this.ventanaMarco()?.nativeElement);
  }

  // "todos" o una lista de SLEP, en una línea corta.
  textoAlcance(alcance: string[] | null): string {
    if (!alcance?.length) return '';
    if (alcance.includes('todos')) return 'Todos los SLEP';
    return alcance.length <= 2 ? alcance.join(', ') : `${alcance.slice(0, 2).join(', ')} +${alcance.length - 2}`;
  }

  cantidad(n: number): string {
    return `${n} ${n === 1 ? 'aplicación' : 'aplicaciones'}`;
  }
}
