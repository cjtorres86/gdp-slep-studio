import { MigrationInterface, QueryRunner } from 'typeorm';

// Asistente de la pantalla de inicio: los informes que entregan las
// aplicaciones (hoy, los 8 del botón Descargar de Avance de Sumarios), con las
// preguntas que el asistente hace antes de abrir cada uno.
//
// La ruta es una página de Sumarios. {mes}/{anio}: el mes elegido va en la
// dirección; si la ruta no los lleva, el mes y el SLEP van como ?mes=&anio=&slep=.
// Los permisos son los del catálogo de Sumarios.

const MES = (texto: string, opcionTodos: string | null = null) => ({ clave: 'mes', texto, opcionTodos });
const SLEP = { clave: 'slep', texto: '¿Lo quieres de todos los SLEP o de uno en particular?', opcionTodos: 'Todos los SLEP' };
const BASE = ['reporte', 'informe', 'sumarios', 'avance'];

const INFORMES = [
  {
    id: 'sumarios_consolidado_mes', nombre: 'Consolidado por Mes', formato: 'excel', permiso: 'exportar_excel_consolidado', todos: true,
    descripcion: 'Excel con los 36 SLEP, una hoja por mes.',
    ruta: '/descargar?archivo=consolidado-mes', preguntas: [],
    claves: [...BASE, 'excel', 'consolidado', 'mes', 'meses', 'planilla', 'descargar', 'hoja'],
  },
  {
    id: 'sumarios_consolidado_slep', nombre: 'Consolidado por SLEP', formato: 'excel', permiso: 'exportar_excel_slep', todos: false,
    descripcion: 'Excel con cada SLEP en su propia hoja, con todos sus meses.',
    ruta: '/descargar?archivo=consolidado-slep', preguntas: [],
    claves: [...BASE, 'excel', 'consolidado', 'slep', 'planilla', 'descargar', 'hoja'],
  },
  {
    id: 'sumarios_informe_interactivo', nombre: 'Informe Interactivo', formato: 'interactivo', permiso: 'exportar_informe', todos: false,
    descripcion: 'Avance de los sumarios: indicadores, gráficos, ranking y tabla por SLEP. Genera informes en Word, Excel y PDF.',
    ruta: '/informe-avance',
    preguntas: [MES('¿Quieres partir en un mes en especial, o prefieres el informe general completo, con todos los meses?', 'Informe completo, con todos los meses'), SLEP],
    claves: [...BASE, 'interactivo', 'general', 'indicadores', 'grafico', 'gráfico', 'word', 'tabla'],
  },
  {
    id: 'sumarios_informe_general_pdf', nombre: 'Informe General — PDF', formato: 'pdf', permiso: 'exportar_informe', todos: false,
    descripcion: 'El informe general del mes, listo para guardar o imprimir.',
    ruta: '/informe/{mes}/{anio}?imprimir=1',
    preguntas: [MES('¿De qué mes quieres el informe?'), SLEP],
    claves: [...BASE, 'general', 'pdf', 'imprimir', 'guardar'],
  },
  {
    id: 'sumarios_ranking_interactivo', nombre: 'Ranking — Interactivo', formato: 'interactivo', permiso: 'exportar_informe', todos: false,
    descripcion: 'Solo el ranking: pasa el mouse sobre un SLEP para ver sus campos.',
    ruta: '/informe/{mes}/{anio}?tipo=ranking',
    preguntas: [MES('¿De qué mes quieres el ranking?')],
    claves: [...BASE, 'ranking', 'posicion', 'posición', 'interactivo', 'comparar'],
  },
  {
    id: 'sumarios_ranking_pdf', nombre: 'Ranking — PDF', formato: 'pdf', permiso: 'exportar_informe', todos: false,
    descripcion: 'El mismo ranking, listo para guardar o imprimir.',
    ruta: '/informe/{mes}/{anio}?tipo=ranking&imprimir=1',
    preguntas: [MES('¿De qué mes quieres el ranking?')],
    claves: [...BASE, 'ranking', 'posicion', 'posición', 'pdf', 'imprimir'],
  },
  {
    id: 'sumarios_errores_interactivo', nombre: 'Informe de Errores — Interactivo', formato: 'interactivo', permiso: 'exportar_informe', todos: false,
    descripcion: 'Los errores de validación del mes, para revisar en pantalla.',
    ruta: '/informe/{mes}/{anio}?tipo=errores',
    preguntas: [MES('¿De qué mes quieres revisar los errores?'), SLEP],
    claves: [...BASE, 'errores', 'error', 'validacion', 'validación', 'revisar', 'interactivo'],
  },
  {
    id: 'sumarios_errores_pdf', nombre: 'Informe de Errores — PDF', formato: 'pdf', permiso: 'exportar_informe', todos: false,
    descripcion: 'Los mismos errores, listos para guardar o imprimir.',
    ruta: '/informe/{mes}/{anio}?tipo=errores&imprimir=1',
    preguntas: [MES('¿De qué mes quieres los errores?'), SLEP],
    claves: [...BASE, 'errores', 'error', 'validacion', 'validación', 'pdf', 'imprimir'],
  },
];

export class InformesAsistente1791900000000 implements MigrationInterface {
  name = 'InformesAsistente1791900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE IF NOT EXISTS `informes_asistente` (' +
        '`id` varchar(60) NOT NULL, ' +
        '`aplicacion_id` varchar(60) NOT NULL, ' +
        '`nombre` varchar(120) NOT NULL, ' +
        '`descripcion` text NOT NULL, ' +
        '`formato` varchar(20) NOT NULL, ' +
        '`permiso` varchar(60) NOT NULL, ' +
        '`requiere_alcance_todos` tinyint NOT NULL DEFAULT 0, ' +
        '`ruta` varchar(300) NOT NULL, ' +
        '`preguntas` json NOT NULL, ' +
        '`palabras_clave` json NOT NULL, ' +
        '`orden` int NOT NULL, ' +
        'PRIMARY KEY (`id`), ' +
        'INDEX `IDX_informes_aplicacion` (`aplicacion_id`)' +
        ') ENGINE=InnoDB',
    );
    let orden = 1;
    for (const i of INFORMES) {
      await q.query(
        'INSERT INTO `informes_asistente` (`id`, `aplicacion_id`, `nombre`, `descripcion`, `formato`, `permiso`, `requiere_alcance_todos`, `ruta`, `preguntas`, `palabras_clave`, `orden`) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `id` = `id`',
        [i.id, 'reporte_avance_sumarios', i.nombre, i.descripcion, i.formato, i.permiso, i.todos ? 1 : 0, i.ruta, JSON.stringify(i.preguntas), JSON.stringify(i.claves), orden++],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `informes_asistente`');
  }
}
