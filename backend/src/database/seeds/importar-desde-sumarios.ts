import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { dataSourceOptions } from '../data-source';
import { Acceso } from '../../catalogo/entities/acceso.entity';
import { RolPortal, Usuario } from '../../usuarios/entities/usuario.entity';

// Traspaso de cuentas: Avance de Sumarios → portal (etapa 1 de Configuración).
//
// Trae a cada persona con su MISMO usuario y su MISMA clave (se copia la
// clave cifrada; el portal la lee igual), su perfil, su SLEP, si está activa,
// su RUT y su permiso de "cargar datos".
//
// Se puede correr las veces que haga falta: no duplica nada (empareja por
// usuario). Con --simular muestra lo que haría, sin cambiar nada.
//
// Uso:  npm run importar:sumarios -- --simular
//       npm run importar:sumarios
// Lee la base del portal desde DB_DATABASE y la de Sumarios desde
// SUMARIOS_DB_DATABASE (por defecto "defaultdb"), en el mismo servidor.

const APP = 'reporte_avance_sumarios';
const PERFIL_A_ROL: Record<string, string> = {
  perfil_admin: 'Admin',
  perfil_validador: 'Validador',
  perfil_digitador: 'Digitador',
};

interface CuentaSumarios {
  usuario: string | null;
  contrasena_hash: string | null;
  nombre_para_mostrar: string;
  es_superusuario: number;
  alcance: string;
  activo: number;
  perfil_id: string | null;
  rut: string | null;
  puede_cargar_datos: number | null;
}

async function main() {
  const simular = process.argv.includes('--simular');
  const portal = new DataSource({ ...dataSourceOptions, migrations: [] });
  const sumarios = new DataSource({ ...(dataSourceOptions as MysqlConnectionOptions), entities: [], migrations: [], database: process.env.SUMARIOS_DB_DATABASE ?? 'defaultdb' });
  await portal.initialize();
  await sumarios.initialize();

  const tieneCargaDatos = (await sumarios.query("SHOW COLUMNS FROM usuarios LIKE 'puede_cargar_datos'")).length > 0;
  const cuentas: CuentaSumarios[] = await sumarios.query(
    'SELECT usuario, contrasena_hash, nombre_para_mostrar, es_superusuario, alcance, activo, perfil_id, rut, ' +
      (tieneCargaDatos ? 'puede_cargar_datos' : 'NULL AS puede_cargar_datos') +
      ' FROM usuarios ORDER BY nombre_para_mostrar',
  );

  const resumen = { nuevas: 0, actualizadas: 0, pendientesOmitidas: 0, perfilDesconocido: [] as string[] };
  const usuarios = portal.getRepository(Usuario);
  const accesos = portal.getRepository(Acceso);

  console.log(simular ? '\n=== SIMULACIÓN: no se cambia nada ===\n' : '\n=== Traspaso desde Sumarios ===\n');
  for (const c of cuentas) {
    if (!c.usuario || !c.contrasena_hash) {
      resumen.pendientesOmitidas++;
      continue;
    }
    const esSuperadmin = !!c.es_superusuario;
    const rol = esSuperadmin ? null : PERFIL_A_ROL[c.perfil_id ?? ''];
    if (!esSuperadmin && !rol) {
      resumen.perfilDesconocido.push(`${c.usuario} (${c.perfil_id})`);
      continue;
    }

    let persona = await usuarios.findOne({ where: { usuario: c.usuario } });
    const esNueva = !persona;
    if (!persona) {
      const rolPortal: RolPortal = esSuperadmin ? 'superadmin' : c.perfil_id === 'perfil_admin' ? 'admin' : 'usuario';
      persona = usuarios.create({ usuario: c.usuario, rolPortal });
    } else if (esSuperadmin) {
      persona.rolPortal = 'superadmin';
    }
    persona.nombreParaMostrar = c.nombre_para_mostrar;
    persona.contrasenaHash = c.contrasena_hash;
    persona.activo = !!c.activo;
    if (c.rut && !persona.rut) persona.rut = c.rut;

    const alcance = c.alcance === 'todos' ? ['todos'] : [c.alcance];
    const opciones = rol ? { cargar_datos: rol === 'Digitador' ? true : c.puede_cargar_datos === null ? rol === 'Admin' : !!c.puede_cargar_datos } : null;
    const detalle = esSuperadmin ? 'Superadmin (entra a todo)' : `${rol} · ${alcance.join(', ')} · carga datos: ${opciones!.cargar_datos ? 'sí' : 'no'}`;
    console.log(`${esNueva ? '+ nueva     ' : '~ actualiza '} ${c.usuario.padEnd(22)} ${detalle}${c.activo ? '' : ' · DESACTIVADA'}`);
    esNueva ? resumen.nuevas++ : resumen.actualizadas++;

    if (simular) continue;
    const { accesos: _a, ...soloPersona } = persona;
    const guardada = await usuarios.save(soloPersona);
    if (rol) await accesos.save({ usuarioId: guardada.id, aplicacionId: APP, rol, alcance, opciones });
  }

  console.log(`\nResumen: ${resumen.nuevas} nuevas, ${resumen.actualizadas} actualizadas, ${resumen.pendientesOmitidas} cuentas pendientes omitidas (sin usuario o sin clave).`);
  if (resumen.perfilDesconocido.length) console.log(`ATENCIÓN — perfil sin equivalente en el portal, no se traspasaron: ${resumen.perfilDesconocido.join(', ')}`);
  if (simular) console.log('Fue una simulación: no se cambió nada. Para traspasar de verdad, corre el mismo comando sin --simular.');
  await portal.destroy();
  await sumarios.destroy();
}

main().catch((e) => {
  console.error('Error en el traspaso:', e.message ?? e);
  process.exit(1);
});
