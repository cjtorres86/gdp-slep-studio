import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnInit, computed, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { atraparTab } from '../../../core/atrapar-tab';
import { AplicacionAsignable, OpcionManifiesto, PersonaAdmin, ReferenciasAdmin, RolPortal } from '../../../core/models';

// Acceso a UNA aplicación, tal como se edita en el formulario.
interface AccesoEditable {
  activo: boolean;
  rol: string;
  modoAlcance: 'todos' | 'algunos';
  sleps: string[];
  opciones: Record<string, boolean>;
}

interface Borrador {
  id: string | null; // null = persona nueva
  nombreParaMostrar: string;
  usuario: string;
  rut: string;
  rolPortal: RolPortal;
  contrasena: string;
  accesos: Record<string, AccesoEditable>;
}

const API = `${environment.apiUrl}/admin`;

const ROLES: { valor: RolPortal; nombre: string; descripcion: string }[] = [
  { valor: 'usuario', nombre: 'Usuario', descripcion: 'Entra a las aplicaciones que se le asignen.' },
  { valor: 'admin', nombre: 'Administrador', descripcion: 'Además administra personas, perfiles y bitácora.' },
  { valor: 'superadmin', nombre: 'Superadmin', descripcion: 'Control total: entra a todo, con todos los permisos.' },
];

// Configuración · "Usuarios y accesos": crear, editar, activar y desactivar
// personas, y decidir a qué aplicaciones entra cada una (perfil, SLEP y
// opciones como "Puede cargar datos"). Las reglas de quién puede cambiar qué
// las aplica el backend en cada petición; aquí solo se reflejan en pantalla.
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  readonly roles = ROLES;
  readonly personas = signal<PersonaAdmin[]>([]);
  readonly referencias = signal<ReferenciasAdmin | null>(null);
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly mensajeError = signal('');
  readonly aviso = signal('');

  // Filtros
  readonly busqueda = signal('');
  readonly filtroRol = signal<'' | RolPortal>('');
  readonly filtroEstado = signal<'' | 'activa' | 'desactivada' | 'pendiente'>('');
  readonly filtroSlep = signal('');

  readonly filtradas = computed(() => {
    const q = normalizar(this.busqueda());
    return this.personas().filter((p) => {
      if (q && !normalizar(`${p.nombreParaMostrar} ${p.usuario ?? ''} ${p.rut ?? ''}`).includes(q)) return false;
      if (this.filtroRol() && p.rolPortal !== this.filtroRol()) return false;
      if (this.filtroEstado() && this.estadoDe(p) !== this.filtroEstado()) return false;
      const slep = this.filtroSlep();
      if (slep && !p.accesos.some((a) => a.alcance.includes(slep) || a.alcance.includes('todos'))) return false;
      return true;
    });
  });

  readonly resumen = computed(() => {
    const p = this.personas();
    return {
      total: p.length,
      activas: p.filter((x) => this.estadoDe(x) === 'activa').length,
      desactivadas: p.filter((x) => this.estadoDe(x) === 'desactivada').length,
      pendientes: p.filter((x) => this.estadoDe(x) === 'pendiente').length,
    };
  });

  // Ventana de edición
  readonly borrador = signal<Borrador | null>(null);
  private original: PersonaAdmin | null = null;
  readonly guardando = signal(false);
  readonly errorEditor = signal('');
  readonly mostrarClave = signal(false);
  readonly busquedaSlep = signal<Record<string, string>>({});
  private readonly ventanaEditor = viewChild<ElementRef<HTMLElement>>('ventanaEditor');

  // Confirmación de activar/desactivar
  readonly confirmar = signal<PersonaAdmin | null>(null);
  private readonly ventanaConfirmar = viewChild<ElementRef<HTMLElement>>('ventanaConfirmar');
  private disparador: HTMLElement | null = null;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.estado.set('cargando');
    forkJoin({
      personas: this.http.get<PersonaAdmin[]>(`${API}/usuarios`),
      referencias: this.http.get<ReferenciasAdmin>(`${API}/referencias`),
    }).subscribe({
      next: ({ personas, referencias }) => {
        this.personas.set(personas);
        this.referencias.set(referencias);
        this.estado.set('listo');
      },
      error: (err: HttpErrorResponse) => {
        this.mensajeError.set(mensajeDe(err, 'No se pudo cargar la lista de personas.'));
        this.estado.set('error');
      },
    });
  }

  // ---------- Lo que se muestra en la tabla ----------

  estadoDe(p: PersonaAdmin): 'activa' | 'desactivada' | 'pendiente' {
    if (!p.activo) return 'desactivada';
    return p.pendiente ? 'pendiente' : 'activa';
  }

  nombreRol(rol: RolPortal): string {
    return ROLES.find((r) => r.valor === rol)?.nombre ?? rol;
  }

  nombreApp(id: string): string {
    return this.referencias()?.aplicaciones.find((a) => a.id === id)?.nombre ?? id;
  }

  textoAlcance(alcance: string[]): string {
    if (alcance.includes('todos')) return 'Todos los SLEP';
    return alcance.length <= 2 ? alcance.join(', ') : `${alcance.slice(0, 2).join(', ')} +${alcance.length - 2}`;
  }

  get editorId(): string {
    return this.referencias()?.editor.id ?? '';
  }

  get editorEsSuperadmin(): boolean {
    return this.referencias()?.editor.rolPortal === 'superadmin';
  }

  // Un Admin no puede tocar a un Superadmin (el backend también lo impide).
  puedeEditar(p: PersonaAdmin): boolean {
    return this.editorEsSuperadmin || p.rolPortal !== 'superadmin';
  }

  puedeCambiarEstado(p: PersonaAdmin): boolean {
    return this.puedeEditar(p) && p.id !== this.editorId;
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroRol.set('');
    this.filtroEstado.set('');
    this.filtroSlep.set('');
  }

  // ---------- Ventana de edición ----------

  abrirNueva(e: Event): void {
    this.disparador = e.currentTarget as HTMLElement;
    this.original = null;
    this.abrirEditor({ id: null, nombreParaMostrar: '', usuario: '', rut: '', rolPortal: 'usuario', contrasena: '', accesos: this.accesosEditables(null) });
  }

  abrirEdicion(p: PersonaAdmin, e: Event): void {
    this.disparador = e.currentTarget as HTMLElement;
    this.original = p;
    this.abrirEditor({
      id: p.id,
      nombreParaMostrar: p.nombreParaMostrar,
      usuario: p.usuario ?? '',
      rut: p.rut ?? '',
      rolPortal: p.rolPortal,
      contrasena: '',
      accesos: this.accesosEditables(p),
    });
  }

  private abrirEditor(b: Borrador): void {
    this.errorEditor.set('');
    this.mostrarClave.set(false);
    this.busquedaSlep.set({});
    this.borrador.set(b);
    setTimeout(() => this.ventanaEditor()?.nativeElement.querySelector<HTMLElement>('input')?.focus());
  }

  cerrarEditor(): void {
    if (!this.borrador()) return;
    this.borrador.set(null);
    setTimeout(() => this.disparador?.focus());
  }

  private accesosEditables(p: PersonaAdmin | null): Record<string, AccesoEditable> {
    const r: Record<string, AccesoEditable> = {};
    for (const app of this.referencias()?.aplicaciones ?? []) {
      const actual = p?.accesos.find((a) => a.aplicacionId === app.id);
      const rol = actual?.rol && app.manifiesto.perfiles.includes(actual.rol) ? actual.rol : app.manifiesto.perfiles[app.manifiesto.perfiles.length - 1];
      r[app.id] = {
        activo: !!actual && app.manifiesto.perfiles.includes(actual.rol),
        rol,
        modoAlcance: !actual || actual.alcance.includes('todos') ? 'todos' : 'algunos',
        sleps: actual && !actual.alcance.includes('todos') ? [...actual.alcance] : [],
        opciones: this.opcionesPara(app, rol),
      };
    }
    return r;
  }

  // Valor de cada opción para un perfil: el que la persona ya tenía (si es
  // el mismo perfil) o el valor por defecto de ese perfil.
  private opcionesPara(app: AplicacionAsignable, rol: string): Record<string, boolean> {
    const actual = this.original?.accesos.find((a) => a.aplicacionId === app.id);
    const o: Record<string, boolean> = {};
    for (const op of app.manifiesto.opciones) {
      const porDefecto = op.porDefecto[rol] ?? false;
      o[op.clave] = op.fijo?.includes(rol) ? porDefecto : actual?.rol === rol ? (actual.opciones[op.clave] ?? porDefecto) : porDefecto;
    }
    return o;
  }

  cambiarPerfil(app: AplicacionAsignable, rol: string): void {
    const a = this.borrador()!.accesos[app.id];
    a.rol = rol;
    a.opciones = this.opcionesPara(app, rol);
  }

  // ¿Se puede cambiar esta opción en este perfil? (Si no, se explica por qué.)
  motivoBloqueo(op: OpcionManifiesto, rol: string): string {
    if (op.fijo?.includes(rol)) return `El perfil ${rol} siempre tiene esta opción.`;
    if (op.soloSuperadmin?.includes(rol) && !this.editorEsSuperadmin) return `Solo el Superadmin puede cambiarla en el perfil ${rol}.`;
    return '';
  }

  alternarSlep(appId: string, slep: string): void {
    const a = this.borrador()!.accesos[appId];
    a.sleps = a.sleps.includes(slep) ? a.sleps.filter((s) => s !== slep) : [...a.sleps, slep];
  }

  slepsVisibles(appId: string): string[] {
    const q = normalizar(this.busquedaSlep()[appId] ?? '');
    return (this.referencias()?.sleps ?? []).filter((s) => !q || normalizar(s).includes(q));
  }

  buscarSlep(appId: string, texto: string): void {
    this.busquedaSlep.update((b) => ({ ...b, [appId]: texto }));
  }

  get editandoseASiMismo(): boolean {
    return !!this.borrador()?.id && this.borrador()!.id === this.editorId;
  }

  rolesDisponibles() {
    // El rol Superadmin solo lo puede dar un Superadmin.
    return ROLES.filter((r) => r.valor !== 'superadmin' || this.editorEsSuperadmin || this.borrador()?.rolPortal === 'superadmin');
  }

  guardar(): void {
    const b = this.borrador();
    if (!b || this.guardando()) return;
    if (!b.nombreParaMostrar.trim()) return this.errorEditor.set('Escribe el nombre de la persona.');
    if (b.contrasena && b.contrasena.length < 8) return this.errorEditor.set('La clave debe tener al menos 8 caracteres.');
    const accesos = [];
    for (const app of this.referencias()?.aplicaciones ?? []) {
      const a = b.accesos[app.id];
      if (!a?.activo) continue;
      if (app.manifiesto.alcance === 'slep' && a.modoAlcance === 'algunos' && !a.sleps.length) {
        return this.errorEditor.set(`Elige al menos un SLEP para ${app.nombre}, o marca "Todos los SLEP".`);
      }
      accesos.push({ aplicacionId: app.id, rol: a.rol, alcance: a.modoAlcance === 'todos' ? ['todos'] : a.sleps, opciones: a.opciones });
    }
    const cuerpo: Record<string, unknown> = {
      nombreParaMostrar: b.nombreParaMostrar.trim(),
      usuario: b.usuario.trim() || undefined,
      rut: b.rut.trim(),
      rolPortal: b.rolPortal,
      ...(b.contrasena ? { contrasena: b.contrasena } : {}),
      ...(b.rolPortal !== 'superadmin' ? { accesos } : {}),
    };
    this.guardando.set(true);
    this.errorEditor.set('');
    const peticion = b.id
      ? this.http.patch<PersonaAdmin>(`${API}/usuarios/${b.id}`, cuerpo)
      : this.http.post<PersonaAdmin>(`${API}/usuarios`, cuerpo);
    peticion.subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.personas.update((lista) => (b.id ? lista.map((x) => (x.id === p.id ? p : x)) : [...lista, p].sort((x, y) => x.nombreParaMostrar.localeCompare(y.nombreParaMostrar))));
        this.cerrarEditor();
        this.mostrarAviso(b.id ? `Cambios guardados: ${p.nombreParaMostrar}.` : `Persona creada: ${p.nombreParaMostrar}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorEditor.set(mensajeDe(err, 'No se pudo guardar.'));
      },
    });
  }

  // ---------- Activar / desactivar ----------

  pedirCambioEstado(p: PersonaAdmin, e: Event): void {
    this.disparador = e.currentTarget as HTMLElement;
    this.confirmar.set(p);
    setTimeout(() => this.ventanaConfirmar()?.nativeElement.querySelector<HTMLElement>('[data-cancelar]')?.focus());
  }

  cerrarConfirmar(): void {
    if (!this.confirmar()) return;
    this.confirmar.set(null);
    setTimeout(() => this.disparador?.focus());
  }

  confirmarCambioEstado(): void {
    const p = this.confirmar();
    if (!p) return;
    this.http.post<PersonaAdmin>(`${API}/usuarios/${p.id}/estado`, { activo: !p.activo }).subscribe({
      next: (r) => {
        this.personas.update((lista) => lista.map((x) => (x.id === r.id ? r : x)));
        this.cerrarConfirmar();
        this.mostrarAviso(r.activo ? `${r.nombreParaMostrar} puede volver a entrar.` : `${r.nombreParaMostrar} ya no puede entrar.`);
      },
      error: (err: HttpErrorResponse) => {
        this.cerrarConfirmar();
        this.mostrarAviso(mensajeDe(err, 'No se pudo cambiar el estado.'));
      },
    });
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => this.aviso() === texto && this.aviso.set(''), 5000);
  }

  @HostListener('document:keydown', ['$event'])
  alPresionarTecla(e: KeyboardEvent): void {
    if (this.confirmar()) {
      if (e.key === 'Escape') this.cerrarConfirmar();
      else atraparTab(e, this.ventanaConfirmar()?.nativeElement);
    } else if (this.borrador()) {
      if (e.key === 'Escape') this.cerrarEditor();
      else atraparTab(e, this.ventanaEditor()?.nativeElement);
    }
  }
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function mensajeDe(err: HttpErrorResponse, porDefecto: string): string {
  if (err.status === 0) return 'No se pudo conectar con el servidor. Espera un minuto y vuelve a intentar.';
  const m = err.error?.message;
  if (Array.isArray(m)) return m.join(' ');
  return typeof m === 'string' ? m : porDefecto;
}
