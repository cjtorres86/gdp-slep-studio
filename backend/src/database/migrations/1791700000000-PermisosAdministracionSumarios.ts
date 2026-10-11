import { MigrationInterface, QueryRunner } from 'typeorm';
import { CATALOGO_SUMARIOS } from '../../perfiles/catalogo-sumarios';

// Tres permisos nuevos en el catálogo de Sumarios ("Administración de la
// aplicación"): Ver usuarios, Ver perfiles y Ver bitácora. Se agregan a la
// ficha de Sumarios para poder activarlos a cualquier perfil desde
// Configuración → Perfiles. Ningún perfil los recibe ahora: de partida, nadie
// ve nada nuevo (el Superadmin, como siempre, ve todo).
// Se arma en JavaScript para que funcione igual en MySQL y en MariaDB.
export class PermisosAdministracionSumarios1791700000000 implements MigrationInterface {
  name = 'PermisosAdministracionSumarios1791700000000';

  public async up(q: QueryRunner): Promise<void> {
    const [fila] = await q.query("SELECT `manifiesto` FROM `aplicaciones` WHERE `id` = 'reporte_avance_sumarios'");
    if (!fila) return;
    const m = typeof fila.manifiesto === 'string' ? JSON.parse(fila.manifiesto) : fila.manifiesto;
    await q.query("UPDATE `aplicaciones` SET `manifiesto` = ? WHERE `id` = 'reporte_avance_sumarios'", [JSON.stringify({ ...m, permisos: CATALOGO_SUMARIOS })]);
  }

  public async down(q: QueryRunner): Promise<void> {
    const [fila] = await q.query("SELECT `manifiesto` FROM `aplicaciones` WHERE `id` = 'reporte_avance_sumarios'");
    if (!fila) return;
    const m = typeof fila.manifiesto === 'string' ? JSON.parse(fila.manifiesto) : fila.manifiesto;
    const sin = (m.permisos ?? []).filter((p: { clave: string }) => !['ver_usuarios', 'ver_perfiles', 'ver_bitacora'].includes(p.clave));
    await q.query("UPDATE `aplicaciones` SET `manifiesto` = ? WHERE `id` = 'reporte_avance_sumarios'", [JSON.stringify({ ...m, permisos: sin })]);
  }
}
