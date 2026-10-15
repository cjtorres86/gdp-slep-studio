import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CAMBIO_IMAGEN_MS, FONDOS, FONDO_INSTITUCIONAL, FondoPortal, ImagenFondo, RECORRIDO_MS, fondoPorId } from '../../core/fondos';
import { PanelConfigService, PantallaOpciones } from '../../core/panel-config.service';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CatalogoService } from '../../core/catalogo.service';
import { RolPortal } from '../../core/models';
import { atraparTab } from '../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../core/bloquear-fondo';

const CLAVE_RECORRIDO = 'gdp_portal_recorrido';
function leerRecorrido(): boolean {
  try {
    return localStorage.getItem(CLAVE_RECORRIDO) === '1';
  } catch {
    return false;
  }
}

// Ventana Opciones: título de cada pantalla, la pantalla de la que viene
// (para «Volver») y lo que explica cada opción.
const TITULO_PANTALLA: Record<PantallaOpciones, string> = {
  inicio: 'Opciones',
  configuracion: 'Configuración',
  administracion: 'Administración',
  vista: 'Vista',
  documentacion: 'Documentación',
};
const PANTALLA_ANTERIOR: Record<PantallaOpciones, PantallaOpciones> = {
  inicio: 'inicio',
  configuracion: 'inicio',
  administracion: 'configuracion',
  vista: 'configuracion',
  documentacion: 'inicio',
};
const TEXTO_OPCION = {
  configuracion: 'Ajusta cómo ves el portal y, si administras, quién entra y qué puede hacer cada persona.',
  documentacion: 'Respaldo formal del sistema: cómo se construyó y funciona, y las normas en que se apoya cada proceso.',
  administracion: 'Gestiona las cuentas de las personas, los perfiles y permisos de cada aplicación, y revisa el registro de lo que se hace en el portal.',
  vista: 'Elige el fondo de pantalla del portal: un paisaje de Chile o el institucional. Es solo tuyo y se guarda en tu cuenta.',
};

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
  readonly pantalla = this.panel.pantalla;
  readonly marcoAbierto = this.panel.marcoAbierto;
  readonly TITULO_PANTALLA = TITULO_PANTALLA;
  readonly TEXTO_OPCION = TEXTO_OPCION;
  // Documentación (Opciones → Documentación): sus documentos, del catálogo.
  readonly documentacion = computed(() => this.catalogo.modulos().find((m) => m.id === 'documentacion')?.aplicaciones ?? []);
  // «Opciones · Configuración»: dónde se está, sobre el título.
  readonly rutaOpciones = computed(() => {
    const ruta: string[] = [];
    for (let p = this.pantalla(); p !== 'inicio'; p = PANTALLA_ANTERIOR[p]) ruta.unshift(TITULO_PANTALLA[p]);
    return ruta.length ? ['Opciones', ...ruta.slice(0, -1)].join(' · ') : 'Portal de aplicaciones';
  });
  readonly textoPantalla = computed(() => {
    switch (this.pantalla()) {
      case 'inicio': return 'Elige qué quieres revisar.';
      case 'administracion': return 'Elige qué quieres administrar. Cada opción explica para qué sirve.';
      case 'vista': return 'El fondo va detrás de las tarjetas y la conversación. Se guarda en tu cuenta.';
      case 'documentacion': return 'Los documentos que respaldan el sistema. Cada uno indica para qué sirve.';
      default: return TEXTO_OPCION.configuracion;
    }
  });
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
  private readonly botonMarco = viewChild<ElementRef<HTMLButtonElement>>('botonMarco');
  private readonly ventanaMarco = viewChild<ElementRef<HTMLElement>>('ventanaMarco');
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

  // ---------- Recorrido de paisajes (interruptor del encabezado) ----------
  // Encendido: el fondo pasa por todas las imágenes de todos los fondos, una
  // cada 12 s. Se recuerda en este navegador. Solo se cargan la imagen
  // anterior (que se desvanece), la actual y la siguiente (lista para entrar).
  private readonly todasLasImagenes: ImagenFondo[] = FONDOS.flatMap((f) => f.imagenes);
  readonly recorrido = signal(leerRecorrido());
  private readonly ticRecorrido = signal(0);
  readonly capasRecorrido = computed(() => {
    const n = this.todasLasImagenes.length, t = this.ticRecorrido() % n;
    const cerca = new Set([(t + n - 1) % n, t, (t + 1) % n]);
    return this.todasLasImagenes.map((img, k) => ({ img, activa: k === t, cargar: cerca.has(k) })).filter((c) => c.cargar);
  });
  readonly conImagen = computed(() => this.recorrido() || !!this.fondo());

  alternarRecorrido(): void {
    const valor = !this.recorrido();
    this.recorrido.set(valor);
    try {
      localStorage.setItem(CLAVE_RECORRIDO, valor ? '1' : '0');
    } catch {
      /* sin almacenamiento: vale solo por esta visita */
    }
  }

  // Galería en carrusel: flechas a los lados (y deslizar con el dedo o el trackpad).
  private readonly carrusel = viewChild<ElementRef<HTMLElement>>('carrusel');
  readonly puedeIzquierda = signal(false);
  readonly puedeDerecha = signal(true);

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.configAbierta);
    bloquearFondoMientras(this.marcoAbierto);
    const reloj = setInterval(() => this.tic.update((t) => t + 1), CAMBIO_IMAGEN_MS);
    const relojRecorrido = setInterval(() => { if (this.recorrido()) this.ticRecorrido.update((t) => t + 1); }, RECORRIDO_MS);
    inject(DestroyRef).onDestroy(() => { clearInterval(reloj); clearInterval(relojRecorrido); });
    // Al abrir la ventana: la tarjeta elegida queda a la vista en el carrusel.
    effect(() => {
      if (!this.configAbierta() || this.pantalla() !== 'vista') return;
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

  // Ventana Opciones: entrar a una opción o volver a la anterior (el foco
  // queda en la ventana).
  irA(pantalla: PantallaOpciones): void {
    this.pantalla.set(pantalla);
    this.enfocarVentana();
  }

  volver(): void {
    this.irA(PANTALLA_ANTERIOR[this.pantalla()]);
  }

  private enfocarVentana(): void {
    setTimeout(() => {
      const v = this.ventanaConfig()?.nativeElement;
      v?.scrollTo({ top: 0 });
      v?.querySelector<HTMLElement>('ul button, ul a, [data-cerrar]')?.focus();
    });
  }

  // ---------- Ver marco legal (barra superior) ----------
  abrirMarco(): void {
    this.marcoAbierto.set(true);
    setTimeout(() => this.ventanaMarco()?.nativeElement.querySelector<HTMLElement>('[data-cerrar]')?.focus());
  }

  cerrarMarco(): void {
    if (!this.marcoAbierto()) return;
    this.marcoAbierto.set(false);
    setTimeout(() => this.botonMarco()?.nativeElement.focus());
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
    if (this.marcoAbierto()) {
      if (e.key === 'Escape') this.cerrarMarco();
      else atraparTab(e, this.ventanaMarco()?.nativeElement);
      return;
    }
    if (!this.configAbierta()) return;
    if (e.key === 'Escape') this.cerrarConfig();
    else atraparTab(e, this.ventanaConfig()?.nativeElement);
  }
}
