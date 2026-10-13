export type RolPortal = 'superadmin' | 'admin' | 'usuario';

export interface UsuarioPortal {
  id: string;
  usuario: string | null;
  nombreParaMostrar: string;
  rolPortal: RolPortal;
}

export interface LoginRespuesta {
  accessToken: string;
  usuario: UsuarioPortal;
}

export interface AplicacionVista {
  id: string;
  nombre: string;
  descripcion: string;
  estado: 'activa' | 'proximamente';
  url: string | null;
  rol: string | null;
  alcance: string[] | null;
  // Aplicación integrada: se entra con un pase del portal, sin volver a escribir la clave.
  ingresoUnico: boolean;
  // Todas las aplicaciones se muestran a todos; false = no puede entrar.
  autorizado: boolean;
}

// Informes que entregan las aplicaciones (asistente de la pantalla de inicio).
export interface PreguntaInforme {
  clave: 'mes' | 'slep';
  texto: string;
  opcionTodos: string | null; // null = hay que elegir uno
}
export interface InformeVista {
  id: string;
  aplicacionId: string;
  nombre: string;
  descripcion: string;
  formato: 'excel' | 'interactivo' | 'pdf';
  palabrasClave: string[];
  preguntas: PreguntaInforme[];
  autorizado: boolean;
  sleps: 'todos' | string[];
}
export interface OpcionesInforme {
  meses: { mes: string; anio: string }[];
  sleps: string[];
}

// Historial del asistente de la pantalla de inicio.
export type ResultadoBusqueda = 'abrir' | 'proximamente' | 'sin_autorizacion' | 'sin_resultados';
export interface BusquedaHistorial {
  id: string;
  texto: string;
  aplicacionId: string | null;
  resultado: ResultadoBusqueda;
  creadoEn: string;
}

export interface ModuloVista {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  aplicaciones: AplicacionVista[];
}

// ---------- Configuración · Usuarios y accesos ----------

export interface AccesoPersona {
  aplicacionId: string;
  rol: string;
  alcance: string[];
  opciones: Record<string, boolean>;
}

export interface PersonaAdmin {
  id: string;
  usuario: string | null;
  nombreParaMostrar: string;
  rut: string | null;
  rolPortal: RolPortal;
  activo: boolean;
  pendiente: boolean;
  creadoEn: string;
  accesos: AccesoPersona[];
}

// ---------- Perfiles de las aplicaciones integradas ----------

export type ModoCarga = 'siempre' | 'opcional_si' | 'opcional_no' | 'nunca';

export interface RestriccionesPerfil {
  exigeSlep: boolean;
  carga: ModoCarga;
  cargaSoloSuperadmin: boolean;
}

export interface PerfilResumen {
  id: string;
  aplicacionId: string;
  nombre: string;
  color: string;
  restricciones: RestriccionesPerfil;
}

export interface PermisoCatalogo {
  clave: string;
  grupo: string;
  tipo: 'vista' | 'accion';
  etiqueta: string;
  descripcion: string;
  sensible?: boolean;
  requiere?: string[];
  requiereCarga?: boolean;
}

export interface PerfilCompleto extends PerfilResumen {
  descripcion: string;
  permisos: string[];
  orden: number;
  personas: number;
}

export interface PerfilesAdmin {
  puedeEditar: boolean;
  aplicaciones: { id: string; nombre: string; catalogo: PermisoCatalogo[]; perfiles: PerfilCompleto[] }[];
}

// La "ficha" que cada aplicación integrada entrega al portal.
export interface OpcionManifiesto {
  clave: string;
  etiqueta: string;
  descripcion: string;
}

export interface AplicacionAsignable {
  id: string;
  nombre: string;
  // slep: uno o más SLEP · slep_uno: un solo SLEP (o todos) · ninguno
  manifiesto: { permisos: PermisoCatalogo[]; alcance: 'slep' | 'slep_uno' | 'ninguno'; opciones: OpcionManifiesto[] };
}

export interface ReferenciasAdmin {
  aplicaciones: AplicacionAsignable[];
  perfiles: PerfilResumen[];
  sleps: string[];
  editor: { id: string; rolPortal: RolPortal };
}
