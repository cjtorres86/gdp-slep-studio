import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { ModuloVista, RolPortal } from '../../core/models';

const ETIQUETA_ROL: Record<RolPortal, string> = {
  superadmin: 'Superadmin',
  admin: 'Administrador',
  usuario: 'Usuario',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly modulos = signal<ModuloVista[]>([]);
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly mensajeError = signal('');

  // La pantalla de inicio muestra los módulos de trabajo; Documentación va
  // aparte (separada por una línea) y Configuración ya no es una tarjeta:
  // vive en la barra superior. Todo sigue viniendo del catálogo del
  // backend, que decide qué ve cada persona.
  readonly principales = computed(() => this.modulos().filter((m) => m.id !== 'configuracion' && m.id !== 'documentacion'));
  readonly documentacion = computed(() => this.modulos().find((m) => m.id === 'documentacion') ?? null);
  readonly configuracion = computed(() => this.modulos().find((m) => m.id === 'configuracion') ?? null);

  // Ventana de Configuración y recuadro del marco legal.
  readonly configAbierta = signal(false);
  // Marco legal de Documentación: se ve mientras el mouse (o el foco del
  // teclado) está sobre el módulo; en celular, con un toque.
  readonly marcoAbierto = signal(false);
  private readonly zonaMarco = viewChild<ElementRef<HTMLElement>>('zonaMarco');
  private readonly botonConfig = viewChild<ElementRef<HTMLButtonElement>>('botonConfig');
  private readonly ventanaConfig = viewChild<ElementRef<HTMLElement>>('ventanaConfig');

  constructor(
    readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  private cerrarMarco(): void {
    this.marcoAbierto.set(false);
  }

  // Con el teclado: se cierra cuando el foco sale del módulo.
  alSalirFoco(e: FocusEvent): void {
    if (!this.zonaMarco()?.nativeElement.contains(e.relatedTarget as Node)) this.cerrarMarco();
  }

  // Con mouse, el marco legal se ve mientras el puntero está encima. Con el
  // dedo no existe "pasar encima": ahí se abre y cierra con un toque. Se
  // distinguen porque el teléfono, al tocar, también simula "mouse encima",
  // y sin esta separación se abriría y cerraría en el mismo toque.
  ultimoPuntero = '';

  alEntrarPuntero(e: PointerEvent): void {
    if (e.pointerType === 'mouse') this.marcoAbierto.set(true);
  }

  alSalirPuntero(e: PointerEvent): void {
    if (e.pointerType === 'mouse') this.marcoAbierto.set(false);
  }

  alTocarModulo(e: MouseEvent): void {
    if (this.ultimoPuntero === 'mouse' || (e.target as HTMLElement).closest('a')) return;
    this.marcoAbierto.set(!this.marcoAbierto());
  }

  // Un toque fuera del módulo lo cierra.
  @HostListener('document:click', ['$event'])
  alHacerClic(e: MouseEvent): void {
    if (this.marcoAbierto() && !this.zonaMarco()?.nativeElement.contains(e.target as Node)) this.cerrarMarco();
  }

  irInicio(): void {
    this.configAbierta.set(false);
    this.cerrarMarco();
    this.router.navigateByUrl('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  abrirConfig(): void {
    this.cerrarMarco();
    this.configAbierta.set(true);
    // Al abrir, el foco entra a la ventana (para teclado y lectores de pantalla).
    setTimeout(() => this.ventanaConfig()?.nativeElement.querySelector<HTMLElement>('[data-cerrar]')?.focus());
  }

  cerrarConfig(): void {
    if (!this.configAbierta()) return;
    this.configAbierta.set(false);
    // Al cerrar, el foco vuelve al botón que la abrió.
    setTimeout(() => this.botonConfig()?.nativeElement.focus());
  }

  @HostListener('document:keydown', ['$event'])
  alPresionarTecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.configAbierta()) this.cerrarConfig();
      else this.cerrarMarco();
      return;
    }
    // Con la ventana abierta, Tab recorre solo lo que hay dentro de ella.
    if (e.key === 'Tab' && this.configAbierta()) {
      const ventana = this.ventanaConfig()?.nativeElement;
      if (!ventana) return;
      const enfocables = Array.from(ventana.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (!enfocables.length) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  }

  ngOnInit(): void {
    this.cargar();
  }

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

  etiquetaRol(rol: RolPortal | undefined): string {
    return rol ? ETIQUETA_ROL[rol] : '';
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
