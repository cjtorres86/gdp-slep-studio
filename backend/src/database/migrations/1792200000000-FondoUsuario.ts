import { MigrationInterface, QueryRunner } from 'typeorm';

// Configuración → Vista: el fondo de pantalla que elige cada persona (el id
// de una imagen de la galería del portal; las imágenes viven en el sitio, no
// en la base). NULL = el fondo institucional de siempre.
export class FondoUsuario1792200000000 implements MigrationInterface {
  name = 'FondoUsuario1792200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `usuarios` ADD `fondo` varchar(40) NULL');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `usuarios` DROP COLUMN `fondo`');
  }
}
