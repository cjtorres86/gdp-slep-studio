import { MigrationInterface, QueryRunner } from 'typeorm';

// Etapa 2 de Configuración: ingreso único (SSO) desde el portal.
//
// 1. pases_ingreso: el "pase" de un solo uso que el portal entrega al abrir
//    una aplicación. Se guarda solo su huella (hash SHA-256), nunca el pase
//    en sí; vence a los 60 segundos y se puede canjear una sola vez.
//
// 2. aplicaciones.url_integracion: dirección del SERVIDOR de cada aplicación
//    integrada, a la que el portal le avisa al instante cuando cambia o se
//    desactiva una persona (para que el bloqueo sea inmediato).
//
// 3. La ficha de Sumarios declara "un solo SLEP" por persona: Sumarios
//    guarda un SLEP (o "todos"), no una lista.
export class IngresoUnico1791400000000 implements MigrationInterface {
  name = 'IngresoUnico1791400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `pases_ingreso` (' +
        '`huella` char(64) NOT NULL, ' +
        '`usuario_id` varchar(36) NOT NULL, ' +
        '`aplicacion_id` varchar(60) NOT NULL, ' +
        '`vence_en` datetime NOT NULL, ' +
        '`usado_en` datetime NULL, ' +
        '`creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`huella`), INDEX `IDX_pases_vence` (`vence_en`)' +
        ') ENGINE=InnoDB',
    );
    await q.query('ALTER TABLE `aplicaciones` ADD `url_integracion` varchar(300) NULL');
    await q.query(
      "UPDATE `aplicaciones` SET `url_integracion` = 'https://proyecto1-backend-ux0w.onrender.com', " +
        "`manifiesto` = JSON_SET(`manifiesto`, '$.alcance', 'slep_uno') WHERE `id` = 'reporte_avance_sumarios'",
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `aplicaciones` SET `manifiesto` = JSON_SET(`manifiesto`, '$.alcance', 'slep') WHERE `id` = 'reporte_avance_sumarios'");
    await q.query('ALTER TABLE `aplicaciones` DROP COLUMN `url_integracion`');
    await q.query('DROP TABLE `pases_ingreso`');
  }
}
