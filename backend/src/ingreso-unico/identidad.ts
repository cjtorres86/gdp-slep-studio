import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

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
  rol: string | null;
  alcance: string[];
  opciones: Record<string, boolean>;
}

export function identidadPara(u: Usuario, app: Aplicacion): Identidad {
  const esSuperadmin = u.rolPortal === 'superadmin';
  const acceso = (u.accesos ?? []).find((a) => a.aplicacionId === app.id);
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
  };
}

// La clave secreta de cada aplicación vive en la configuración del servidor
// (Render), nunca en el código ni en la base: CLAVE_APP_<ID EN MAYÚSCULAS>,
// ej. CLAVE_APP_REPORTE_AVANCE_SUMARIOS.
export const variableClave = (aplicacionId: string) => `CLAVE_APP_${aplicacionId.toUpperCase()}`;
