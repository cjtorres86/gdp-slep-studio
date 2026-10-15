// Acceso directo de una persona: una aplicación o un informe del portal (por
// su id) o un enlace web (http o https).
export interface Atajo {
  id: string;
  nombre: string;
  tipo: 'app' | 'informe' | 'enlace';
  destino: string;
}

export const MAXIMO_ATAJOS = 12;
const ID_VALIDO = /^[a-z0-9-]{1,40}$/;
const ID_CATALOGO = /^[a-z0-9_-]{1,60}$/;

// Deja solo accesos bien formados (los demás se descartan, sin error): nombre
// de 1 a 60 caracteres, destino según su tipo y nunca más de MAXIMO_ATAJOS.
export function limpiarAtajos(entrada: unknown): Atajo[] {
  if (!Array.isArray(entrada)) return [];
  const vistos = new Set<string>();
  const limpios: Atajo[] = [];
  for (const x of entrada) {
    if (!x || typeof x !== 'object') continue;
    const { id, nombre, tipo, destino } = x as Record<string, unknown>;
    if (typeof id !== 'string' || !ID_VALIDO.test(id) || vistos.has(id)) continue;
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 60) continue;
    if (typeof destino !== 'string') continue;
    if (tipo === 'enlace') {
      let url: URL;
      try {
        url = new URL(destino);
      } catch {
        continue;
      }
      if ((url.protocol !== 'https:' && url.protocol !== 'http:') || destino.length > 500) continue;
    } else if (tipo !== 'app' && tipo !== 'informe') continue;
    else if (!ID_CATALOGO.test(destino)) continue;
    vistos.add(id);
    limpios.push({ id, nombre: nombre.trim(), tipo, destino });
    if (limpios.length === MAXIMO_ATAJOS) break;
  }
  return limpios;
}
