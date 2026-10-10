import { MigrationInterface, QueryRunner } from 'typeorm';

// Configuración pasa a la barra superior del portal (botón "Configuración",
// que abre una ventana con sus tres opciones). Desde ahora el Admin ve las
// TRES opciones —Usuarios y accesos, Perfiles y Bitácora—, igual que el
// Superadmin; antes Perfiles y Bitácora eran solo del Superadmin.
// Cada opción lleva una explicación breve de para qué sirve, que es lo que
// muestra la ventana.
const OPCIONES: { id: string; orden: number; descripcion: string }[] = [
  { id: 'config_usuarios', orden: 1, descripcion: 'Crea y administra las cuentas de las personas, y define a qué aplicaciones entra cada una y con qué rol.' },
  { id: 'config_perfiles', orden: 2, descripcion: 'Define los perfiles y qué puede hacer cada uno dentro de las aplicaciones.' },
  { id: 'config_bitacora', orden: 3, descripcion: 'Registro de quién hizo qué y cuándo en todas las aplicaciones, para auditoría y trazabilidad.' },
];

export class ConfiguracionParaAdmins1791200000000 implements MigrationInterface {
  name = 'ConfiguracionParaAdmins1791200000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const o of OPCIONES) {
      await q.query(
        "UPDATE `aplicaciones` SET `visibilidad` = 'admin', `orden` = ?, `descripcion` = ? WHERE `id` = ?",
        [o.orden, o.descripcion, o.id],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `aplicaciones` SET `visibilidad` = 'superadmin', `orden` = 2, `descripcion` = 'Registro de todo lo que hace cada persona en todas las aplicaciones.' WHERE `id` = 'config_bitacora'");
    await q.query("UPDATE `aplicaciones` SET `visibilidad` = 'superadmin', `orden` = 3, `descripcion` = 'Perfiles y permisos.' WHERE `id` = 'config_perfiles'");
    await q.query("UPDATE `aplicaciones` SET `descripcion` = 'Personas, y a qué aplicaciones entra cada una.' WHERE `id` = 'config_usuarios'");
  }
}
