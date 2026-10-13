import { MigrationInterface, QueryRunner } from 'typeorm';

// Búsqueda por categoría en el asistente: se amplían las palabras clave de los
// informes para que funcionen las búsquedas por tipo.
//  - "informes" / "reportes": todos los informes.
//  - "descargar" / "descargas": todo lo que se puede descargar.
//  - "ranking": los rankings (Interactivo y PDF).
//  - "consolidado": los consolidados (por Mes y por SLEP).
// Solo se AGREGAN palabras (las que ya tenía cada informe se conservan).

const TODOS = ['informe', 'informes', 'reporte', 'reportes', 'reporte ejecutivo', 'descargar', 'descarga', 'descargas'];
const RANKING = ['ranking', 'rankings', 'clasificacion', 'clasificación', 'posiciones', 'posicion', 'posición'];
const CONSOLIDADO = ['consolidado', 'consolidados', 'consolidacion', 'consolidación', 'resumen general'];

const EXTRA: Record<string, string[]> = {
  sumarios_consolidado_mes: CONSOLIDADO,
  sumarios_consolidado_slep: CONSOLIDADO,
  sumarios_ranking_interactivo: RANKING,
  sumarios_ranking_pdf: RANKING,
};

export class CategoriasInformes1792000000000 implements MigrationInterface {
  name = 'CategoriasInformes1792000000000';

  public async up(q: QueryRunner): Promise<void> {
    const filas: { id: string; palabras_clave: string | string[] }[] = await q.query('SELECT `id`, `palabras_clave` FROM `informes_asistente`');
    for (const f of filas) {
      const actuales: string[] = typeof f.palabras_clave === 'string' ? JSON.parse(f.palabras_clave) : f.palabras_clave;
      const nuevas = [...new Set([...actuales, ...TODOS, ...(EXTRA[f.id] ?? [])])];
      await q.query('UPDATE `informes_asistente` SET `palabras_clave` = ? WHERE `id` = ?', [JSON.stringify(nuevas), f.id]);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const agregadas = new Set([...TODOS, ...RANKING, ...CONSOLIDADO]);
    // Se conservan las que venían de la migración anterior.
    const originales = new Set(['reporte', 'informe', 'ranking', 'consolidado', 'descargar', 'posicion', 'posición']);
    const filas: { id: string; palabras_clave: string | string[] }[] = await q.query('SELECT `id`, `palabras_clave` FROM `informes_asistente`');
    for (const f of filas) {
      const actuales: string[] = typeof f.palabras_clave === 'string' ? JSON.parse(f.palabras_clave) : f.palabras_clave;
      const quedan = actuales.filter((p) => !agregadas.has(p) || originales.has(p));
      await q.query('UPDATE `informes_asistente` SET `palabras_clave` = ? WHERE `id` = ?', [JSON.stringify(quedan), f.id]);
    }
  }
}
