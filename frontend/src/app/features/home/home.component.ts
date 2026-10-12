import { NgClass, NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AplicacionVista, BusquedaHistorial, ModuloVista, ResultadoBusqueda } from '../../core/models';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CatalogoService } from '../../core/catalogo.service';
import { atraparTab } from '../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../core/bloquear-fondo';
import { CATALOGO_ASISTENTE } from '../../../data/catalogo';

// Tiempo que se muestra "Construyendo…" antes de abrir la aplicación.
const ESPERA_CONSTRUYENDO_MS = 1500;
// Intercambios del historial que se muestran sobre la barra de búsqueda.
const INTERCAMBIOS_VISIBLES = 6;

export const MENSAJE_SIN_AUTORIZACION =
  'Usted aún no cuenta con autorización para ver este reporte. Por resguardo de los datos personales ' +
  '(Ley 19.628 sobre Protección de la Vida Privada y Ley 21.719 de Protección de Datos Personales), ' +
  'el acceso se otorga solo a perfiles autorizados. Solicítelo a quien administra el sistema.';

type TipoRespuesta = ResultadoBusqueda | 'construyendo' | 'error';
interface Intercambio {
  id: string;
  pregunta: string | null;
  tipo: TipoRespuesta;
  aplicacionId: string | null;
  // Solo para "construyendo" y errores; el resto se arma al mostrar.
  texto?: string;
}
interface Resultado {
  app: AplicacionVista;
  modulo: ModuloVista;
  puntaje: number;
}

// Sin tildes ni mayúsculas, para comparar lo que escribe la persona.
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Pantalla de inicio con forma de asistente (sin IA detrás): la persona
// escribe qué necesita, el portal le sugiere aplicaciones y le responde con
// mensajes. Las aplicaciones también están siempre a mano en la barra lateral.
// Todo viene del catálogo del servidor: todas las aplicaciones se muestran a
// todos, y el servidor dice a cuáles puede entrar cada persona.
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly catalogo = inject(CatalogoService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly modulos = this.catalogo.modulos;
  readonly estado = this.catalogo.estado;
  readonly mensajeError = this.catalogo.mensajeError;

  // ---------- Búsqueda ----------
  readonly consulta = signal('');
  readonly menuResultados = signal(false);
  readonly indiceActivo = signal(0);
  readonly bloqueada = signal(false);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  private readonly palabrasPorApp = new Map(CATALOGO_ASISTENTE.map((e) => [e.id, e.palabras_clave.map(normalizar)]));

  readonly resultados = computed<Resultado[]>(() => {
    const q = normalizar(this.consulta());
    if (!q) return [];
    const palabras = q.split(/\s+/);
    const lista: Resultado[] = [];
    for (const modulo of this.modulos()) {
      for (const app of modulo.aplicaciones) {
        const puntaje = this.puntaje(app, q, palabras);
        if (puntaje > 0) lista.push({ app, modulo, puntaje });
      }
    }
    return lista.sort((a, b) => b.puntaje - a.puntaje);
  });

  // ---------- Conversación (historial de cada persona) ----------
  readonly intercambios = signal<Intercambio[]>([]);
  readonly historialCargado = signal(false);
  // Los nombres se toman del catálogo al mostrar: el historial puede llegar antes que él.
  readonly visibles = computed(() => {
    const nombres = new Map(this.modulos().flatMap((m) => m.aplicaciones).map((a) => [a.id, a.nombre]));
    return this.intercambios().slice(-INTERCAMBIOS_VISIBLES).map((i) => {
      const titulo = (i.aplicacionId && nombres.get(i.aplicacionId)) || '';
      const texto = i.texto ?? (i.tipo === 'construyendo' || i.tipo === 'error' ? '' : this.textoRespuesta(i.tipo, titulo || 'la aplicación'));
      return { ...i, titulo, texto };
    });
  });
  private readonly conversacion = viewChild<ElementRef<HTMLElement>>('conversacion');
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  // ---------- Barra lateral en pantallas angostas (menú desplegable) ----------
  readonly menuMovil = signal(false);

  // ---------- Ventana "Marco legal" ----------
  readonly marcoAbierto = signal(false);
  private readonly ventanaMarco = viewChild<ElementRef<HTMLElement>>('ventanaMarco');
  private disparadorMarco: HTMLElement | null = null;

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.marcoAbierto);
  }

  ngOnInit(): void {
    this.http.get<BusquedaHistorial[]>(`${environment.apiUrl}/portal/busquedas`).subscribe({
      next: (lista) => {
        // El servidor manda las más recientes primero; la conversación se lee de arriba hacia abajo.
        const previos = [...lista].reverse().map((b): Intercambio => ({ id: b.id, pregunta: b.texto, tipo: b.resultado, aplicacionId: b.aplicacionId }));
        this.intercambios.update((actuales) => [...previos, ...actuales]);
        this.historialCargado.set(true);
        this.bajarConversacion();
      },
      error: () => this.historialCargado.set(true),
    });
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  cargar(): void {
    this.catalogo.cargar();
  }

  get nombre(): string {
    return this.auth.usuario()?.nombreParaMostrar ?? '';
  }

  // Coincidencia por nombre formal, palabras clave y descripción.
  private puntaje(app: AplicacionVista, q: string, palabras: string[]): number {
    const nombre = normalizar(app.nombre);
    const claves = this.palabrasPorApp.get(app.id) ?? [];
    const descripcion = normalizar(app.descripcion);
    if (nombre.startsWith(q)) return 100;
    if (nombre.includes(q)) return 80;
    if (claves.includes(q)) return 70;
    if (claves.some((c) => c.startsWith(q))) return 60;
    if (claves.some((c) => c.includes(q)) || descripcion.includes(q)) return 40;
    // Varias palabras: todas deben aparecer en algún lado.
    const todo = `${nombre} ${descripcion} ${claves.join(' ')}`;
    return palabras.length > 1 && palabras.every((p) => todo.includes(p)) ? 30 : 0;
  }

  // Para lectores de pantalla: qué opción de la lista está marcada.
  idActivo(): string | null {
    const r = this.menuResultados() ? this.resultados()[this.indiceActivo()] : undefined;
    return r ? `res-${r.app.id}` : null;
  }

  alEscribir(valor: string): void {
    this.consulta.set(valor);
    this.indiceActivo.set(0);
    this.menuResultados.set(!!valor.trim());
  }

  alPresionarEnCampo(e: KeyboardEvent): void {
    const n = this.resultados().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.menuResultados.set(true);
      this.indiceActivo.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.indiceActivo.update((i) => (i - 1 + n) % n);
    } else if (e.key === 'Escape') {
      this.menuResultados.set(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.buscar();
    }
  }

  // Enter o el botón de la barra: el resultado marcado (o el primero).
  buscar(): void {
    const texto = this.consulta().trim();
    if (!texto || this.bloqueada()) return;
    const elegido = this.resultados()[this.menuResultados() ? this.indiceActivo() : 0];
    if (elegido) this.elegir(elegido.app);
    else this.responder(texto, 'sin_resultados', null);
  }

  // Elegir una aplicación desde la búsqueda (clic o Enter).
  elegir(app: AplicacionVista): void {
    if (this.bloqueada()) return;
    const texto = this.consulta().trim() || app.nombre;
    this.menuResultados.set(false);
    if (app.estado !== 'activa') return this.responder(texto, 'proximamente', app);
    if (!app.autorizado || !app.url) return this.responder(texto, 'sin_autorizacion', app);

    // La pestaña se abre en el mismo instante del clic (si se abriera después
    // de la espera, el navegador la bloquearía como ventana emergente) y muestra
    // "Construyendo…" mientras el asistente lo dice aquí.
    const externa = app.ingresoUnico || !app.url.startsWith('/');
    const pestana = externa ? this.abrirPestanaConstruyendo(app) : null;
    this.bloqueada.set(true);
    const id = this.agregar({ pregunta: texto, tipo: 'construyendo', aplicacionId: app.id, texto: `Construyendo ${app.nombre}…` });
    this.registrar(texto, app.id, 'abrir');
    this.temporizador = setTimeout(() => {
      const listo = () => {
        this.reemplazar(id, { tipo: 'abrir', texto: undefined });
        this.bloqueada.set(false);
        this.consulta.set('');
      };
      if (!externa) {
        listo();
        this.router.navigateByUrl(app.url!);
      } else if (app.ingresoUnico) {
        this.pedirPase(app, pestana, listo, (mensaje) => {
          this.reemplazar(id, { tipo: 'error', texto: mensaje });
          this.bloqueada.set(false);
        });
      } else {
        this.irA(pestana, app.url!);
        listo();
      }
    }, ESPERA_CONSTRUYENDO_MS);
  }

  // Clic en la barra lateral: igual que antes, se abre al instante en una
  // pestaña nueva. Si no puede entrar, el asistente se lo explica.
  entrar(e: MouseEvent, app: AplicacionVista): void {
    this.menuMovil.set(false);
    if (!app.autorizado || !app.url) {
      e.preventDefault();
      if (app.estado === 'activa') this.responder(null, 'sin_autorizacion', app, false);
      return;
    }
    if (app.url.startsWith('/')) {
      // Página del propio portal (Configuración): se abre aquí, como desde la barra superior.
      e.preventDefault();
      this.router.navigateByUrl(app.url);
      return;
    }
    if (!app.ingresoUnico) return; // enlace normal: pestaña nueva
    e.preventDefault();
    const pestana = this.abrirPestanaConstruyendo(app, `Abriendo ${app.nombre}…`);
    this.pedirPase(app, pestana, () => undefined, (mensaje) => this.agregar({ pregunta: null, tipo: 'error', aplicacionId: app.id, texto: mensaje }));
  }

  borrarHistorial(): void {
    this.http.delete(`${environment.apiUrl}/portal/busquedas`).subscribe({ next: () => this.intercambios.set([]) });
  }

  // ---------- Apertura de aplicaciones ----------
  private abrirPestanaConstruyendo(app: AplicacionVista, texto = `Construyendo ${app.nombre}…`): Window | null {
    const pestana = window.open('', '_blank');
    if (pestana) {
      pestana.document.title = app.nombre;
      pestana.document.body.innerHTML = `<p style="font-family:system-ui,sans-serif;color:#25306B;padding:2.5rem;font-size:15px">${texto.replace(/</g, '&lt;')}</p>`;
    }
    return pestana;
  }

  private irA(pestana: Window | null, url: string): void {
    if (pestana) {
      pestana.opener = null; // la aplicación no puede tocar la pestaña del portal
      pestana.location.href = url;
    } else {
      window.location.href = url; // el navegador no dejó abrir pestaña: se abre aquí mismo
    }
  }

  // Ingreso único: el portal pide un pase de un solo uso y abre la aplicación con él.
  private pedirPase(app: AplicacionVista, pestana: Window | null, ok: () => void, falla: (mensaje: string) => void): void {
    this.http.post<{ url: string }>(`${environment.apiUrl}/ingreso-unico/pase`, { aplicacionId: app.id }).subscribe({
      next: ({ url }) => {
        this.irA(pestana, url);
        ok();
      },
      error: (err: HttpErrorResponse) => {
        pestana?.close();
        falla(
          err.status === 0
            ? `No se pudo abrir ${app.nombre}: el servidor no respondió. Espera un minuto y vuelve a intentar.`
            : (err.error?.message ?? `No se pudo abrir ${app.nombre}.`),
        );
      },
    });
  }

  // ---------- Conversación ----------
  private responder(pregunta: string | null, resultado: ResultadoBusqueda, app: AplicacionVista | null, guardar = true): void {
    this.agregar({ pregunta, tipo: resultado, aplicacionId: app?.id ?? null });
    if (guardar && pregunta) this.registrar(pregunta, app?.id ?? null, resultado);
    this.consulta.set('');
  }

  private textoRespuesta(resultado: ResultadoBusqueda, nombre: string): string {
    switch (resultado) {
      case 'abrir': return `Entendido, abriendo ${nombre}.`;
      case 'proximamente': return `${nombre} estará disponible pronto.`;
      case 'sin_autorizacion': return MENSAJE_SIN_AUTORIZACION;
      default: return 'Lo siento, aún no tengo ese módulo disponible.';
    }
  }

  private registrar(texto: string, aplicacionId: string | null, resultado: ResultadoBusqueda): void {
    this.http.post(`${environment.apiUrl}/portal/busquedas`, { texto: texto.slice(0, 200), aplicacionId, resultado }).subscribe({ error: () => undefined });
  }

  private agregar(i: Omit<Intercambio, 'id'>): string {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.intercambios.update((lista) => [...lista, { id, ...i }]);
    this.bajarConversacion();
    return id;
  }

  private reemplazar(id: string, cambios: Partial<Intercambio>): void {
    this.intercambios.update((lista) => lista.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
  }

  private bajarConversacion(): void {
    setTimeout(() => {
      const c = this.conversacion()?.nativeElement;
      if (c) c.scrollTop = c.scrollHeight;
    });
  }

  // ---------- Marco legal ----------
  abrirMarco(e: Event): void {
    this.menuMovil.set(false);
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

  // Cierra el menú de resultados al hacer clic fuera de la búsqueda.
  @HostListener('document:click', ['$event'])
  alHacerClic(e: MouseEvent): void {
    const zona = this.campo()?.nativeElement.closest('[data-busqueda]');
    if (zona && !zona.contains(e.target as Node)) this.menuResultados.set(false);
  }

  // "todos" o una lista de SLEP, en una línea corta.
  textoAlcance(alcance: string[] | null): string {
    if (!alcance?.length) return '';
    if (alcance.includes('todos')) return 'Todos los SLEP';
    return alcance.length <= 2 ? alcance.join(', ') : `${alcance.slice(0, 2).join(', ')} +${alcance.length - 2}`;
  }
}
