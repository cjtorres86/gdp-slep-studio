import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CAMBIO_IMAGEN_MS, FONDOS, FONDO_INSTITUCIONAL, FondoPortal, fondoPorId } from '../../core/fondos';
import { PanelConfigService } from '../../core/panel-config.service';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CatalogoService } from '../../core/catalogo.service';
import { RolPortal } from '../../core/models';
import { atraparTab } from '../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../core/bloquear-fondo';

const ETIQUETA_ROL: Record<RolPortal, string> = {
  superadmin: 'Superadmin',
  admin: 'Administrador',
  usuario: 'Usuario',
};

// Marco común de todas las páginas con sesión: barra superior (Inicio,
// Configuración, persona, Salir), la página actual y el pie.
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit {
  private readonly catalogo = inject(CatalogoService);
  readonly configuracion = this.catalogo.configuracion;
  private readonly panel = inject(PanelConfigService);
  readonly configAbierta = this.panel.abierto;
  // ¿Estamos en el inicio (asistente)? Ahí la página mide el alto de la ventana y no lleva pie.
  private readonly router = inject(Router);
  readonly enInicio = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0] === '/'),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] === '/' },
  );
  private readonly botonConfig = viewChild<ElementRef<HTMLButtonElement>>('botonConfig');
  private readonly ventanaConfig = viewChild<ElementRef<HTMLElement>>('ventanaConfig');
  private readonly http = inject(HttpClient);

  // ---------- Configuración → Vista: fondo de pantalla de cada persona ----------
  readonly FONDOS = FONDOS;
  readonly FONDO_INSTITUCIONAL = FONDO_INSTITUCIONAL;
  readonly fondo = computed<FondoPortal | null>(() => fondoPorId(this.auth.usuario()?.fondo));
  readonly guardandoFondo = signal(false);
  // Los fondos con varias imágenes las pasan cada 7 s (el de la pantalla y las
  // miniaturas de la galería avanzan juntos).
  readonly tic = signal(0);
  readonly indiceImagen = (f: FondoPortal): number => this.tic() % f.imagenes.length;

  // Galería en carrusel: flechas a los lados (y deslizar con el dedo o el trackpad).
  private readonly carrusel = viewChild<ElementRef<HTMLElement>>('carrusel');
  readonly puedeIzquierda = signal(false);
  readonly puedeDerecha = signal(true);

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.configAbierta);
    const reloj = setInterval(() => this.tic.update((t) => t + 1), CAMBIO_IMAGEN_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    // Al abrir la ventana: la tarjeta elegida queda a la vista en el carrusel.
    effect(() => {
      if (!this.configAbierta()) return;
      setTimeout(() => {
        const c = this.carrusel()?.nativeElement;
        const elegida = c?.querySelector<HTMLElement>('.opcion-fondo.elegida');
        if (c && elegida) c.scrollLeft = elegida.offsetLeft - c.offsetLeft - (c.clientWidth - elegida.offsetWidth) / 2;
        this.alDesplazarCarrusel();
      });
    });
  }

  moverCarrusel(direccion: 1 | -1): void {
    const c = this.carrusel()?.nativeElement;
    if (c) c.scrollBy({ left: direccion * c.clientWidth, behavior: 'smooth' });
  }

  alDesplazarCarrusel(): void {
    const c = this.carrusel()?.nativeElement;
    if (!c) return;
    this.puedeIzquierda.set(c.scrollLeft > 2);
    this.puedeDerecha.set(c.scrollLeft + c.clientWidth < c.scrollWidth - 2);
  }

  // Se aplica al instante y se guarda en la cuenta (la sigue en cualquier
  // computador). Si no se pudo guardar, vuelve al anterior.
  elegirFondo(id: string | null): void {
    const u = this.auth.usuario();
    if (!u || (u.fondo ?? null) === id) return;
    const anterior = u.fondo ?? null;
    this.auth.usuario.set({ ...u, fondo: id });
    this.guardandoFondo.set(true);
    this.http.patch(`${environment.apiUrl}/auth/vista`, { fondo: id }).subscribe({
      next: () => this.guardandoFondo.set(false),
      error: () => {
        this.guardandoFondo.set(false);
        const actual = this.auth.usuario();
        if (actual) this.auth.usuario.set({ ...actual, fondo: anterior });
      },
    });
  }

  ngOnInit(): void {
    this.catalogo.cargar();
  }

  etiquetaRol(rol: RolPortal | undefined): string {
    return rol ? ETIQUETA_ROL[rol] : '';
  }

  irInicio(): void {
    this.configAbierta.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  abrirConfig(): void {
    this.panel.abrir(this.botonConfig()?.nativeElement);
  }

  // Se abra desde donde se abra (barra superior o panel izquierdo), el foco
  // entra a la ventana.
  private readonly enfocarAlAbrir = effect(() => {
    if (this.configAbierta()) setTimeout(() => this.ventanaConfig()?.nativeElement.querySelector<HTMLElement>('[data-cerrar]')?.focus());
  });

  // devolverFoco=false cuando se cierra porque se eligió una opción (la
  // persona se va a otra página: el foco no debe volver al botón).
  cerrarConfig(devolverFoco = true): void {
    if (!this.configAbierta()) return;
    this.configAbierta.set(false);
    const origen = this.panel.origen ?? this.botonConfig()?.nativeElement;
    if (devolverFoco) setTimeout(() => origen?.focus());
  }

  @HostListener('document:keydown', ['$event'])
  alPresionarTecla(e: KeyboardEvent): void {
    if (!this.configAbierta()) return;
    if (e.key === 'Escape') this.cerrarConfig();
    else atraparTab(e, this.ventanaConfig()?.nativeElement);
  }
}
