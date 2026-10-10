import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NgClass } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { atraparTab } from '../../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../../core/bloquear-fondo';
import { ModoCarga, PerfilCompleto, PerfilesAdmin, PermisoCatalogo, RestriccionesPerfil } from '../../../core/models';

const API = `${environment.apiUrl}/admin/perfiles`;

// Perfiles del portal: fijos (las reglas de seguridad dependen de ellos).
const PERFILES_PORTAL = [
  { id: 'portal_usuario', nombre: 'Usuario', color: '#64748B', descripcion: 'Entra a las aplicaciones que se le asignen.', puede: ['Entrar al portal y a sus aplicaciones', 'Usar el ingreso único (sin volver a escribir la clave)'] },
  { id: 'portal_admin', nombre: 'Administrador', color: '#006BB9', descripcion: 'Además administra a las personas.', puede: ['Todo lo del Usuario', 'Crear, editar y desactivar personas', 'Asignar accesos, perfiles y SLEP', 'Ver los perfiles y la Bitácora', 'Ver la Documentación del proyecto'] },
  { id: 'portal_superadmin', nombre: 'Superadmin', color: '#25306B', descripcion: 'Control total del portal y de todas las aplicaciones.', puede: ['Todo lo del Administrador', 'Crear, editar y eliminar perfiles', 'Administrar a otros Administradores y Superadmin', 'Entrar a todas las aplicaciones con todos los permisos'] },
];

const MODOS_CARGA: { valor: ModoCarga; nombre: string; detalle: string }[] = [
  { valor: 'siempre', nombre: 'Siempre', detalle: 'Todas las personas con este perfil cargan datos.' },
  { valor: 'opcional_si', nombre: 'Opcional · activada', detalle: 'Parte activada; se puede quitar persona por persona.' },
  { valor: 'opcional_no', nombre: 'Opcional · desactivada', detalle: 'Parte desactivada; se puede activar persona por persona.' },
  { valor: 'nunca', nombre: 'Nunca', detalle: 'Nadie con este perfil puede cargar datos.' },
];

export const COLORES = ['#006BB9', '#1D9FD0', '#4A7D12', '#64748B', '#7C3AED', '#C2410C', '#B4112B', '#25306B'];

interface Borrador {
  id: string | null; // null = perfil nuevo
  aplicacionId: string;
  nombre: string;
  descripcion: string;
  color: string;
  permisos: string[];
  restricciones: RestriccionesPerfil;
}

// Configuración → Perfiles. Admin y Superadmin los ven; solo el Superadmin
// los crea, edita o elimina (el servidor también lo verifica).
@Component({
  selector: 'app-perfiles',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './perfiles.component.html',
})
export class PerfilesComponent implements OnInit {
  readonly perfilesPortal = PERFILES_PORTAL;
  readonly modosCarga = MODOS_CARGA;
  readonly colores = COLORES;

  readonly datos = signal<PerfilesAdmin | null>(null);
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly mensajeError = signal('');
  readonly aviso = signal('');

  // Selección: un perfil del portal (solo lectura) o uno de aplicación (editable).
  readonly seleccionPortal = signal<string | null>(null);
  readonly borrador = signal<Borrador | null>(null);
  private original = '';
  readonly guardando = signal(false);
  readonly errorEditor = signal('');

  // Confirmaciones (descartar cambios / eliminar).
  readonly confirmar = signal<{ tipo: 'descartar' | 'eliminar'; titulo: string; texto: string; accion: () => void } | null>(null);
  private readonly ventanaConfirmar = viewChild<ElementRef<HTMLElement>>('ventanaConfirmar');

  readonly puedeEditar = computed(() => !!this.datos()?.puedeEditar);

  readonly app = computed(() => {
    const b = this.borrador();
    return b ? this.datos()?.aplicaciones.find((a) => a.id === b.aplicacionId) : undefined;
  });

  // Catálogo agrupado (Pantallas, Carga de datos, Gestión de meses…).
  readonly grupos = computed(() => {
    const cat = this.app()?.catalogo ?? [];
    const orden: string[] = [];
    for (const c of cat) if (!orden.includes(c.grupo)) orden.push(c.grupo);
    return orden.map((g) => ({ nombre: g, permisos: cat.filter((c) => c.grupo === g) }));
  });

  readonly hayCambios = computed(() => {
    const b = this.borrador();
    return !!b && JSON.stringify(b) !== this.original;
  });

  readonly perfilActual = computed(() => {
    const b = this.borrador();
    return b?.id ? this.app()?.perfiles.find((p) => p.id === b.id) : undefined;
  });

  constructor(private readonly http: HttpClient) {
    bloquearFondoMientras(this.confirmar);
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(seleccionar?: string): void {
    this.http.get<PerfilesAdmin>(API).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estado.set('listo');
        const id = seleccionar ?? this.borrador()?.id ?? d.aplicaciones[0]?.perfiles[0]?.id;
        const p = d.aplicaciones.flatMap((a) => a.perfiles).find((x) => x.id === id);
        if (p) this.abrir(p);
      },
      error: (err: HttpErrorResponse) => {
        this.mensajeError.set(mensajeDe(err, 'No se pudieron cargar los perfiles.'));
        this.estado.set('error');
      },
    });
  }

  // ---------- Selección ----------

  // Si hay cambios sin guardar, se pregunta antes de cambiar de perfil.
  private siNoHayCambios(seguir: () => void): void {
    if (!this.hayCambios()) return seguir();
    this.pedirConfirmacion('descartar', 'Tienes cambios sin guardar', `Si continúas, se pierden los cambios en "${this.borrador()?.nombre || 'perfil nuevo'}".`, seguir);
  }

  elegirPerfil(p: PerfilCompleto): void {
    if (this.borrador()?.id === p.id && !this.seleccionPortal()) return;
    this.siNoHayCambios(() => this.abrir(p));
  }

  elegirPortal(id: string): void {
    this.siNoHayCambios(() => {
      this.borrador.set(null);
      this.seleccionPortal.set(id);
    });
  }

  private abrir(p: PerfilCompleto): void {
    this.seleccionPortal.set(null);
    this.errorEditor.set('');
    this.fijarBorrador({
      id: p.id,
      aplicacionId: p.aplicacionId,
      nombre: p.nombre,
      descripcion: p.descripcion,
      color: p.color,
      permisos: [...p.permisos],
      restricciones: { ...p.restricciones },
    });
  }

  private fijarBorrador(b: Borrador): void {
    this.borrador.set(b);
    this.original = JSON.stringify(b);
  }

  nuevo(aplicacionId: string): void {
    this.siNoHayCambios(() => {
      const pantallas = (this.datos()?.aplicaciones.find((a) => a.id === aplicacionId)?.catalogo ?? []).filter((c) => c.tipo === 'vista').map((c) => c.clave);
      this.seleccionPortal.set(null);
      this.errorEditor.set('');
      this.original = '';
      // Un perfil nuevo parte "solo mirando": todas las pantallas, ninguna acción.
      this.borrador.set({ id: null, aplicacionId, nombre: '', descripcion: '', color: '#7C3AED', permisos: pantallas, restricciones: { exigeSlep: false, carga: 'nunca', cargaSoloSuperadmin: false } });
    });
  }

  duplicar(): void {
    const b = this.borrador();
    if (!b?.id) return;
    this.siNoHayCambios(() => {
      this.original = '';
      this.borrador.set({ ...structuredClone(b), id: null, nombre: `${b.nombre} (copia)` });
      this.errorEditor.set('');
    });
  }

  // ---------- Edición ----------

  // Para contar cuántos permisos de un grupo están activos.
  tienePermisoEnBorrador(b: Borrador) {
    return (c: PermisoCatalogo) => b.permisos.includes(c.clave);
  }

  tiene(clave: string): boolean {
    return !!this.borrador()?.permisos.includes(clave);
  }

  // Por qué un permiso no se puede activar ahora (dependencias), o '' si se puede.
  motivoBloqueo(c: PermisoCatalogo): string {
    const b = this.borrador();
    if (!b) return '';
    if (c.requiereCarga && b.restricciones.carga === 'nunca') return 'No aplica: este perfil nunca carga datos.';
    const falta = c.requiere?.find((x) => !b.permisos.includes(x));
    if (falta) return `Primero activa "${this.app()?.catalogo.find((x) => x.clave === falta)?.etiqueta ?? falta}".`;
    return '';
  }

  alternar(c: PermisoCatalogo): void {
    const b = this.borrador();
    if (!b || !this.puedeEditar()) return;
    if (this.tiene(c.clave)) {
      // Al quitar un permiso, también se quitan los que dependen de él.
      const dependientes = (this.app()?.catalogo ?? []).filter((x) => x.requiere?.includes(c.clave)).map((x) => x.clave);
      b.permisos = b.permisos.filter((k) => k !== c.clave && !dependientes.includes(k));
    } else if (!this.motivoBloqueo(c)) {
      b.permisos = [...b.permisos, c.clave];
    }
    this.borrador.set({ ...b });
  }

  cambiarCarga(modo: ModoCarga): void {
    const b = this.borrador();
    if (!b || !this.puedeEditar()) return;
    b.restricciones = { ...b.restricciones, carga: modo, cargaSoloSuperadmin: modo.startsWith('opcional') ? b.restricciones.cargaSoloSuperadmin : false };
    // "Nunca" carga datos: los permisos de carga dejan de tener sentido.
    if (modo === 'nunca') {
      const deCarga = (this.app()?.catalogo ?? []).filter((c) => c.requiereCarga).map((c) => c.clave);
      b.permisos = b.permisos.filter((k) => !deCarga.includes(k));
    }
    this.borrador.set({ ...b });
  }

  alternarRestriccion(clave: 'exigeSlep' | 'cargaSoloSuperadmin'): void {
    const b = this.borrador();
    if (!b || !this.puedeEditar()) return;
    b.restricciones = { ...b.restricciones, [clave]: !b.restricciones[clave] };
    this.borrador.set({ ...b });
  }

  marcar(): void {
    this.borrador.set({ ...this.borrador()! });
  }

  descartar(): void {
    const b = this.borrador();
    if (!b) return;
    if (!b.id) {
      const primero = this.datos()?.aplicaciones[0]?.perfiles[0];
      if (primero) this.abrir(primero);
      else this.borrador.set(null);
      return;
    }
    this.borrador.set(JSON.parse(this.original));
    this.errorEditor.set('');
  }

  guardar(): void {
    const b = this.borrador();
    if (!b || this.guardando()) return;
    if (b.nombre.trim().length < 2) return this.errorEditor.set('El nombre debe tener al menos 2 caracteres.');
    this.guardando.set(true);
    this.errorEditor.set('');
    const cuerpo = { nombre: b.nombre.trim(), descripcion: b.descripcion.trim(), color: b.color, permisos: b.permisos, restricciones: b.restricciones };
    const peticion = b.id
      ? this.http.patch<PerfilCompleto>(`${API}/${b.id}`, cuerpo)
      : this.http.post<PerfilCompleto>(API, { ...cuerpo, aplicacionId: b.aplicacionId });
    peticion.subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.original = '';
        this.mostrarAviso(b.id ? `Cambios guardados en "${p.nombre}". Ya rigen en la aplicación.` : `Perfil "${p.nombre}" creado.`);
        this.cargar(p.id);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorEditor.set(mensajeDe(err, 'No se pudo guardar el perfil.'));
      },
    });
  }

  pedirEliminar(): void {
    const p = this.perfilActual();
    if (!p) return;
    this.pedirConfirmacion('eliminar', `¿Eliminar el perfil "${p.nombre}"?`, 'Se quita del portal y de la aplicación. Solo se puede porque nadie lo tiene asignado.', () => {
      this.http.delete(`${API}/${p.id}`).subscribe({
        next: () => {
          this.mostrarAviso(`Perfil "${p.nombre}" eliminado.`);
          this.borrador.set(null);
          this.original = '';
          this.cargar(this.datos()?.aplicaciones[0]?.perfiles.find((x) => x.id !== p.id)?.id);
        },
        error: (err: HttpErrorResponse) => this.errorEditor.set(mensajeDe(err, 'No se pudo eliminar.')),
      });
    });
  }

  // ---------- Confirmación ----------

  private pedirConfirmacion(tipo: 'descartar' | 'eliminar', titulo: string, texto: string, accion: () => void): void {
    this.confirmar.set({ tipo, titulo, texto, accion });
    setTimeout(() => this.ventanaConfirmar()?.nativeElement.querySelector<HTMLElement>('[data-cancelar]')?.focus());
  }

  aceptarConfirmacion(): void {
    const c = this.confirmar();
    this.confirmar.set(null);
    c?.accion();
  }

  @HostListener('document:keydown', ['$event'])
  alPresionarTecla(e: KeyboardEvent): void {
    if (!this.confirmar()) return;
    if (e.key === 'Escape') this.confirmar.set(null);
    else atraparTab(e, this.ventanaConfirmar()?.nativeElement);
  }

  // Si se intenta cerrar o recargar la pestaña con cambios sin guardar.
  @HostListener('window:beforeunload', ['$event'])
  alSalir(e: BeforeUnloadEvent): void {
    if (this.hayCambios()) e.preventDefault();
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => this.aviso() === texto && this.aviso.set(''), 5000);
  }

  perfilPortal(id: string) {
    return PERFILES_PORTAL.find((p) => p.id === id);
  }
}

function mensajeDe(err: HttpErrorResponse, porDefecto: string): string {
  if (err.status === 0) return 'No se pudo conectar con el servidor. Espera un minuto y vuelve a intentar.';
  const m = err.error?.message;
  if (Array.isArray(m)) return m.join(' ');
  return typeof m === 'string' ? m : porDefecto;
}
