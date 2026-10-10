import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { NgClass } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

const API = `${environment.apiUrl}/admin/bitacora`;
const POR_PAGINA = 50;

export interface RegistroBitacora {
  id: string;
  origen: string;
  creadoEn: string;
  personaNombre: string;
  personaPerfil: string;
  accion: string;
  descripcion: string;
  detalle: unknown;
  ip: string | null;
}

// Nombre legible de cada acción (portal y Sumarios). Si aparece una nueva,
// se muestra igual, con su código convertido a texto.
const ACCIONES: Record<string, string> = {
  sesion_iniciada: 'Inicio de sesión', sesion_cerrada: 'Cierre de sesión', ingreso_fallido: 'Ingreso fallido',
  ingreso_aplicacion: 'Entrada a una aplicación',
  persona_creada: 'Persona creada', persona_editada: 'Persona editada', persona_activada: 'Persona activada', persona_desactivada: 'Persona desactivada',
  perfil_creado: 'Perfil creado', perfil_editado: 'Perfil editado', perfil_eliminado: 'Perfil eliminado',
  formulario_guardado: 'Formulario guardado', excel_cargado: 'Excel cargado',
  mes_creado: 'Mes creado', mes_cerrado: 'Mes cerrado', mes_abierto: 'Mes reabierto', mes_eliminado: 'Mes eliminado',
  usuario_creado: 'Usuario creado', usuario_editado: 'Usuario editado', usuario_activado: 'Usuario activado', usuario_desactivado: 'Usuario desactivado',
  carga_datos_permitida: 'Carga de datos permitida', carga_datos_quitada: 'Carga de datos quitada',
  perfil_creado_sumarios: 'Perfil creado',
};

// Acciones que conviene destacar al recorrer la lista.
const DESTACADAS: Record<string, string> = {
  ingreso_fallido: 'bg-[#fff1f3] text-[#b4112b]', persona_desactivada: 'bg-[#fff1f3] text-[#b4112b]', perfil_eliminado: 'bg-[#fff1f3] text-[#b4112b]',
  mes_eliminado: 'bg-[#fff1f3] text-[#b4112b]', mes_abierto: 'bg-[#fff4e5] text-[#a14e00]', perfil_editado: 'bg-[#fff4e5] text-[#a14e00]',
};

// Nombre legible de cada campo en la tabla "antes → después".
const CAMPOS: Record<string, string> = {
  nombreParaMostrar: 'Nombre', usuario: 'Usuario', rut: 'RUT', rolPortal: 'Rol en el portal', accesos: 'Accesos',
  nombre: 'Nombre', descripcion: 'Descripción', color: 'Color', permisos: 'Permisos', restricciones: 'Restricciones',
};

const FECHA = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' });
const HORA = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

// Configuración → Bitácora: todo lo que pasa en el portal y en cada
// aplicación integrada. Admin y Superadmin ven todo. Solo lectura.
@Component({
  selector: 'app-bitacora',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './bitacora.component.html',
})
export class BitacoraComponent implements OnInit {
  // Filtros
  readonly origen = signal('');
  readonly persona = signal('');
  readonly accion = signal('');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly texto = signal('');

  readonly opciones = signal<{ origenes: { id: string; nombre: string }[]; acciones: string[]; personas: string[] } | null>(null);
  readonly filas = signal<RegistroBitacora[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly mensajeError = signal('');
  readonly abierto = signal<string | null>(null);
  readonly descargando = signal(false);
  readonly aviso = signal('');

  readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  readonly hayFiltros = computed(() => !!(this.origen() || this.persona() || this.accion() || this.desde() || this.hasta() || this.texto()));

  private demora?: ReturnType<typeof setTimeout>;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<NonNullable<ReturnType<typeof this.opciones>>>(`${API}/opciones`).subscribe({ next: (o) => this.opciones.set(o), error: () => undefined });
    this.cargar();
  }

  private parametros(): HttpParams {
    let p = new HttpParams();
    if (this.origen()) p = p.set('origen', this.origen());
    if (this.persona()) p = p.set('persona', this.persona());
    if (this.accion()) p = p.set('accion', this.accion());
    // Los días se interpretan en hora de Chile (la hora de este navegador).
    if (this.desde()) p = p.set('desde', new Date(`${this.desde()}T00:00:00`).toISOString());
    if (this.hasta()) p = p.set('hasta', new Date(`${this.hasta()}T23:59:59.999`).toISOString());
    if (this.texto().trim()) p = p.set('q', this.texto().trim());
    return p;
  }

  cargar(): void {
    this.estado.set('cargando');
    this.abierto.set(null);
    const p = this.parametros().set('pagina', this.pagina()).set('porPagina', POR_PAGINA);
    this.http.get<{ total: number; filas: RegistroBitacora[] }>(API, { params: p }).subscribe({
      next: (r) => {
        this.filas.set(r.filas);
        this.total.set(r.total);
        this.estado.set('listo');
      },
      error: (err: HttpErrorResponse) => {
        this.mensajeError.set(err.status === 0 ? 'No se pudo conectar con el servidor. Espera un minuto y vuelve a intentar.' : (err.error?.message ?? 'No se pudo cargar la Bitácora.'));
        this.estado.set('error');
      },
    });
  }

  // Cualquier cambio de filtro vuelve a la página 1. El buscador espera a que
  // se termine de escribir.
  filtrar(inmediato = true): void {
    clearTimeout(this.demora);
    const ir = () => {
      this.pagina.set(1);
      this.cargar();
    };
    if (inmediato) ir();
    else this.demora = setTimeout(ir, 350);
  }

  limpiar(): void {
    this.origen.set('');
    this.persona.set('');
    this.accion.set('');
    this.desde.set('');
    this.hasta.set('');
    this.texto.set('');
    this.filtrar();
  }

  irA(pagina: number): void {
    if (pagina < 1 || pagina > this.paginas()) return;
    this.pagina.set(pagina);
    this.cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  alternar(id: string): void {
    this.abierto.set(this.abierto() === id ? null : id);
  }

  descargarExcel(): void {
    if (this.descargando()) return;
    this.descargando.set(true);
    this.http.get(`${API}/excel`, { params: this.parametros(), responseType: 'blob', observe: 'response' }).subscribe({
      next: (r) => {
        this.descargando.set(false);
        const nombre = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'bitacora.xlsx';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(r.body!);
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(a.href);
        if (r.headers.get('X-Bitacora-Truncado') === 'si') this.mostrarAviso('El Excel trae los 50.000 registros más recientes. Usa los filtros para acotar.');
      },
      error: () => {
        this.descargando.set(false);
        this.mostrarAviso('No se pudo descargar el Excel. Intenta de nuevo.');
      },
    });
  }

  // ---------- Lo que se muestra ----------

  nombreAccion(a: string): string {
    return ACCIONES[a] ?? a.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  claseAccion(a: string): string {
    return DESTACADAS[a] ?? 'bg-[#f1f4f9] text-slate-600';
  }

  nombreOrigen(id: string): string {
    return id === 'portal' ? 'Portal' : (this.opciones()?.origenes.find((o) => o.id === id)?.nombre ?? id);
  }

  fecha(iso: string): string {
    return FECHA.format(new Date(iso));
  }

  hora(iso: string): string {
    return HORA.format(new Date(iso));
  }

  // Si el detalle trae "cambios" (antes → después), se muestra como tabla.
  cambios(detalle: unknown): { campo: string; antes: string; despues: string }[] {
    const c = (detalle as { cambios?: Record<string, { antes: unknown; despues: unknown }> } | null)?.cambios;
    if (!c) return [];
    return Object.entries(c).map(([campo, v]) => ({ campo: CAMPOS[campo] ?? campo, antes: legible(v.antes), despues: legible(v.despues) }));
  }

  lista(detalle: unknown, clave: string): string[] {
    const v = (detalle as Record<string, unknown> | null)?.[clave];
    return Array.isArray(v) ? (v as string[]) : [];
  }

  json(detalle: unknown): string {
    return JSON.stringify(detalle, null, 2);
  }

  private mostrarAviso(t: string): void {
    this.aviso.set(t);
    setTimeout(() => this.aviso() === t && this.aviso.set(''), 6000);
  }
}

function legible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}
