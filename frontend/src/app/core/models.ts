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

// La "ficha" que cada aplicación integrada entrega al portal.
export interface OpcionManifiesto {
  clave: string;
  etiqueta: string;
  descripcion: string;
  porDefecto: Record<string, boolean>;
  fijo?: string[];
  soloSuperadmin?: string[];
}

export interface AplicacionAsignable {
  id: string;
  nombre: string;
  manifiesto: { perfiles: string[]; alcance: 'slep' | 'ninguno'; opciones: OpcionManifiesto[] };
}

export interface ReferenciasAdmin {
  aplicaciones: AplicacionAsignable[];
  sleps: string[];
  editor: { id: string; rolPortal: RolPortal };
}
