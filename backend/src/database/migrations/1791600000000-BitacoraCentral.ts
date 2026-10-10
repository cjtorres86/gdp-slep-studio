import { MigrationInterface, QueryRunner } from 'typeorm';

// Etapa 4 de Configuración: Bitácora central.
//
// Un solo registro de lo que pasa en el portal y en cada aplicación integrada
// (Sumarios envía cada acción al instante, y también su historial).
//
// - origen: "portal" o el id de la aplicación (ej. "reporte_avance_sumarios").
// - origen_id: el id del registro en la aplicación. Junto con "origen" es
//   único: si una aplicación reenvía un registro, no se duplica.
// - persona_*: una FOTO de quién era en ese momento (nombre y perfil), igual
//   que la Bitácora de Sumarios: si mañana cambia de nombre o de perfil, la
//   Bitácora no reescribe la historia.
//
// Nadie puede editar ni borrar registros: el sistema solo agrega.
export class BitacoraCentral1791600000000 implements MigrationInterface {
  name = 'BitacoraCentral1791600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE IF NOT EXISTS `registros_bitacora` (' +
        '`id` varchar(36) NOT NULL, ' +
        '`origen` varchar(60) NOT NULL, ' +
        '`origen_id` varchar(80) NULL, ' +
        '`creado_en` datetime(3) NOT NULL, ' +
        '`persona_portal_id` varchar(36) NULL, ' +
        '`persona_nombre` varchar(120) NOT NULL, ' +
        '`persona_perfil` varchar(80) NOT NULL, ' +
        '`accion` varchar(60) NOT NULL, ' +
        '`descripcion` text NOT NULL, ' +
        '`detalle` json NULL, ' +
        '`ip` varchar(64) NULL, ' +
        'PRIMARY KEY (`id`), ' +
        'UNIQUE INDEX `UQ_bitacora_origen` (`origen`, `origen_id`), ' +
        'INDEX `IDX_bitacora_fecha` (`creado_en`), ' +
        'INDEX `IDX_bitacora_origen_fecha` (`origen`, `creado_en`), ' +
        'INDEX `IDX_bitacora_accion` (`accion`), ' +
        'INDEX `IDX_bitacora_persona` (`persona_nombre`)' +
        ') ENGINE=InnoDB',
    );
    await q.query("UPDATE `aplicaciones` SET `estado` = 'activa', `url` = '/configuracion/bitacora' WHERE `id` = 'config_bitacora'");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `aplicaciones` SET `estado` = 'proximamente', `url` = NULL WHERE `id` = 'config_bitacora'");
    await q.query('DROP TABLE `registros_bitacora`');
  }
}
