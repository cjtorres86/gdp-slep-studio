import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import type { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
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

// Valida y completa los accesos pedidos contra la ficha (manifiesto) y los
// perfiles de cada aplicación. Lo que la aplicación no declara, no se acepta.
export function normalizarAccesos(
  editor: Editor,
  pedidos: AccesoPedido[],
  actuales: AccesoNormalizado[],
  aplicaciones: Map<string, Aplicacion>,
  slepsOficiales: string[],
  perfiles: PerfilAplicacion[],
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
    const perfil = perfiles.find((x) => x.aplicacionId === app.id && x.id === p.rol);
    if (!perfil) return { error: `Ese perfil no existe en ${app.nombre}.` };

    // Alcance: "todos" o uno o más SLEP de la lista oficial (sin repetir y
    // en el orden oficial).
    let alcance: string[] = ['todos'];
    if (m.alcance === 'slep' || m.alcance === 'slep_uno') {
      const pedido = (p.alcance ?? []).map((s) => s.trim()).filter(Boolean);
      if (pedido.includes('todos')) {
        if (perfil.restricciones.exigeSlep) return { error: `El perfil ${perfil.nombre} exige un SLEP específico (no puede tener "Todos los SLEP").` };
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

    // Opción "Puede cargar datos": la decide la carga del perfil.
    const actual = actuales.find((a) => a.aplicacionId === app.id);
    const valorActual = actual?.rol === p.rol ? actual?.opciones?.['cargar_datos'] : undefined;
    const opciones: Record<string, boolean> = {};
    if (m.opciones.some((o) => o.clave === 'cargar_datos')) {
      opciones['cargar_datos'] = valorCarga(perfil, editor, p.opciones?.['cargar_datos'], valorActual);
    }
    resultado.push({ aplicacionId: app.id, rol: perfil.id, alcance, opciones });
  }
  return { accesos: resultado };
}

// "Puede cargar datos" de una persona según la carga de su perfil:
//  - siempre / nunca: fijo, no se puede cambiar persona por persona.
//  - opcional: lo pedido; si no se pidió, lo que tenía; si no, el valor por
//    defecto del perfil. Si el perfil dice que solo el Superadmin la cambia,
//    un Admin no la puede mover.
export function valorCarga(perfil: PerfilAplicacion, editor: Editor, pedido: boolean | undefined, actual: boolean | undefined): boolean {
  const { carga, cargaSoloSuperadmin } = perfil.restricciones;
  if (carga === 'siempre') return true;
  if (carga === 'nunca') return false;
  const porDefecto = carga === 'opcional_si';
  if (cargaSoloSuperadmin && editor.rolPortal !== 'superadmin') return actual ?? porDefecto;
  return pedido ?? actual ?? porDefecto;
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
