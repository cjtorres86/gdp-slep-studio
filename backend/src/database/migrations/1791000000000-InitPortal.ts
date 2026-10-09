import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPortal1791000000000 implements MigrationInterface {
  name = 'InitPortal1791000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE \`usuarios\` (
      \`id\` varchar(36) NOT NULL,
      \`usuario\` varchar(60) NULL,
      \`contrasena_hash\` varchar(255) NULL,
      \`rut\` varchar(12) NULL,
      \`nombre_para_mostrar\` varchar(120) NOT NULL,
      \`rol_portal\` varchar(20) NOT NULL DEFAULT 'usuario',
      \`activo\` tinyint NOT NULL DEFAULT 1,
      \`creado_en\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE INDEX \`UQ_usuarios_usuario\` (\`usuario\`),
      UNIQUE INDEX \`UQ_usuarios_rut\` (\`rut\`),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB`);

    await q.query(`CREATE TABLE \`modulos\` (
      \`id\` varchar(40) NOT NULL,
      \`nombre\` varchar(80) NOT NULL,
      \`icono\` varchar(30) NOT NULL,
      \`color\` varchar(9) NOT NULL,
      \`orden\` int NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB`);

    await q.query(`CREATE TABLE \`aplicaciones\` (
      \`id\` varchar(60) NOT NULL,
      \`modulo_id\` varchar(40) NOT NULL,
      \`nombre\` varchar(100) NOT NULL,
      \`descripcion\` text NOT NULL,
      \`url\` varchar(300) NULL,
      \`estado\` varchar(20) NOT NULL,
      \`visibilidad\` varchar(20) NOT NULL DEFAULT 'por_acceso',
      \`orden\` int NOT NULL,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`FK_aplicaciones_modulo\` FOREIGN KEY (\`modulo_id\`) REFERENCES \`modulos\`(\`id\`)
    ) ENGINE=InnoDB`);

    await q.query(`CREATE TABLE \`accesos\` (
      \`usuario_id\` varchar(36) NOT NULL,
      \`aplicacion_id\` varchar(60) NOT NULL,
      \`rol\` varchar(60) NOT NULL,
      \`alcance\` json NOT NULL,
      PRIMARY KEY (\`usuario_id\`, \`aplicacion_id\`),
      CONSTRAINT \`FK_accesos_usuario\` FOREIGN KEY (\`usuario_id\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`FK_accesos_aplicacion\` FOREIGN KEY (\`aplicacion_id\`) REFERENCES \`aplicaciones\`(\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `accesos`');
    await q.query('DROP TABLE `aplicaciones`');
    await q.query('DROP TABLE `modulos`');
    await q.query('DROP TABLE `usuarios`');
  }
}
