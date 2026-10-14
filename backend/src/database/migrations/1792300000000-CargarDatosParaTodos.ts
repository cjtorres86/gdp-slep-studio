import { MigrationInterface, QueryRunner } from 'typeorm';
import { CATALOGO_SUMARIOS } from '../../perfiles/catalogo-sumarios';

// "Cargar datos" en Sumarios (mes anterior o archivo Excel) para todos los
// perfiles: el permiso "importar_excel" pasa a llamarse "Cargar datos" en el
// catálogo y queda activado en todos los perfiles de Sumarios. Se desactiva
// perfil por perfil en Configuración → Perfiles. (Sumarios actualiza su copia
// con su propia migración, y el portal le avisa en cada cambio de perfil.)
// Se arma en JavaScript para que funcione igual en MySQL y en MariaDB.
export class CargarDatosParaTodos1792300000000 implements MigrationInterface {
  name = 'CargarDatosParaTodos1792300000000';

  public async up(q: QueryRunner): Promise<void> {
    const [app] = await q.query("SELECT `manifiesto` FROM `aplicaciones` WHERE `id` = 'reporte_avance_sumarios'");
    if (app) {
      const m = typeof app.manifiesto === 'string' ? JSON.parse(app.manifiesto) : app.manifiesto;
      await q.query("UPDATE `aplicaciones` SET `manifiesto` = ? WHERE `id` = 'reporte_avance_sumarios'", [JSON.stringify({ ...m, permisos: CATALOGO_SUMARIOS })]);
    }
    const perfiles: { id: string; permisos: unknown }[] = await q.query("SELECT `id`, `permisos` FROM `perfiles_aplicacion` WHERE `aplicacion_id` = 'reporte_avance_sumarios'");
    for (const p of perfiles) {
      const lista: string[] = (typeof p.permisos === 'string' ? JSON.parse(p.permisos) : p.permisos) ?? [];
      if (lista.includes('importar_excel')) continue;
      await q.query('UPDATE `perfiles_aplicacion` SET `permisos` = ? WHERE `id` = ?', [JSON.stringify([...lista, 'importar_excel']), p.id]);
    }
  }

  public async down(): Promise<void> {
    // No se revierte: no se sabe qué perfiles lo tenían desactivado antes.
  }
}
