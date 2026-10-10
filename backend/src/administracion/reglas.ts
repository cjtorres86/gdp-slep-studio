import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { RolPortal } from '../usuarios/entities/usuario.entity';

// Reglas de "Usuarios y accesos", separadas como funciones puras para
// poder probarlas una por una (ver reglas.spec.ts). El servicio las aplica;
// aquí no se toca la base de datos.

export interface Editor {
  id: string;
  rolPortal: RolPortal;
}

export interface PersonaObjetivo {
  id: string;
  rolPortal: RolPortal;
}

export interface AccesoPedido {
  aplicacionId: string;
  rol: string;
  alcance: string[];
  opciones?: Record<string, boolean>;
}

export interface AccesoNormalizado {
  aplicacionId: string;
  rol: string;
  alcance: string[];
  opciones: Record<string, boolean>;
}

export const esAdministrador = (rol: RolPortal) => rol === 'admin' || rol === 'superadmin';

// ¿Puede "editor" crear o cambiar a "objetivo" (null = persona nueva) con
// estos cambios? Devuelve el motivo del rechazo, o null si está permitido.
export function motivoRechazo(
  editor: Editor,
  objetivo: PersonaObjetivo | null,
  cambios: { rolPortal?: RolPortal; activo?: boolean },
): string | null {
  const editorEsSuperadmin = editor.rolPortal === 'superadmin';
  if (objetivo?.rolPortal === 'superadmin' && !editorEsSuperadmin) {
    return 'Solo el Superadmin puede modificar la cuenta de un Superadmin.';
  }
  if (cambios.rolPortal === 'superadmin' && !editorEsSuperadmin && objetivo?.rolPortal !== 'superadmin') {
    return 'Solo el Superadmin puede dar el rol de Superadmin.';
  }
  if (objetivo && objetivo.id === editor.id) {
    if (cambios.rolPortal && cambios.rolPortal !== objetivo.rolPortal) return 'No puedes cambiar tu propio rol en el portal.';
    if (cambios.activo === false) return 'No puedes desactivar tu propia cuenta.';
  }
  return null;
}

// Valida y completa los accesos pedidos contra la ficha (manifiesto) de cada
// aplicación. Lo que la aplicación no declara, no se acepta.
export function normalizarAccesos(
  editor: Editor,
  pedidos: AccesoPedido[],
  actuales: AccesoNormalizado[],
  aplicaciones: Map<string, Aplicacion>,
  slepsOficiales: string[],
): { accesos: AccesoNormalizado[] } | { error: string } {
  const vistos = new Set<string>();
  const resultado: AccesoNormalizado[] = [];
  for (const p of pedidos) {
    const app = aplicaciones.get(p.aplicacionId);
    if (!app || app.estado !== 'activa' || app.visibilidad !== 'por_acceso' || !app.manifiesto) {
      return { error: `La aplicación "${p.aplicacionId}" no se puede asignar.` };
    }
    if (vistos.has(app.id)) return { error: `La aplicación "${app.nombre}" está repetida.` };
    vistos.add(app.id);

    const m = app.manifiesto;
    if (!m.perfiles.includes(p.rol)) return { error: `"${p.rol}" no es un perfil de ${app.nombre}.` };

    // Alcance: "todos" o uno o más SLEP de la lista oficial (sin repetir y
    // en el orden oficial).
    let alcance: string[] = ['todos'];
    if (m.alcance === 'slep' || m.alcance === 'slep_uno') {
      const pedido = (p.alcance ?? []).map((s) => s.trim()).filter(Boolean);
      if (pedido.includes('todos')) {
        alcance = ['todos'];
      } else {
        if (!pedido.length) return { error: `Elige al menos un SLEP para ${app.nombre}.` };
        const desconocido = pedido.find((s) => !slepsOficiales.includes(s));
        if (desconocido) return { error: `"${desconocido}" no es un SLEP de la lista oficial.` };
        alcance = slepsOficiales.filter((s) => pedido.includes(s));
        if (m.alcance === 'slep_uno' && alcance.length > 1) {
          return { error: `${app.nombre} admite un solo SLEP por persona (o "Todos los SLEP").` };
        }
      }
    }

    // Opciones individuales (ej. "Puede cargar datos").
    const actual = actuales.find((a) => a.aplicacionId === app.id);
    const mismoPerfil = actual?.rol === p.rol;
    const opciones: Record<string, boolean> = {};
    for (const op of m.opciones) {
      const porDefecto = op.porDefecto[p.rol] ?? false;
      const valorActual = mismoPerfil ? actual?.opciones?.[op.clave] : undefined;
      if (op.fijo?.includes(p.rol)) {
        opciones[op.clave] = porDefecto;
      } else if (op.soloSuperadmin?.includes(p.rol) && editor.rolPortal !== 'superadmin') {
        // Un Admin no puede cambiarla en este perfil: se conserva lo que había.
        opciones[op.clave] = valorActual ?? porDefecto;
      } else {
        opciones[op.clave] = p.opciones?.[op.clave] ?? valorActual ?? porDefecto;
      }
    }
    resultado.push({ aplicacionId: app.id, rol: p.rol, alcance, opciones });
  }
  return { accesos: resultado };
}

// RUT chileno: se acepta con o sin puntos y se guarda como "12345678-9".
// Devuelve null si el dígito verificador no corresponde.
export function normalizarRut(entrada: string): string | null {
  const limpio = entrada.replace(/[.\s]/g, '').toUpperCase();
  const m = /^(\d{7,8})-?([\dK])$/.exec(limpio);
  if (!m) return null;
  const [, cuerpo, dv] = m;
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado ? `${cuerpo}-${dv}` : null;
}
