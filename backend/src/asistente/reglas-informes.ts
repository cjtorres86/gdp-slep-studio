import { Acceso } from '../catalogo/entities/acceso.entity';
import { RolPortal } from '../usuarios/entities/usuario.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
import { Informe, PreguntaInforme } from './informe.entity';

// Reglas puras (sin base de datos) del asistente de informes, para poder
// probar cada una por separado.

export interface InformeVista {
  id: string;
  aplicacionId: string;
  nombre: string;
  descripcion: string;
  formato: Informe['formato'];
  categoria: Informe['categoria'];
  estado: string;
  palabrasClave: string[];
  preguntas: PreguntaInforme[];
  autorizado: boolean;
  // SLEP que la persona puede pedir: "todos" o su lista (si es uno solo, el
  // asistente no pregunta: se usa ese).
  sleps: 'todos' | string[];
}

// ¿Puede esta persona abrir el informe? Lo mismo que exige la aplicación:
// tener acceso, que su perfil incluya el permiso del informe y, si el informe
// lo pide, trabajar con todos los SLEP. El Superadmin, siempre.
export function informeAutorizado(informe: Informe, rolPortal: RolPortal, acceso: Acceso | undefined, perfiles: PerfilAplicacion[]): boolean {
  if (rolPortal === 'superadmin') return true;
  if (!acceso) return false;
  const perfil = perfiles.find((p) => p.id === acceso.rol);
  if (!perfil?.permisos.includes(informe.permiso)) return false;
  return !informe.requiereAlcanceTodos || acceso.alcance.includes('todos');
}

export function slepsDe(rolPortal: RolPortal, acceso: Acceso | undefined): 'todos' | string[] {
  if (rolPortal === 'superadmin' || acceso?.alcance.includes('todos')) return 'todos';
  return acceso?.alcance ?? [];
}

// Quien trabaja con un solo SLEP solo ve lo suyo: los informes "de todos los
// SLEP" (rankings, consolidados de los 36, por SLEP) no se le muestran.
export function visiblePara(informe: Informe, sleps: 'todos' | string[]): boolean {
  return sleps === 'todos' || !informe.requiereAlcanceTodos;
}

// Y lo "nacional" es su SLEP: "Informe interactivo nacional" pasa a
// "Informe interactivo Valdivia" (también en la descripción).
export function textosPara(informe: Pick<Informe, 'nombre' | 'descripcion'>, sleps: 'todos' | string[]): { nombre: string; descripcion: string } {
  if (sleps === 'todos' || sleps.length !== 1) return { nombre: informe.nombre, descripcion: informe.descripcion };
  const slep = sleps[0];
  return {
    nombre: informe.nombre.replace(/\bnacional\b/i, slep),
    descripcion: informe.descripcion.replace(/\bdel país\b/i, `de ${slep}`).replace(/\bde todos los SLEP\b/i, `de ${slep}`),
  };
}

export interface RespuestasInforme {
  mes?: { mes: string; anio: string } | 'todos';
  slep?: string | 'todos';
}

export class RespuestaInvalida extends Error {}

const MES_VALIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,12}$/;
const ANIO_VALIDO = /^\d{4}$/;

// Arma la página de la aplicación a la que se lleva a la persona, a partir de
// sus respuestas. Valida todo lo que llega (no se confía en el navegador).
export function construirDestino(informe: Informe, r: RespuestasInforme, sleps: 'todos' | string[], slepsExistentes: string[]): string {
  const [ruta, consulta = ''] = informe.ruta.split('?');
  const params = new URLSearchParams(consulta);
  let camino = ruta;

  const preguntaMes = informe.preguntas.find((p) => p.clave === 'mes');
  if (preguntaMes) {
    const mes = r.mes && r.mes !== 'todos' ? r.mes : null;
    if (r.mes === 'todos' && !preguntaMes.opcionTodos) throw new RespuestaInvalida('Este informe necesita un mes.');
    if (!mes && !preguntaMes.opcionTodos) throw new RespuestaInvalida('Este informe necesita un mes.');
    if (mes) {
      if (!MES_VALIDO.test(mes.mes) || !ANIO_VALIDO.test(mes.anio)) throw new RespuestaInvalida('El mes no es válido.');
      if (camino.includes('{mes}')) camino = camino.replace('{mes}', encodeURIComponent(mes.mes)).replace('{anio}', mes.anio);
      else {
        params.set('mes', mes.mes);
        params.set('anio', mes.anio);
      }
    }
  }
  if (camino.includes('{')) throw new RespuestaInvalida('Falta elegir el mes.');

  const preguntaSlep = informe.preguntas.find((p) => p.clave === 'slep');
  if (preguntaSlep) {
    // Quien trabaja con un solo SLEP siempre recibe el suyo.
    let slep = r.slep && r.slep !== 'todos' ? r.slep : null;
    if (sleps !== 'todos' && sleps.length === 1) slep = sleps[0];
    // Un informe "por SLEP" (sin opción "todos") necesita uno.
    if (!slep && !preguntaSlep.opcionTodos) throw new RespuestaInvalida('Este informe necesita un SLEP.');
    if (slep) {
      const permitido = sleps === 'todos' ? slepsExistentes.includes(slep) : sleps.includes(slep);
      if (!permitido) throw new RespuestaInvalida('No puedes pedir ese SLEP.');
      params.set('slep', slep);
    }
  }

  const q = params.toString();
  return q ? `${camino}?${q}` : camino;
}
