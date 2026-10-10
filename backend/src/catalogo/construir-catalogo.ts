import { Acceso } from './entities/acceso.entity';
import { Aplicacion } from './entities/aplicacion.entity';
import { Modulo } from './entities/modulo.entity';
import { RolPortal } from '../usuarios/entities/usuario.entity';

export interface AplicacionVista {
  id: string;
  nombre: string;
  descripcion: string;
  estado: 'activa' | 'proximamente';
  url: string | null;
  // Rol de la persona DENTRO de esa aplicación (null si no aplica).
  rol: string | null;
  alcance: string[] | null;
  ingresoUnico: boolean;
}

export interface ModuloVista {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  aplicaciones: AplicacionVista[];
}

// Decide qué módulos y aplicaciones ve una persona. Es una función pura
// (recibe todo lo que necesita, no consulta nada) para poder probar cada
// regla por separado — esta es la parte donde un error significaría que
// alguien ve algo que no le corresponde.
//
// OJO: esto decide qué se DIBUJA en el portal, no es la protección real.
// Cada aplicación debe verificar el rol y el alcance de la persona en su
// propio backend; ocultar una tarjeta jamás reemplaza eso.
export function construirCatalogo(
  modulos: Modulo[],
  aplicaciones: Aplicacion[],
  rolPortal: RolPortal,
  accesos: Acceso[],
): ModuloVista[] {
  const esSuperadmin = rolPortal === 'superadmin';
  const esAdmin = esSuperadmin || rolPortal === 'admin';
  const accesoPorApp = new Map(accesos.map((a) => [a.aplicacionId, a]));

  const vista = (app: Aplicacion): AplicacionVista | null => {
    const acceso = accesoPorApp.get(app.id);
    let visible: boolean;
    if (app.visibilidad === 'superadmin') visible = esSuperadmin;
    else if (app.visibilidad === 'admin') visible = esAdmin;
    // por_acceso: las "proximamente" son vitrina para todos; las activas,
    // solo para quien tenga acceso (el Superadmin las ve todas).
    else visible = app.estado === 'proximamente' || esSuperadmin || !!acceso;
    if (!visible) return null;

    return {
      id: app.id,
      nombre: app.nombre,
      descripcion: app.descripcion,
      estado: app.estado,
      url: app.estado === 'activa' ? app.url : null,
      rol: acceso?.rol ?? (esSuperadmin && app.visibilidad === 'por_acceso' && app.estado === 'activa' ? 'Superadmin' : null),
      alcance: acceso?.alcance ?? null,
      // Aplicación integrada: se entra con un pase del portal, sin volver a escribir la clave.
      ingresoUnico: app.estado === 'activa' && !!app.manifiesto,
    };
  };

  return [...modulos]
    .sort((a, b) => a.orden - b.orden)
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      icono: m.icono,
      color: m.color,
      aplicaciones: aplicaciones
        .filter((a) => a.moduloId === m.id)
        .sort((a, b) => a.orden - b.orden)
        .map(vista)
        .filter((a): a is AplicacionVista => a !== null),
    }))
    // Un módulo sin ninguna aplicación visible no se dibuja (por eso
    // "Configuración" desaparece para quien no administra).
    .filter((m) => m.aplicaciones.length > 0);
}
