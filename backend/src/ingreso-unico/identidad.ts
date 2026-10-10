import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import type { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';

// Lo que el portal le dice a una aplicación integrada sobre una persona: al
// canjear un pase y cada vez que la persona cambia. La aplicación pone al día
// su copia con esto (contrato de integración).
export interface Identidad {
  portalId: string;
  usuario: string | null;
  nombreParaMostrar: string;
  rut: string | null;
  activo: boolean;
  esSuperadmin: boolean;
  // false = esta persona ya no entra a esta aplicación (se le quitó el acceso).
  tieneAcceso: boolean;
  rol: string | null; // id del perfil (ej. "perfil_digitador") o "Superadmin"
  alcance: string[];
  opciones: Record<string, boolean>;
  // Definición completa del perfil: la aplicación la guarda junto con la
  // persona, así nunca le falta el perfil aunque se haya perdido un aviso.
  perfil: PerfilParaAplicacion | null;
}

export interface PerfilParaAplicacion {
  id: string;
  nombre: string;
  permisos: { vistas: string[]; acciones: string[]; gestion: string[] };
}

// Los permisos del perfil, separados como los guarda la aplicación
// (pantallas y acciones), según el tipo que declara su catálogo.
export function perfilParaAplicacion(p: PerfilAplicacion, app: Aplicacion): PerfilParaAplicacion {
  const tipo = new Map((app.manifiesto?.permisos ?? []).map((c) => [c.clave, c.tipo]));
  return {
    id: p.id,
    nombre: p.nombre,
    permisos: {
      vistas: p.permisos.filter((k) => tipo.get(k) === 'vista'),
      acciones: p.permisos.filter((k) => tipo.get(k) === 'accion'),
      gestion: [],
    },
  };
}

export function identidadPara(u: Usuario, app: Aplicacion, perfiles: PerfilAplicacion[] = []): Identidad {
  const esSuperadmin = u.rolPortal === 'superadmin';
  const acceso = (u.accesos ?? []).find((a) => a.aplicacionId === app.id);
  const perfil = !esSuperadmin && acceso ? perfiles.find((p) => p.id === acceso.rol) : undefined;
  return {
    portalId: u.id,
    usuario: u.usuario,
    nombreParaMostrar: u.nombreParaMostrar,
    rut: u.rut,
    activo: u.activo,
    esSuperadmin,
    tieneAcceso: esSuperadmin || !!acceso,
    rol: esSuperadmin ? 'Superadmin' : (acceso?.rol ?? null),
    alcance: esSuperadmin ? ['todos'] : (acceso?.alcance ?? []),
    opciones: acceso?.opciones ?? {},
    perfil: perfil ? perfilParaAplicacion(perfil, app) : null,
  };
}

// La clave secreta de cada aplicación vive en la configuración del servidor
// (Render), nunca en el código ni en la base: CLAVE_APP_<ID EN MAYÚSCULAS>,
// ej. CLAVE_APP_REPORTE_AVANCE_SUMARIOS.
export const variableClave = (aplicacionId: string) => `CLAVE_APP_${aplicacionId.toUpperCase()}`;
