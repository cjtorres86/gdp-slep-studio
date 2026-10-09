import { MigrationInterface, QueryRunner } from 'typeorm';

// Módulo "Documentación" (solo Admin y Superadmin): accesos a los sitios
// de documentación del proyecto, que se abren en una pestaña nueva.
//
// Va entre "Automatización de Procesos" y "Configuración": Configuración
// pasa del orden 3 al 4 para quedar siempre al final.
//
// OJO: el portal solo decide quién VE las tarjetas. Los sitios están en
// GitHub Pages, que es público: quien tenga la dirección puede entrar.
export class AddModuloDocumentacion1791100000000 implements MigrationInterface {
  name = 'AddModuloDocumentacion1791100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `modulos` SET `orden` = 4 WHERE `id` = 'configuracion'");
    await q.query(
      'INSERT INTO `modulos` (`id`, `nombre`, `icono`, `color`, `orden`) VALUES (?, ?, ?, ?, ?)',
      ['documentacion', 'Documentación', 'documentacion', '#3abff0', 3],
    );
    const insertarApp =
      'INSERT INTO `aplicaciones` (`id`, `modulo_id`, `nombre`, `descripcion`, `url`, `estado`, `visibilidad`, `orden`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    await q.query(insertarApp, [
      'doc_proyecto', 'documentacion', 'Documentación del Proyecto',
      'Serie de informes técnicos del proyecto GDP-SLEP Studio.',
      'https://cjtorres86.github.io/serie-informes/', 'activa', 'admin', 1,
    ]);
    await q.query(insertarApp, [
      'doc_marco_legal', 'documentacion', 'Documentación Marco Legal',
      'Normas del proyecto de licencias médicas, con búsqueda y descarga de los textos oficiales.',
      'https://cjtorres86.github.io/biblioteca-normativa/', 'activa', 'admin', 2,
    ]);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `aplicaciones` WHERE `modulo_id` = 'documentacion'");
    await q.query("DELETE FROM `modulos` WHERE `id` = 'documentacion'");
    await q.query("UPDATE `modulos` SET `orden` = 3 WHERE `id` = 'configuracion'");
  }
}
