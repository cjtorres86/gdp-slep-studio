import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { Acceso } from '../../catalogo/entities/acceso.entity';
import { Aplicacion, Manifiesto } from '../../catalogo/entities/aplicacion.entity';
import { Modulo } from '../../catalogo/entities/modulo.entity';
import { PerfilAplicacion } from '../../perfiles/perfil-aplicacion.entity';
import { CATALOGO_SUMARIOS, PERFILES_INICIALES_SUMARIOS } from '../../perfiles/catalogo-sumarios';
import { RolPortal, Usuario } from '../../usuarios/entities/usuario.entity';

// Colores: paleta oficial del Manual de Normas Gráficas DEP 2026.
const MODULOS: Modulo[] = [
  { id: 'gestor_formularios', nombre: 'Gestor de Formularios', icono: 'formularios', color: '#1f84ec', orden: 1 },
  { id: 'automatizacion', nombre: 'Automatización de Procesos', icono: 'automatizacion', color: '#90d039', orden: 2 },
  { id: 'documentacion', nombre: 'Documentación', icono: 'documentacion', color: '#3abff0', orden: 3 },
  { id: 'configuracion', nombre: 'Configuración', icono: 'configuracion', color: '#25306B', orden: 4 },
] as Modulo[];

const URL_SUMARIOS = 'https://proyecto1-omega-eight.vercel.app';

// Ficha de Sumarios (contrato de integración): su catálogo de permisos,
// alcance de un solo SLEP y la opción individual "Puede cargar datos" (regida
// por la carga de cada perfil). Igual a las migraciones.
const MANIFIESTO_SUMARIOS: Manifiesto = {
  permisos: CATALOGO_SUMARIOS,
  alcance: 'slep_uno',
  opciones: [{ clave: 'cargar_datos', etiqueta: 'Puede cargar datos', descripcion: 'Guardar valores y cargar archivos Excel en los formularios.' }],
};
const ROL_A_PERFIL: Record<string, string> = { Admin: 'perfil_admin', Validador: 'perfil_validador', Digitador: 'perfil_digitador', Superadmin: 'Superadmin' };

const APLICACIONES: Partial<Aplicacion>[] = [
  { id: 'reporte_avance_sumarios', moduloId: 'gestor_formularios', nombre: 'Reporte Avance de Sumarios', descripcion: 'Seguimiento mensual de sumarios administrativos de los 36 SLEP.', url: URL_SUMARIOS, estado: 'activa', visibilidad: 'por_acceso', orden: 1, manifiesto: MANIFIESTO_SUMARIOS, urlIntegracion: 'https://proyecto1-backend-ux0w.onrender.com' },
  { id: 'reporte_circular_30', moduloId: 'gestor_formularios', nombre: 'Reporte Circular 30', descripcion: 'Reporte de la Circular 30 para los SLEP.', url: null, estado: 'proximamente', visibilidad: 'por_acceso', orden: 2 },
  { id: 'licencias_medicas', moduloId: 'automatizacion', nombre: 'Licencias Médicas', descripcion: 'Tramitación automatizada de licencias médicas.', url: null, estado: 'proximamente', visibilidad: 'por_acceso', orden: 1 },
  { id: 'doc_proyecto', moduloId: 'documentacion', nombre: 'Documentación del Proyecto', descripcion: 'Serie de informes técnicos del proyecto GDP-SLEP Studio.', url: 'https://cjtorres86.github.io/serie-informes/', estado: 'activa', visibilidad: 'admin', orden: 1 },
  { id: 'doc_marco_legal', moduloId: 'documentacion', nombre: 'Documentación Marco Legal', descripcion: 'Normas del proyecto de licencias médicas, con búsqueda y descarga de los textos oficiales.', url: 'https://cjtorres86.github.io/biblioteca-normativa/', estado: 'activa', visibilidad: 'admin', orden: 2 },
  { id: 'config_usuarios', moduloId: 'configuracion', nombre: 'Usuarios y accesos', descripcion: 'Crea y administra las cuentas de las personas, y define a qué aplicaciones entra cada una y con qué rol.', url: '/configuracion/usuarios', estado: 'activa', visibilidad: 'admin', orden: 1 },
  { id: 'config_perfiles', moduloId: 'configuracion', nombre: 'Perfiles', descripcion: 'Define los perfiles y qué puede hacer cada uno dentro de las aplicaciones.', url: '/configuracion/perfiles', estado: 'activa', visibilidad: 'admin', orden: 2 },
  { id: 'config_bitacora', moduloId: 'configuracion', nombre: 'Bitácora', descripcion: 'Registro de quién hizo qué y cuándo en todas las aplicaciones, para auditoría y trazabilidad.', url: null, estado: 'proximamente', visibilidad: 'admin', orden: 3 },
];

// Las 5 personas que hoy usan Avance de Sumarios, con las mismas claves.
// SOLO PARA DESARROLLO: antes de usar el portal en serio, estas claves
// deben cambiarse (o las cuentas recrearse con claves nuevas).
const PERSONAS: { usuario: string; clave: string; nombre: string; rolPortal: RolPortal; rolSumarios: string; alcance: string[] }[] = [
  { usuario: 'cesar', clave: 'cesarcesar', nombre: 'César', rolPortal: 'superadmin', rolSumarios: 'Superadmin', alcance: ['todos'] },
  { usuario: 'Claudia', clave: 'claudiaclaudia', nombre: 'Claudia', rolPortal: 'admin', rolSumarios: 'Admin', alcance: ['todos'] },
  { usuario: 'Betania', clave: 'betaniabetania', nombre: 'Betania', rolPortal: 'admin', rolSumarios: 'Admin', alcance: ['todos'] },
  { usuario: 'Ximena', clave: 'ximenaximena', nombre: 'Ximena', rolPortal: 'usuario', rolSumarios: 'Validador', alcance: ['todos'] },
  { usuario: 'Barrancas', clave: 'barrancasbarrancas', nombre: 'Barrancas', rolPortal: 'usuario', rolSumarios: 'Digitador', alcance: ['Barrancas'] },
];

// Idempotente, como los demás scripts del proyecto: se puede correr las
// veces que haga falta. Módulos y aplicaciones se actualizan; una persona
// que ya existe NO se toca (no se le pisa la clave).
async function sembrar() {
  await dataSource.initialize();
  try {
    await dataSource.getRepository(Modulo).save(MODULOS);
    await dataSource.getRepository(Aplicacion).save(APLICACIONES);
    // Perfiles de Sumarios (se administran en Configuración → Perfiles).
    await dataSource.getRepository(PerfilAplicacion).save(PERFILES_INICIALES_SUMARIOS.map((p) => ({ ...p, aplicacionId: 'reporte_avance_sumarios' })));

    const usuarios = dataSource.getRepository(Usuario);
    const accesos = dataSource.getRepository(Acceso);
    let nuevas = 0;
    for (const p of PERSONAS) {
      let u = await usuarios.findOne({ where: { usuario: p.usuario } });
      if (!u) {
        u = await usuarios.save(
          usuarios.create({
            usuario: p.usuario,
            contrasenaHash: await bcrypt.hash(p.clave, 10),
            nombreParaMostrar: p.nombre,
            rolPortal: p.rolPortal,
            activo: true,
          }),
        );
        nuevas++;
      }
      await accesos.save(accesos.create({ usuarioId: u.id, aplicacionId: 'reporte_avance_sumarios', rol: ROL_A_PERFIL[p.rolSumarios] ?? p.rolSumarios, alcance: p.alcance, opciones: { cargar_datos: p.rolSumarios !== 'Validador' } }));
    }
    console.log(`Módulos: ${MODULOS.length}. Aplicaciones: ${APLICACIONES.length}. Personas nuevas: ${nuevas} de ${PERSONAS.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

sembrar().catch((e) => {
  console.error('Error al sembrar el portal:', e.message ?? e);
  process.exit(1);
});
