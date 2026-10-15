import { MigrationInterface, QueryRunner } from 'typeorm';

// Accesos directos de cada persona (ventana Aplicaciones del inicio): una
// fila por persona con su lista. Si la persona se elimina, se van con ella.
export class AtajosUsuario1792400000000 implements MigrationInterface {
  name = 'AtajosUsuario1792400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `atajos_usuario` (' +
        '`usuario_id` varchar(36) NOT NULL, `atajos` json NOT NULL, ' +
        '`actualizado_en` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
        'PRIMARY KEY (`usuario_id`), ' +
        'CONSTRAINT `FK_atajos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE' +
        ') ENGINE=InnoDB',
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `atajos_usuario`');
  }
}
