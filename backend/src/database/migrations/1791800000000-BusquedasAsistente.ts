import { MigrationInterface, QueryRunner } from 'typeorm';

// Pantalla de inicio tipo asistente: historial de búsquedas de cada persona
// (lo que escribió, qué aplicación eligió y qué le respondió el asistente).
export class BusquedasAsistente1791800000000 implements MigrationInterface {
  name = 'BusquedasAsistente1791800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE IF NOT EXISTS `busquedas_asistente` (' +
        '`id` varchar(36) NOT NULL, ' +
        '`usuario_id` varchar(36) NOT NULL, ' +
        '`texto` varchar(200) NOT NULL, ' +
        '`aplicacion_id` varchar(60) NULL, ' +
        '`resultado` varchar(20) NOT NULL, ' +
        '`creado_en` datetime(3) NOT NULL, ' +
        'PRIMARY KEY (`id`), ' +
        'INDEX `IDX_busquedas_usuario_fecha` (`usuario_id`, `creado_en`)' +
        ') ENGINE=InnoDB',
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `busquedas_asistente`');
  }
}
