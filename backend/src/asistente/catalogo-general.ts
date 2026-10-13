import { CategoriaInforme, FormatoInforme, PreguntaInforme } from './informe.entity';

// Forma del catálogo único (catalogo/catalogo-general.json), tal como se
// escribe en el archivo (nombres en español con guion bajo).
export interface CatalogoGeneral {
  modulos: { id: string; nombre: string; icono: string; color: string; orden: number }[];
  aplicaciones: { id: string; modulo_id: string; nombre: string; descripcion: string; estado: string; orden: number; palabras_clave: string[] }[];
  informes: {
    id: string;
    aplicacion_id: string;
    nombre_formal: string;
    descripcion: string;
    categoria: CategoriaInforme;
    formato: FormatoInforme;
    estado: string;
    url_destino: string;
    permiso: string;
    requiere_alcance_todos: boolean;
    preguntas: { clave: 'mes' | 'slep'; texto: string; opcion_todos: string | null }[];
    palabras_clave: string[];
    orden: number;
  }[];
}

const FORMATOS: FormatoInforme[] = ['xlsx', 'html', 'pdf'];
const CATEGORIAS: CategoriaInforme[] = ['consolidado', 'interactivo', 'estatico'];
const ESTADOS = ['activa', 'proximamente'];

// Revisa el catálogo antes de usarlo: si algo está mal escrito, se avisa con
// el detalle y NO se toca la base (mejor seguir con lo anterior que romperla).
export function validarCatalogo(c: unknown): string[] {
  const errores: string[] = [];
  const cat = c as Partial<CatalogoGeneral>;
  if (!cat || !Array.isArray(cat.modulos) || !Array.isArray(cat.aplicaciones) || !Array.isArray(cat.informes)) {
    return ['Faltan las listas "modulos", "aplicaciones" o "informes".'];
  }
  const repetidos = (lista: { id: string }[], que: string) => {
    const vistos = new Set<string>();
    lista.forEach((x) => (vistos.has(x.id) ? errores.push(`${que} repetido: ${x.id}`) : vistos.add(x.id)));
  };
  repetidos(cat.modulos, 'Módulo');
  repetidos(cat.aplicaciones, 'Aplicación');
  repetidos(cat.informes, 'Informe');
  const modulos = new Set(cat.modulos.map((m) => m.id));
  const apps = new Set(cat.aplicaciones.map((a) => a.id));
  for (const a of cat.aplicaciones) {
    if (!a.id || !a.nombre) errores.push(`Aplicación sin id o nombre: ${JSON.stringify(a).slice(0, 80)}`);
    if (!modulos.has(a.modulo_id)) errores.push(`Aplicación ${a.id}: el módulo "${a.modulo_id}" no existe en el catálogo.`);
    if (!ESTADOS.includes(a.estado)) errores.push(`Aplicación ${a.id}: estado "${a.estado}" no válido.`);
    if (!Array.isArray(a.palabras_clave)) errores.push(`Aplicación ${a.id}: palabras_clave debe ser una lista.`);
  }
  for (const i of cat.informes) {
    const p = `Informe ${i.id}`;
    if (!i.id || !i.nombre_formal) errores.push(`Informe sin id o nombre_formal: ${JSON.stringify(i).slice(0, 80)}`);
    if (!apps.has(i.aplicacion_id)) errores.push(`${p}: la aplicación "${i.aplicacion_id}" no existe en el catálogo.`);
    if (!FORMATOS.includes(i.formato)) errores.push(`${p}: formato "${i.formato}" no válido (xlsx, html o pdf).`);
    if (!CATEGORIAS.includes(i.categoria)) errores.push(`${p}: categoría "${i.categoria}" no válida (consolidado, interactivo o estatico).`);
    if (!ESTADOS.includes(i.estado)) errores.push(`${p}: estado "${i.estado}" no válido.`);
    if (!i.url_destino?.startsWith('/')) errores.push(`${p}: url_destino debe ser una página de la aplicación (empieza con /).`);
    if (!i.permiso) errores.push(`${p}: falta el permiso.`);
    if (!Array.isArray(i.palabras_clave) || !Array.isArray(i.preguntas)) errores.push(`${p}: palabras_clave y preguntas deben ser listas.`);
    for (const q of i.preguntas ?? []) {
      if (q.clave !== 'mes' && q.clave !== 'slep') errores.push(`${p}: pregunta con clave "${q.clave}" no válida (mes o slep).`);
    }
    if (i.url_destino?.includes('{mes}') && !i.preguntas?.some((q) => q.clave === 'mes' && q.opcion_todos === null)) {
      errores.push(`${p}: la dirección lleva {mes}, así que debe preguntar el mes de forma obligatoria (opcion_todos: null).`);
    }
  }
  return errores;
}

// Del formato del archivo al de la base.
export const preguntasParaBase = (i: CatalogoGeneral['informes'][number]): PreguntaInforme[] =>
  i.preguntas.map((q) => ({ clave: q.clave, texto: q.texto, opcionTodos: q.opcion_todos }));
