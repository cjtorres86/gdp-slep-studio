import { MigrationInterface, QueryRunner } from 'typeorm';

// Catálogo único (catalogo/catalogo-general.json):
//  - informes_asistente: formato pasa a xlsx / html / pdf, y se agregan la
//    categoría (consolidado, interactivo, estatico) y el estado.
//  - aplicaciones: sus palabras clave pasan a vivir en la base (antes estaban
//    en el frontend del portal).
//  - "Gestor de Formularios" pasa a llamarse "Reportabilidad".
// El contenido completo lo pone al día el servidor al arrancar, desde el
// archivo del catálogo; esto deja el esquema listo y los datos coherentes.
export class CatalogoUnico1792100000000 implements MigrationInterface {
  name = 'CatalogoUnico1792100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE `informes_asistente` ADD `categoria` varchar(20) NOT NULL DEFAULT 'interactivo', ADD `estado` varchar(20) NOT NULL DEFAULT 'activa'");
    await q.query("UPDATE `informes_asistente` SET `categoria` = CASE `formato` WHEN 'excel' THEN 'consolidado' WHEN 'pdf' THEN 'estatico' ELSE 'interactivo' END");
    await q.query("UPDATE `informes_asistente` SET `formato` = CASE `formato` WHEN 'excel' THEN 'xlsx' WHEN 'interactivo' THEN 'html' ELSE `formato` END");
    await q.query('ALTER TABLE `aplicaciones` ADD `palabras_clave` json NULL');
    await q.query("UPDATE `modulos` SET `nombre` = 'Reportabilidad' WHERE `id` = 'gestor_formularios'");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `modulos` SET `nombre` = 'Gestor de Formularios' WHERE `id` = 'gestor_formularios'");
    await q.query('ALTER TABLE `aplicaciones` DROP COLUMN `palabras_clave`');
    await q.query("UPDATE `informes_asistente` SET `formato` = CASE `formato` WHEN 'xlsx' THEN 'excel' WHEN 'html' THEN 'interactivo' ELSE `formato` END");
    await q.query('ALTER TABLE `informes_asistente` DROP COLUMN `estado`, DROP COLUMN `categoria`');
  }
}
