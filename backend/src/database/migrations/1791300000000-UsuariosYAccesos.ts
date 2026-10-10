import { MigrationInterface, QueryRunner } from 'typeorm';

// Etapa 1 de Configuración: "Usuarios y accesos" se administra en el portal.
//
// 1. sleps: la lista oficial de los 36 SLEP vive ahora también en el portal,
//    porque es el portal el que decide sobre qué SLEP trabaja cada persona.
//
// 2. aplicaciones.manifiesto: la "ficha" que cada aplicación integrada
//    entrega al portal — qué perfiles tiene, si su alcance es por SLEP y
//    qué opciones individuales existen (ej.: "Puede cargar datos" en
//    Sumarios). Es parte del contrato de integración: el portal administra
//    lo que la aplicación declara aquí.
//
// 3. accesos.opciones: el valor de esas opciones para cada persona.
//
// 4. "Usuarios y accesos" deja de ser "Próximamente".
const SLEPS: string[] = ["Aconcagua", "Andalién Costa", "Andalién Sur", "Atacama", "Aysén", "Barrancas", "Chiloé", "Chinchorro", "Colchagua", "Costa Araucanía", "Costa Central", "Del Pino", "Elqui", "Gabriela Mistral", "Huasco", "Iquique", "Licancabur", "Llanquihue", "Los Álamos", "Los Andes", "Los Libertadores", "Los Parques", "Magallanes", "Marga Marga", "Maule Costa", "Petorca", "Puelche", "Puerto Cordillera", "Punilla Cordillera", "Santa Corina", "Santa Rosa", "Santiago Centro", "Tamarugal", "Valdivia", "Valle Diguillín", "Valparaíso"];

const MANIFIESTO_SUMARIOS = {
  perfiles: ['Admin', 'Validador', 'Digitador'],
  alcance: 'slep',
  opciones: [
    {
      clave: 'cargar_datos',
      etiqueta: 'Puede cargar datos',
      descripcion: 'Guardar valores y cargar archivos Excel en los formularios.',
      porDefecto: { Admin: true, Validador: false, Digitador: true },
      // El Digitador siempre carga datos; al Admin solo el Superadmin se lo cambia.
      fijo: ['Digitador'],
      soloSuperadmin: ['Admin'],
    },
  ],
};

export class UsuariosYAccesos1791300000000 implements MigrationInterface {
  name = 'UsuariosYAccesos1791300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE TABLE `sleps` (`nombre` varchar(60) NOT NULL, `orden` int NOT NULL, PRIMARY KEY (`nombre`)) ENGINE=InnoDB');
    for (const [i, nombre] of SLEPS.entries()) {
      await q.query('INSERT INTO `sleps` (`nombre`, `orden`) VALUES (?, ?)', [nombre, i + 1]);
    }
    await q.query('ALTER TABLE `aplicaciones` ADD `manifiesto` json NULL');
    await q.query('ALTER TABLE `accesos` ADD `opciones` json NULL');
    await q.query("UPDATE `aplicaciones` SET `manifiesto` = ? WHERE `id` = 'reporte_avance_sumarios'", [JSON.stringify(MANIFIESTO_SUMARIOS)]);
    // Las personas que ya tienen acceso a Sumarios toman el valor por defecto
    // de su perfil (el traspaso desde Sumarios trae después el valor real).
    for (const [rol, valor] of Object.entries(MANIFIESTO_SUMARIOS.opciones[0].porDefecto)) {
      await q.query(
        "UPDATE `accesos` SET `opciones` = ? WHERE `aplicacion_id` = 'reporte_avance_sumarios' AND `rol` = ?",
        [JSON.stringify({ cargar_datos: valor }), rol],
      );
    }
    await q.query("UPDATE `aplicaciones` SET `estado` = 'activa', `url` = '/configuracion/usuarios' WHERE `id` = 'config_usuarios'");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `aplicaciones` SET `estado` = 'proximamente', `url` = NULL WHERE `id` = 'config_usuarios'");
    await q.query('ALTER TABLE `accesos` DROP COLUMN `opciones`');
    await q.query('ALTER TABLE `aplicaciones` DROP COLUMN `manifiesto`');
    await q.query('DROP TABLE `sleps`');
  }
}
