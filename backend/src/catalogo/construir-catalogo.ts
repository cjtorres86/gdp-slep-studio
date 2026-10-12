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
  // ¿La persona puede entrar? Todas las aplicaciones se muestran a todos;
  // las que no puede abrir llegan sin dirección y con autorizado = false.
  autorizado: boolean;
}

export interface ModuloVista {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  aplicaciones: AplicacionVista[];
}

// Arma el catálogo de una persona. Es una función pura (recibe todo lo que
// necesita, no consulta nada) para poder probar cada regla por separado.
//
// Todas las aplicaciones se muestran a todas las personas (vitrina completa
// del portal). Lo que cambia es si puede ENTRAR (autorizado):
//  - por_acceso: quien tenga una fila de Acceso (el Superadmin, a todas).
//  - admin: Superadmin y Admin del portal.
//  - superadmin: solo el Superadmin.
// A una aplicación no autorizada no se le manda la dirección.
//
// OJO: esto decide qué se DIBUJA en el portal, no es la protección real.
// Cada aplicación debe verificar el rol y el alcance de la persona en su
// propio backend; ocultar una dirección jamás reemplaza eso.
export function construirCatalogo(
  modulos: Modulo[],
  aplicaciones: Aplicacion[],
  rolPortal: RolPortal,
  accesos: Acceso[],
): ModuloVista[] {
  const esSuperadmin = rolPortal === 'superadmin';
  const esAdmin = esSuperadmin || rolPortal === 'admin';
  const accesoPorApp = new Map(accesos.map((a) => [a.aplicacionId, a]));

  const vista = (app: Aplicacion): AplicacionVista => {
    const acceso = accesoPorApp.get(app.id);
    let autorizado: boolean;
    if (app.visibilidad === 'superadmin') autorizado = esSuperadmin;
    else if (app.visibilidad === 'admin') autorizado = esAdmin;
    else autorizado = esSuperadmin || !!acceso;

    return {
      id: app.id,
      nombre: app.nombre,
      descripcion: app.descripcion,
      estado: app.estado,
      url: app.estado === 'activa' && autorizado ? app.url : null,
      rol: acceso?.rol ?? (esSuperadmin && app.visibilidad === 'por_acceso' && app.estado === 'activa' ? 'Superadmin' : null),
      alcance: acceso?.alcance ?? null,
      // Aplicación integrada: se entra con un pase del portal, sin volver a escribir la clave.
      ingresoUnico: app.estado === 'activa' && !!app.manifiesto,
      autorizado,
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
        .map(vista),
    }))
    .filter((m) => m.aplicaciones.length > 0);
}
