import { MigrationInterface, QueryRunner } from 'typeorm';
import { CATALOGO_SUMARIOS, PERFILES_INICIALES_SUMARIOS } from '../../perfiles/catalogo-sumarios';

// Etapa 3 de Configuración: los perfiles de cada aplicación se administran en
// el portal.
//
// 1. perfiles_aplicacion: los perfiles, con sus permisos y restricciones.
//    Sumarios parte con Admin, Validador y Digitador EXACTAMENTE como
//    funcionan hoy, más "Visita" (solo ver y descargar).
// 2. El acceso de cada persona pasa a guardar el ID del perfil (ej.
//    "perfil_digitador") en vez de su nombre: así renombrar un perfil no deja
//    a nadie sin perfil.
// 3. La ficha de Sumarios declara su catálogo de permisos (lo que el portal
//    muestra con interruptores). Los perfiles ya no van en la ficha: viven en
//    la tabla nueva.
//
// Se puede volver a correr sin problemas si algún día se corta a la mitad
// (crea la tabla solo si no existe y no duplica perfiles).
const NOMBRE_A_ID: Record<string, string> = { Admin: 'perfil_admin', Validador: 'perfil_validador', Digitador: 'perfil_digitador' };

export class PerfilesAplicaciones1791500000000 implements MigrationInterface {
  name = 'PerfilesAplicaciones1791500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE IF NOT EXISTS `perfiles_aplicacion` (' +
        '`id` varchar(60) NOT NULL, `aplicacion_id` varchar(60) NOT NULL, `nombre` varchar(60) NOT NULL, ' +
        "`descripcion` varchar(200) NOT NULL DEFAULT '', `color` varchar(9) NOT NULL, `permisos` json NOT NULL, " +
        '`restricciones` json NOT NULL, `orden` int NOT NULL DEFAULT 99, `creado_en` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        'PRIMARY KEY (`id`), UNIQUE INDEX `UQ_perfil_nombre` (`aplicacion_id`, `nombre`)' +
        ') ENGINE=InnoDB',
    );
    for (const p of PERFILES_INICIALES_SUMARIOS) {
      await q.query(
        'INSERT IGNORE INTO `perfiles_aplicacion` (`id`, `aplicacion_id`, `nombre`, `descripcion`, `color`, `permisos`, `restricciones`, `orden`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, 'reporte_avance_sumarios', p.nombre, p.descripcion, p.color, JSON.stringify(p.permisos), JSON.stringify(p.restricciones), p.orden],
      );
    }
    for (const [nombre, id] of Object.entries(NOMBRE_A_ID)) {
      await q.query("UPDATE `accesos` SET `rol` = ? WHERE `aplicacion_id` = 'reporte_avance_sumarios' AND `rol` = ?", [id, nombre]);
    }
    // Ficha de Sumarios: catálogo de permisos; "perfiles" sale de la ficha y
    // la opción "Puede cargar datos" se rige por la carga de cada perfil.
    // Se arma en JavaScript (no con funciones JSON de la base) para que
    // funcione igual en MySQL (Aiven) y en MariaDB.
    const [fila] = await q.query("SELECT `manifiesto` FROM `aplicaciones` WHERE `id` = 'reporte_avance_sumarios'");
    if (fila) {
      const actual = typeof fila.manifiesto === 'string' ? JSON.parse(fila.manifiesto) : (fila.manifiesto ?? {});
      const { perfiles: _sinPerfiles, ...resto } = actual;
      const manifiesto = {
        ...resto,
        permisos: CATALOGO_SUMARIOS,
        opciones: [{ clave: 'cargar_datos', etiqueta: 'Puede cargar datos', descripcion: 'Guardar valores y cargar archivos Excel en los formularios.' }],
      };
      await q.query("UPDATE `aplicaciones` SET `manifiesto` = ? WHERE `id` = 'reporte_avance_sumarios'", [JSON.stringify(manifiesto)]);
    }
    await q.query("UPDATE `aplicaciones` SET `estado` = 'activa', `url` = '/configuracion/perfiles' WHERE `id` = 'config_perfiles'");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `aplicaciones` SET `estado` = 'proximamente', `url` = NULL WHERE `id` = 'config_perfiles'");
    for (const [nombre, id] of Object.entries(NOMBRE_A_ID)) {
      await q.query("UPDATE `accesos` SET `rol` = ? WHERE `aplicacion_id` = 'reporte_avance_sumarios' AND `rol` = ?", [nombre, id]);
    }
    await q.query('DROP TABLE `perfiles_aplicacion`');
  }
}
