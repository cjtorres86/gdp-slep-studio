import { NgClass, NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AplicacionVista, BusquedaHistorial, InformeVista, ModuloVista, OpcionesInforme, PreguntaInforme, ResultadoBusqueda } from '../../core/models';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CatalogoService } from '../../core/catalogo.service';
import { PanelConfigService } from '../../core/panel-config.service';
import { atraparTab } from '../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../core/bloquear-fondo';

// Tiempo que se muestra "Construyendo…" antes de abrir.
const ESPERA_CONSTRUYENDO_MS = 1500;
// Intercambios del historial que se muestran sobre la barra de búsqueda.
const INTERCAMBIOS_VISIBLES = 8;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const MENSAJE_SIN_AUTORIZACION =
  'Usted aún no cuenta con autorización para ver este reporte. Por resguardo de los datos personales ' +
  '(Ley 19.628 sobre Protección de la Vida Privada y Ley 21.719 de Protección de Datos Personales), ' +
  'el acceso se otorga solo a perfiles autorizados. Solicítelo a quien administra el sistema.';

type TipoRespuesta = ResultadoBusqueda | 'construyendo' | 'error' | 'pregunta' | 'aviso';
interface Opcion {
  etiqueta: string;
  valor: string; // "todos", "Agosto|2026" o el nombre del SLEP
}
interface Intercambio {
  id: string;
  pregunta: string | null;
  tipo: TipoRespuesta;
  aplicacionId: string | null; // también el id de un informe
  texto?: string; // para preguntas, avisos, "construyendo" y errores
  opciones?: Opcion[];
  respondida?: boolean;
  // La persona eligió otra cosa en vez de responder esta pregunta.
  descartada?: boolean;
}
type Resultado =
  | { tipo: 'app'; id: string; nombre: string; descripcion: string; modulo: ModuloVista; app: AplicacionVista; puntaje: number }
  | { tipo: 'informe'; id: string; nombre: string; descripcion: string; modulo: ModuloVista; informe: InformeVista; aplicacion: string; puntaje: number }
  // Con una pregunta abierta: una de sus opciones que coincide con lo escrito.
  | { tipo: 'respuesta'; id: string; nombre: string; descripcion: string; opcion: Opcion; intercambioId: string; puntaje: number };

// Conversación en curso para abrir un informe: qué falta preguntar y qué respondió.
interface Dialogo {
  informe: InformeVista;
  texto: string;
  pasos: PreguntaInforme[];
  respuestas: { mes?: string; slep?: string };
  preguntaId: string | null;
}

// Sin tildes ni mayúsculas, para comparar lo que escribe la persona.
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Palabras de CATEGORÍA: solas muestran toda la categoría ("informe" → todos
// los informes, "descargar" → todo lo que se puede descargar); junto a otra
// palabra no filtran, decide la otra ("descargar ranking" → solo rankings).
const PALABRAS_CATEGORIA = new Set(['informe', 'informes', 'reporte', 'reportes', 'descargar', 'descarga', 'descargas', 'bajar']);
// Palabras de relleno: se ignoran siempre ("quiero ver el ranking").
const PALABRAS_RELLENO = new Set(['ver', 'abrir', 'quiero', 'necesito', 'dame', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'me', 'por', 'favor', 'en', 'y', 'con']);
// Sección del acordeón abierta, recordada en este navegador.
const CLAVE_ACORDEON = 'gdp_portal_acordeon';
const ETIQUETA_FORMATO: Record<InformeVista['formato'], string> = { xlsx: 'xlsx', html: 'html', pdf: 'pdf' };
// Color del cuadro del ícono según el formato, en tonos sobrios de la paleta:
// xlsx verde, html azul (el azul gobierno), pdf rojo.
const COLOR_FORMATO: Record<InformeVista['formato'], string> = { xlsx: '#2F7D4E', html: '#006BB9', pdf: '#B73A48' };

// Pantalla de inicio con forma de asistente (sin IA detrás): la persona
// escribe qué necesita y el portal le ofrece aplicaciones e informes; si un
// informe necesita datos (mes, SLEP), el asistente se los pregunta. Las
// aplicaciones están a mano en el botón «Aplicaciones» de la barra. Todo viene
// del servidor: todo se muestra a todos, y el servidor dice qué puede abrir
// cada persona.
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet],
  templateUrl: './home.component.html',
  // Ocupa todo el alto bajo el encabezado: la barra de búsqueda queda abajo.
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly catalogo = inject(CatalogoService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly panelConfig = inject(PanelConfigService);
  readonly modulos = this.catalogo.modulos;
  readonly estado = this.catalogo.estado;
  readonly mensajeError = this.catalogo.mensajeError;
  readonly informes = signal<InformeVista[]>([]);
  readonly ETIQUETA_FORMATO = ETIQUETA_FORMATO;
  readonly COLOR_FORMATO = COLOR_FORMATO;
  private readonly opcionesPorApp = new Map<string, OpcionesInforme>();

  // ---------- Búsqueda ----------
  readonly consulta = signal('');
  readonly menuResultados = signal(false);
  readonly indiceActivo = signal(0);
  readonly bloqueada = signal(false);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  readonly resultados = computed<Resultado[]>(() => {
    const q = normalizar(this.consulta());
    if (!q) return [];
    const palabras = q.split(/\s+/);
    // Con una pregunta abierta, primero sus respuestas que coinciden con lo
    // escrito; debajo, la búsqueda de siempre (para cambiar de tema).
    const lista: Resultado[] = this.respuestasQueCoinciden(q, palabras);
    const modulos = this.modulos();
    for (const modulo of modulos) {
      for (const app of modulo.aplicaciones) {
        // Las palabras clave vienen del catálogo único (servidor).
        const puntaje = this.puntaje(app.nombre, (app.palabrasClave ?? []).map(normalizar), q, palabras);
        if (puntaje > 0) lista.push({ tipo: 'app', id: app.id, nombre: app.nombre, descripcion: app.descripcion, modulo, app, puntaje });
      }
    }
    for (const informe of this.informes()) {
      const modulo = modulos.find((m) => m.aplicaciones.some((a) => a.id === informe.aplicacionId));
      const app = modulo?.aplicaciones.find((a) => a.id === informe.aplicacionId);
      if (!modulo || !app) continue;
      const puntaje = this.puntaje(informe.nombre, informe.palabrasClave.map(normalizar), q, palabras);
      if (puntaje > 0) lista.push({ tipo: 'informe', id: informe.id, nombre: informe.nombre, descripcion: informe.descripcion, modulo, informe, aplicacion: app.nombre, puntaje });
    }
    // A igual puntaje, primero los informes (lo que la persona suele buscar).
    // Las respuestas a la pregunta abierta tienen un puntaje mayor: van arriba.
    return lista.sort((a, b) => b.puntaje - a.puntaje || (a.tipo === b.tipo ? 0 : a.tipo === 'informe' ? -1 : 1));
  });

  // Opciones de la pregunta abierta que coinciden con lo escrito ("jul" →
  // "Julio 2026"; "todos", "completo" → la opción que no filtra; "si",
  // "abrir" → abrir el informe).
  private respuestasQueCoinciden(q: string, palabras: string[]): Resultado[] {
    const d = this.dialogo();
    const pregunta = d ? this.intercambios().find((i) => i.id === d.preguntaId && !i.respondida) : undefined;
    if (!pregunta?.opciones?.length) return [];
    const utiles = palabras.filter((p) => !PALABRAS_RELLENO.has(p));
    return pregunta.opciones
      .filter((o) => {
        const etiqueta = normalizar(o.etiqueta);
        if (o.valor === 'todos' && /(todo|complet|general)/.test(q)) return true;
        if (o.valor === 'abrir' && /^(si|abrir|dale|ok|listo)$/.test(q)) return true;
        return utiles.length > 0 && utiles.every((p) => etiqueta.includes(p));
      })
      .map((o, k) => ({
        tipo: 'respuesta' as const,
        id: `resp-${o.valor}`,
        nombre: o.etiqueta.replace(' · el más reciente', ''),
        descripcion: pregunta.texto ?? '',
        opcion: o,
        intercambioId: pregunta.id,
        puntaje: 1000 - k,
      }));
  }

  // ---------- Conversación (historial de cada persona) ----------
  readonly intercambios = signal<Intercambio[]>([]);
  readonly dialogo = signal<Dialogo | null>(null);
  private readonly conversacion = viewChild<ElementRef<HTMLElement>>('conversacion');
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  // Los nombres se toman al mostrar: el historial puede llegar antes que el catálogo.
  readonly visibles = computed(() => {
    const nombres = new Map<string, string>([
      ...this.modulos().flatMap((m) => m.aplicaciones).map((a) => [a.id, a.nombre] as [string, string]),
      ...this.informes().map((i) => [i.id, i.nombre] as [string, string]),
    ]);
    return this.intercambios().slice(-INTERCAMBIOS_VISIBLES).map((i) => {
      const titulo = (i.aplicacionId && nombres.get(i.aplicacionId)) || '';
      const texto = i.texto ?? this.textoRespuesta(i.tipo as ResultadoBusqueda, titulo || 'la aplicación');
      return { ...i, titulo, texto };
    });
  });

  // Historial de búsquedas anteriores (del servidor), a la vista solo si se pide.
  readonly historialGuardado = signal<Intercambio[]>([]);
  readonly historialMostrado = signal(false);
  // La conversación ya empezó: la barra baja y los mensajes suben (como una IA).
  readonly iniciada = computed(() => this.intercambios().length > 0 || !!this.dialogo());

  // ---------- Posición de la lista de resultados (estado inicial) ----------
  // En el estado inicial la lista se abre hacia ABAJO. Si no cabe, el bloque
  // del saludo y la barra sube (translateY) solo lo necesario, sin pasar del
  // borde superior; si ni así cabe, la lista se limita al espacio disponible
  // y tiene scroll propio. Con la conversación iniciada, la barra está abajo y
  // la lista se abre hacia ARRIBA.
  readonly listaAbajo = computed(() => !this.iniciada());
  readonly desplazamiento = signal(0); // px que sube el bloque (0 = centrado)
  readonly altoLista = signal<number | null>(null); // máximo de la lista hacia abajo
  private readonly seccion = viewChild<ElementRef<HTMLElement>>('seccion');
  private readonly bloqueBusqueda = viewChild<ElementRef<HTMLElement>>('bloqueBusqueda');
  private readonly cajaBarra = viewChild<ElementRef<HTMLElement>>('cajaBarra');
  private readonly listaResultados = viewChild<ElementRef<HTMLElement>>('listaResultados');
  private static readonly SEPARACION = 6; // px entre la barra y la lista
  private static readonly MARGEN_INFERIOR = 16; // px libres bajo la lista
  private static readonly ALTO_MINIMO_LISTA = 140; // nunca más chica que esto
  private ajustePendiente = 0;

  // Recalcula cuando cambia lo que se muestra (resultados, apertura, estado).
  private readonly recalcular = effect(() => {
    this.resultados();
    this.menuResultados();
    this.iniciada();
    this.programarAjuste();
  });

  @HostListener('window:resize')
  programarAjuste(): void {
    cancelAnimationFrame(this.ajustePendiente);
    // Después de que Angular dibuje la lista, para medir su alto real.
    this.ajustePendiente = requestAnimationFrame(() => this.ajustarPosicion());
  }

  // Mide con offsetTop/offsetHeight, que NO incluyen el transform aplicado:
  // así el cálculo es estable aunque el bloque esté a mitad de la animación.
  private ajustarPosicion(): void {
    const lista = this.listaResultados()?.nativeElement;
    const seccion = this.seccion()?.nativeElement;
    const bloque = this.bloqueBusqueda()?.nativeElement;
    const barra = this.cajaBarra()?.nativeElement;
    const conversacion = this.conversacion()?.nativeElement;
    if (!this.listaAbajo() && lista && seccion && bloque && conversacion) {
      this.ajustarListaArriba(lista, seccion, bloque, conversacion);
      return;
    }
    if (!this.listaAbajo() || !lista || !seccion || !bloque || !barra || !conversacion) {
      this.desplazamiento.set(0);
      this.altoLista.set(null);
      this.saludoFijo.set(false);
      if (!this.listaAbajo() && conversacion) conversacion.scrollTop = conversacion.scrollHeight;
      return;
    }
    // Alto completo del contenido (aunque esté limitado) más sus bordes: la
    // lista usa box-sizing border-box, así que max-height incluye el borde.
    const altoNatural = lista.scrollHeight + (lista.offsetHeight - lista.clientHeight);
    const bordeInferiorBarra = bloque.offsetTop + barra.offsetTop + barra.offsetHeight + HomeComponent.SEPARACION;
    const espacioAbajo = seccion.clientHeight - HomeComponent.MARGEN_INFERIOR - bordeInferiorBarra;
    // Lo máximo que puede subir: hasta que el saludo toque el borde superior.
    const maximoSubir = Math.max(0, conversacion.offsetTop);
    const subir = Math.min(Math.max(0, altoNatural - espacioAbajo), maximoSubir);
    this.desplazamiento.set(Math.round(subir));
    this.altoLista.set(Math.max(HomeComponent.ALTO_MINIMO_LISTA, Math.floor(espacioAbajo + subir)));
  }

  // Conversación iniciada: la lista se abre hacia ARRIBA dentro del flujo y
  // empuja la conversación. Crece con sus opciones hasta justo debajo del
  // saludo (que queda siempre a la vista); solo si ni así caben, tiene scroll.
  private ajustarListaArriba(lista: HTMLElement, seccion: HTMLElement, bloque: HTMLElement, conversacion: HTMLElement): void {
    this.desplazamiento.set(0);
    // Alto del saludo desde el borde de la conversación (fijo o no, mide lo
    // mismo: .saludo-fijo lleva el margen superior dentro de su propio alto).
    const saludo = conversacion.firstElementChild as HTMLElement | null;
    const altoSaludo = saludo?.classList.contains('saludo-fijo')
      ? saludo.offsetHeight + parseFloat(getComputedStyle(saludo).marginBottom)
      : parseFloat(getComputedStyle(conversacion).paddingTop) + (saludo?.offsetHeight ?? 0);
    // Alto que comparten la conversación y la lista (+ su separación): todo lo
    // de la sección menos la barra y sus textos, que no cambian.
    const compartido = seccion.clientHeight - (bloque.offsetHeight - lista.offsetHeight);
    this.altoLista.set(Math.max(HomeComponent.ALTO_MINIMO_LISTA, Math.floor(compartido - altoSaludo - HomeComponent.SEPARACION)));
    // Después de aplicar el alto: la conversación queda anclada abajo (el último
    // mensaje justo sobre la lista, pasando por debajo del saludo fijo).
    requestAnimationFrame(() => {
      conversacion.scrollTop = conversacion.scrollHeight;
      this.alDesplazarConversacion();
    });
  }

  // El saludo se fija arriba solo cuando hace falta: lista abierta en la
  // conversación y mensajes desplazados (si no, se ve en su lugar de siempre).
  readonly saludoFijo = signal(false);
  alDesplazarConversacion(): void {
    const c = this.conversacion()?.nativeElement;
    this.saludoFijo.set(!!c && !this.listaAbajo() && this.menuResultados() && !!this.consulta().trim() && c.scrollTop > 1);
  }

  // ---------- Panel de Aplicaciones (botón de la barra de búsqueda) ----------
  // Los módulos en horizontal, entre el saludo y la barra. Se cierra con el
  // mismo botón, con Esc o al escribir (los resultados toman su lugar).
  readonly appsAbierto = signal(false);
  private readonly botonApps = viewChild<ElementRef<HTMLButtonElement>>('botonApps');

  alternarApps(): void {
    const abrir = !this.appsAbierto();
    this.appsAbierto.set(abrir);
    if (abrir) this.menuResultados.set(false);
  }

  // ---------- Acordeón de los módulos: varias secciones abiertas a la vez,
  // todas cerradas al entrar la primera vez; se recuerda en este navegador. ----------
  readonly abiertas = signal<Set<string>>(this.leerAcordeon());

  // ---------- Ventana "Marco legal" ----------
  readonly marcoAbierto = signal(false);
  private readonly ventanaMarco = viewChild<ElementRef<HTMLElement>>('ventanaMarco');
  private disparadorMarco: HTMLElement | null = null;

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.marcoAbierto);
  }

  ngOnInit(): void {
    // Cada visita parte con la conversación vacía (barra al medio, como una
    // IA); el historial guardado se muestra solo si la persona lo pide.
    this.http.get<BusquedaHistorial[]>(`${environment.apiUrl}/portal/busquedas`).subscribe({
      next: (lista) => {
        // El servidor manda las más recientes primero; la conversación se lee de arriba hacia abajo.
        this.historialGuardado.set([...lista].reverse().map((b): Intercambio => ({ id: b.id, pregunta: b.texto, tipo: b.resultado, aplicacionId: b.aplicacionId })));
      },
    });
    this.http.get<InformeVista[]>(`${environment.apiUrl}/portal/informes`).subscribe({
      next: (lista) => {
        this.informes.set(lista);
        // Se piden de antemano los meses y SLEP, para preguntar sin esperas.
        new Set(lista.map((i) => i.aplicacionId)).forEach((id) => this.cargarOpciones(id).subscribe({ error: () => undefined }));
      },
    });
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    cancelAnimationFrame(this.ajustePendiente);
  }

  cargar(): void {
    this.catalogo.cargar();
  }

  get nombre(): string {
    return this.auth.usuario()?.nombreParaMostrar ?? '';
  }

  // Coincidencia por nombre formal y palabras clave (la descripción no cuenta:
  // "ranking" no debe traer el Informe Interactivo solo porque lo menciona).
  private puntaje(nombreOriginal: string, claves: string[], q: string, palabras: string[]): number {
    const nombre = normalizar(nombreOriginal);
    if (nombre.startsWith(q)) return 100;
    if (nombre.includes(q)) return 80;
    if (claves.includes(q)) return 70;
    if (claves.some((c) => c.startsWith(q))) return 60;
    if (claves.some((c) => c.includes(q))) return 40;
    // Varias palabras (ej. "descargar ranking julio 2026"): los meses y años
    // se usan después como respuestas; las palabras de categoría solo cuentan
    // si van solas. Cada palabra que queda debe aparecer: pesa más en el
    // nombre que en las palabras clave.
    const utiles = palabras.filter((p) => !PALABRAS_RELLENO.has(p) && !MESES.includes(p) && !/^\d{4}$/.test(p));
    const especificas = utiles.filter((p) => !PALABRAS_CATEGORIA.has(p));
    const buscar = especificas.length ? especificas : utiles;
    let suma = 0;
    for (const p of buscar) {
      if (nombre.includes(p)) suma += 6;
      else if (claves.some((c) => c === p)) suma += 4;
      else if (claves.some((c) => c.includes(p))) suma += 2;
      else return 0;
    }
    return buscar.length ? 20 + suma : 0;
  }

  // Para lectores de pantalla: qué opción de la lista está marcada.
  idActivo(): string | null {
    const r = this.menuResultados() ? this.resultados()[this.indiceActivo()] : undefined;
    return r ? `res-${r.id}` : null;
  }

  alEscribir(valor: string): void {
    this.consulta.set(valor);
    this.indiceActivo.set(0);
    this.menuResultados.set(!!valor.trim());
    if (valor.trim()) this.appsAbierto.set(false);
  }

  // Dirección de la lista: hacia ABAJO en el estado inicial (barra al centro)
  // y hacia ARRIBA con la conversación iniciada (barra anclada abajo). En
  // ambos casos el mejor resultado queda pegado a la barra, así que la tecla
  // que "se aleja" de la barra pasa al siguiente resultado.
  alPresionarEnCampo(e: KeyboardEvent): void {
    const n = this.resultados().length;
    const siguiente = this.listaAbajo() ? 'ArrowDown' : 'ArrowUp';
    const anterior = this.listaAbajo() ? 'ArrowUp' : 'ArrowDown';
    if (e.key === siguiente && n) {
      e.preventDefault();
      this.menuResultados.set(true);
      this.indiceActivo.update((i) => (i + 1) % n);
    } else if (e.key === anterior && n) {
      e.preventDefault();
      this.indiceActivo.update((i) => (i - 1 + n) % n);
    } else if (e.key === 'Escape') {
      this.menuResultados.set(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.buscar();
    }
  }

  // Enter o el botón de la barra.
  buscar(): void {
    const texto = this.consulta().trim();
    if (!texto || this.bloqueada()) return;
    const elegido = this.resultados()[this.menuResultados() ? this.indiceActivo() : 0];
    if (elegido) return this.elegir(elegido);
    // Sin resultados y con una pregunta abierta: se intenta como respuesta
    // escrita ("cancelar", "no", etc.).
    if (this.dialogo()) return this.responderEscrito(texto);
    this.responder(texto, 'sin_resultados', null);
  }

  elegir(r: Resultado): void {
    this.menuResultados.set(false);
    if (r.tipo === 'respuesta') {
      this.consulta.set('');
      return this.responderPregunta(r.intercambioId, r.opcion);
    }
    // Eligió otra cosa: la pregunta abierta se deja de lado y empieza lo nuevo.
    this.descartarDialogo();
    if (r.tipo === 'app') this.elegirAplicacion(r.app);
    else this.elegirInforme(r.informe);
  }

  // Deja de lado la pregunta abierta, sin mensaje: sus opciones quedan
  // deshabilitadas con la nota "Pregunta descartada".
  private descartarDialogo(): void {
    const d = this.dialogo();
    if (!d) return;
    if (d.preguntaId) this.reemplazar(d.preguntaId, { respondida: true, descartada: true });
    this.dialogo.set(null);
  }

  // ---------- Aplicaciones ----------
  elegirAplicacion(app: AplicacionVista): void {
    if (this.bloqueada()) return;
    const texto = this.consulta().trim() || app.nombre;
    this.menuResultados.set(false);
    if (app.estado !== 'activa') return this.responder(texto, 'proximamente', app.id);
    if (!app.autorizado || !app.url) return this.responder(texto, 'sin_autorizacion', app.id);

    // La pestaña se abre en el mismo instante del clic (si se abriera después
    // de la espera, el navegador la bloquearía como ventana emergente).
    const externa = app.ingresoUnico || !app.url.startsWith('/');
    const pestana = externa ? this.abrirPestanaConstruyendo(app.nombre) : null;
    this.registrar(texto, app.id, 'abrir');
    this.construir(texto, app.id, app.nombre, (listo, falla) => {
      if (!externa) {
        listo();
        this.router.navigateByUrl(app.url!);
      } else if (app.ingresoUnico) {
        this.http.post<{ url: string }>(`${environment.apiUrl}/ingreso-unico/pase`, { aplicacionId: app.id }).subscribe(this.alRecibirPase(pestana, app.nombre, listo, falla));
      } else {
        this.irA(pestana, app.url!);
        listo();
      }
    });
  }

  // Clic en el panel de Aplicaciones: se abre al instante, como siempre. Si no puede
  // entrar, el asistente se lo explica.
  entrar(e: MouseEvent, app: AplicacionVista): void {
    this.appsAbierto.set(false);
    if (!app.autorizado || !app.url) {
      e.preventDefault();
      if (app.estado === 'activa') this.responder(null, 'sin_autorizacion', app.id, false);
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
    const pestana = this.abrirPestanaConstruyendo(app.nombre, `Abriendo ${app.nombre}…`);
    this.http.post<{ url: string }>(`${environment.apiUrl}/ingreso-unico/pase`, { aplicacionId: app.id }).subscribe(
      this.alRecibirPase(pestana, app.nombre, () => undefined, (m) => this.agregar({ pregunta: null, tipo: 'error', aplicacionId: app.id, texto: m })),
    );
  }

  // ---------- Informes (con preguntas) ----------
  elegirInforme(informe: InformeVista): void {
    if (this.bloqueada()) return;
    const texto = this.consulta().trim() || informe.nombre;
    this.menuResultados.set(false);
    this.consulta.set('');
    if (informe.estado !== 'activa') {
      this.agregar({ pregunta: texto, tipo: 'proximamente', aplicacionId: informe.id });
      this.registrar(texto, informe.id, 'proximamente');
      return;
    }
    if (!informe.autorizado) {
      this.agregar({ pregunta: texto, tipo: 'sin_autorizacion', aplicacionId: informe.id });
      this.registrar(texto, informe.id, 'sin_autorizacion');
      return;
    }
    // Quien trabaja con un solo SLEP no elige: el servidor usa el suyo.
    const pasos = informe.preguntas.filter((p) => !(p.clave === 'slep' && informe.sleps !== 'todos' && informe.sleps.length <= 1));
    const dialogo: Dialogo = { informe, texto, pasos, respuestas: {}, preguntaId: null };
    this.agregar({ pregunta: texto, tipo: 'aviso', aplicacionId: informe.id, texto: `Muy bien, preparemos ${informe.nombre}.` });
    this.dialogo.set(dialogo);
    const opciones = this.opcionesPorApp.get(informe.aplicacionId);
    if (opciones || !pasos.length) {
      this.adelantarRespuestas(dialogo, texto, opciones);
      this.siguientePaso();
      return;
    }
    // Las opciones todavía no llegan (la aplicación puede estar despertando).
    const aviso = this.agregar({ pregunta: null, tipo: 'construyendo', aplicacionId: informe.id, texto: 'Consultando los meses disponibles…' });
    this.cargarOpciones(informe.aplicacionId).subscribe({
      next: (o) => {
        this.quitar(aviso);
        this.adelantarRespuestas(dialogo, texto, o);
        this.siguientePaso();
      },
      error: () => {
        this.reemplazar(aviso, { tipo: 'error', texto: 'No pude consultar los meses disponibles. Espera un minuto y vuelve a intentarlo.' });
        this.dialogo.set(null);
      },
    });
  }

  // Si la persona ya lo dijo al escribir (ej. "ranking julio 2026", "errores
  // Valdivia"), no se le vuelve a preguntar.
  private adelantarRespuestas(d: Dialogo, texto: string, o: OpcionesInforme | undefined): void {
    if (!o) return;
    const q = normalizar(texto);
    const pasoMes = d.pasos.find((p) => p.clave === 'mes');
    const nombreMes = MESES.find((m) => q.split(/\s+/).includes(m));
    if (pasoMes && nombreMes) {
      const anio = q.match(/\b(20\d{2})\b/)?.[1];
      const hallado = o.meses.find((m) => normalizar(m.mes) === nombreMes && (!anio || m.anio === anio));
      if (hallado) d.respuestas.mes = `${hallado.mes}|${hallado.anio}`;
    }
    const pasoSlep = d.pasos.find((p) => p.clave === 'slep');
    if (pasoSlep) {
      const sleps = d.informe.sleps === 'todos' ? o.sleps : d.informe.sleps;
      const hallado = sleps.find((s) => q.includes(normalizar(s)));
      if (hallado) d.respuestas.slep = hallado;
    }
  }

  // Hace la siguiente pregunta pendiente o, si no queda ninguna, ofrece abrir.
  private siguientePaso(): void {
    const d = this.dialogo();
    if (!d) return;
    const paso = d.pasos.find((p) => d.respuestas[p.clave] === undefined);
    if (!paso) {
      // Todo respondido: se abre con un clic (así el navegador permite la pestaña nueva).
      d.preguntaId = this.agregar({
        pregunta: null, tipo: 'pregunta', aplicacionId: d.informe.id,
        texto: this.resumen(d), opciones: [{ etiqueta: `Abrir ${d.informe.nombre}`, valor: 'abrir' }],
      });
      return;
    }
    d.preguntaId = this.agregar({ pregunta: null, tipo: 'pregunta', aplicacionId: d.informe.id, texto: paso.texto, opciones: this.opcionesDe(d, paso) });
  }

  private opcionesDe(d: Dialogo, paso: PreguntaInforme): Opcion[] {
    const o = this.opcionesPorApp.get(d.informe.aplicacionId) ?? { meses: [], sleps: [] };
    const lista: Opcion[] = paso.opcionTodos ? [{ etiqueta: paso.opcionTodos, valor: 'todos' }] : [];
    if (paso.clave === 'mes') {
      o.meses.forEach((m, i) => lista.push({ etiqueta: `${m.mes} ${m.anio}${i === 0 ? ' · el más reciente' : ''}`, valor: `${m.mes}|${m.anio}` }));
    } else {
      (d.informe.sleps === 'todos' ? o.sleps : d.informe.sleps).forEach((s) => lista.push({ etiqueta: s, valor: s }));
    }
    return lista;
  }

  private resumen(d: Dialogo): string {
    const partes: string[] = [];
    if (d.respuestas.mes) partes.push(d.respuestas.mes === 'todos' ? 'todos los meses' : d.respuestas.mes.replace('|', ' '));
    if (d.respuestas.slep) partes.push(d.respuestas.slep === 'todos' ? 'todos los SLEP' : d.respuestas.slep);
    return partes.length ? `Listo: ${d.informe.nombre} con ${partes.join(' y ')}.` : `Listo: ${d.informe.nombre}.`;
  }

  // Clic en una opción de la pregunta en curso.
  responderPregunta(intercambioId: string, opcion: Opcion): void {
    const d = this.dialogo();
    if (!d || d.preguntaId !== intercambioId || this.bloqueada()) return;
    this.reemplazar(intercambioId, { respondida: true });
    if (opcion.valor === 'abrir') return this.abrirInforme(d);
    const paso = d.pasos.find((p) => d.respuestas[p.clave] === undefined);
    if (!paso) return;
    d.respuestas[paso.clave] = opcion.valor;
    this.agregar({ pregunta: opcion.etiqueta.replace(' · el más reciente', ''), tipo: 'aviso', aplicacionId: null, texto: '' });
    this.siguientePaso();
  }

  // La persona escribió la respuesta en vez de hacer clic.
  private responderEscrito(texto: string): void {
    const d = this.dialogo()!;
    const actual = this.intercambios().find((i) => i.id === d.preguntaId);
    const q = normalizar(texto);
    this.consulta.set('');
    if (['cancelar', 'salir', 'nada', 'no'].includes(q)) return this.cancelarDialogo(texto);
    const opciones = actual?.opciones ?? [];
    const elegida =
      opciones.find((o) => normalizar(o.etiqueta) === q) ??
      (/(todo|complet|general)/.test(q) ? opciones.find((o) => o.valor === 'todos') : undefined) ??
      opciones.find((o) => q.split(/\s+/).every((p) => normalizar(o.etiqueta).includes(p))) ??
      (/^(si|abrir|dale|ok)$/.test(q) ? opciones.find((o) => o.valor === 'abrir') : undefined);
    if (elegida && actual) return this.responderPregunta(actual.id, elegida);
    this.agregar({ pregunta: texto, tipo: 'aviso', aplicacionId: null, texto: 'No encontré esa opción. Elige una de la lista, o escribe «cancelar».' });
  }

  cancelarDialogo(texto: string | null = null): void {
    const d = this.dialogo();
    if (!d) return;
    if (d.preguntaId) this.reemplazar(d.preguntaId, { respondida: true });
    this.dialogo.set(null);
    this.agregar({ pregunta: texto, tipo: 'aviso', aplicacionId: null, texto: 'De acuerdo, lo dejamos aquí. ¿Qué más necesitas?' });
  }

  private abrirInforme(d: Dialogo): void {
    this.dialogo.set(null);
    const pestana = this.abrirPestanaConstruyendo(d.informe.nombre);
    const [mes, anio] = d.respuestas.mes && d.respuestas.mes !== 'todos' ? d.respuestas.mes.split('|') : [undefined, undefined];
    const slep = d.respuestas.slep && d.respuestas.slep !== 'todos' ? d.respuestas.slep : undefined;
    this.registrar(d.texto, d.informe.id, 'abrir');
    this.construir(null, d.informe.id, d.informe.nombre, (listo, falla) => {
      this.http
        .post<{ url: string }>(`${environment.apiUrl}/portal/informes/${encodeURIComponent(d.informe.id)}/abrir`, { mes, anio, slep })
        .subscribe(this.alRecibirPase(pestana, d.informe.nombre, listo, falla));
    });
  }

  // ---------- Apertura ----------
  // "Construyendo…" durante la espera; después, abre (abrir llama a listo o falla).
  private construir(pregunta: string | null, id: string, nombre: string, abrir: (listo: () => void, falla: (m: string) => void) => void): void {
    this.bloqueada.set(true);
    this.consulta.set('');
    const aviso = this.agregar({ pregunta, tipo: 'construyendo', aplicacionId: id, texto: `Construyendo ${nombre}…` });
    this.temporizador = setTimeout(
      () =>
        abrir(
          () => {
            this.reemplazar(aviso, { tipo: 'abrir', texto: undefined });
            this.bloqueada.set(false);
          },
          (mensaje) => {
            this.reemplazar(aviso, { tipo: 'error', texto: mensaje });
            this.bloqueada.set(false);
          },
        ),
      ESPERA_CONSTRUYENDO_MS,
    );
  }

  private alRecibirPase(pestana: Window | null, nombre: string, ok: () => void, falla: (mensaje: string) => void) {
    return {
      next: ({ url }: { url: string }) => {
        this.irA(pestana, url);
        ok();
      },
      error: (err: HttpErrorResponse) => {
        pestana?.close();
        falla(
          err.status === 0
            ? `No se pudo abrir ${nombre}: el servidor no respondió. Espera un minuto y vuelve a intentar.`
            : (err.error?.message ?? `No se pudo abrir ${nombre}.`),
        );
      },
    };
  }

  private abrirPestanaConstruyendo(nombre: string, texto = `Construyendo ${nombre}…`): Window | null {
    const pestana = window.open('', '_blank');
    if (pestana) {
      pestana.document.title = nombre;
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

  private cargarOpciones(aplicacionId: string): Observable<OpcionesInforme> {
    return new Observable<OpcionesInforme>((s) => {
      const guardadas = this.opcionesPorApp.get(aplicacionId);
      if (guardadas) {
        s.next(guardadas);
        s.complete();
        return;
      }
      const sub = this.http.get<OpcionesInforme>(`${environment.apiUrl}/portal/informes/opciones`, { params: { aplicacionId } }).subscribe({
        next: (o) => {
          // Sin meses (la aplicación no respondió) no se guarda: se vuelve a intentar.
          if (o.meses.length) this.opcionesPorApp.set(aplicacionId, o);
          s.next(o);
          s.complete();
        },
        error: (e) => s.error(e),
      });
      return () => sub.unsubscribe();
    });
  }

  // Trae las búsquedas anteriores a la conversación (arriba de lo actual).
  verHistorial(): void {
    if (this.historialMostrado()) return;
    this.historialMostrado.set(true);
    this.intercambios.update((actuales) => [...this.historialGuardado(), ...actuales]);
    this.bajarConversacion();
  }

  // Empieza una conversación nueva (la barra vuelve al medio). No borra nada guardado.
  nuevaConversacion(): void {
    if (this.bloqueada()) return;
    this.intercambios.set([]);
    this.dialogo.set(null);
    this.historialMostrado.set(false);
    this.consulta.set('');
  }

  borrarHistorial(): void {
    this.http.delete(`${environment.apiUrl}/portal/busquedas`).subscribe({
      next: () => {
        this.intercambios.set([]);
        this.historialGuardado.set([]);
        this.dialogo.set(null);
      },
    });
  }

  // ---------- Acordeón ----------
  alternarSeccion(id: string): void {
    this.abiertas.update((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      try {
        localStorage.setItem(CLAVE_ACORDEON, JSON.stringify([...nuevo]));
      } catch {
        /* sin almacenamiento del navegador: solo no se recuerda */
      }
      return nuevo;
    });
  }

  private leerAcordeon(): Set<string> {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ACORDEON) ?? '[]');
      return new Set(Array.isArray(guardado) ? guardado.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  }

  // Etiqueta de tipo de cada aplicación en el acordeón.
  etiquetaTipo(moduloId: string): string {
    if (moduloId === 'automatizacion') return 'Automatización';
    if (moduloId === 'configuracion') return 'Configuración';
    return 'App';
  }

  // ---------- Conversación ----------
  private responder(pregunta: string | null, resultado: ResultadoBusqueda, id: string | null, guardar = true): void {
    this.agregar({ pregunta, tipo: resultado, aplicacionId: id });
    if (guardar && pregunta) this.registrar(pregunta, id, resultado);
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

  private registrar(texto: string, id: string | null, resultado: ResultadoBusqueda): void {
    this.http.post(`${environment.apiUrl}/portal/busquedas`, { texto: texto.slice(0, 200), aplicacionId: id, resultado }).subscribe({ error: () => undefined });
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

  private quitar(id: string): void {
    this.intercambios.update((lista) => lista.filter((x) => x.id !== id));
  }

  // Al aparecer un mensaje, la conversación sube y deja ver lo último junto a la barra.
  private bajarConversacion(): void {
    setTimeout(() => {
      const c = this.conversacion()?.nativeElement;
      c?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }

  // ---------- Marco legal ----------
  // Configuración → Vista desde el panel izquierdo: la misma ventana de la barra superior.
  abrirVista(e: Event): void {
    this.panelConfig.abrir(e.currentTarget as HTMLElement);
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
    if (!this.marcoAbierto()) {
      if (e.key === 'Escape' && this.appsAbierto()) {
        this.appsAbierto.set(false);
        this.botonApps()?.nativeElement.focus();
      }
      return;
    }
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
