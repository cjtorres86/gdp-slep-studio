import { NgTemplateOutlet } from '@angular/common';
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

  // Ventana "Marco legal" (se abre desde la franja de Documentación).
  readonly marcoAbierto = signal(false);
  private readonly ventanaMarco = viewChild<ElementRef<HTMLElement>>('ventanaMarco');
  private disparadorMarco: HTMLElement | null = null;

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.marcoAbierto);
  }

  cargar(): void {
    this.catalogo.cargar();
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
