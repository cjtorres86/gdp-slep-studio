// Catálogo de permisos de "Reporte Avance de Sumarios" y sus 4 perfiles de
// partida. La migración 1791500000000 lo guarda en la base; aquí queda como
// referencia única (la usa también la carga inicial).
//
// Cada permiso es una pantalla ("vista") o una acción. Sumarios los verifica
// en su servidor: no basta con esconder un botón.

export interface PermisoCatalogo {
  clave: string;
  grupo: string;
  tipo: 'vista' | 'accion';
  etiqueta: string;
  descripcion: string;
  sensible?: boolean;
  requiere?: string[]; // otros permisos que este necesita
  requiereCarga?: boolean; // no tiene sentido si el perfil "nunca" carga datos
}

export const CATALOGO_SUMARIOS: PermisoCatalogo[] = [
  { clave: 'dashboard', grupo: 'Pantallas', tipo: 'vista', etiqueta: 'Panel de avance', descripcion: 'Ver el tablero con ranking, gráficos y desglose.' },
  { clave: 'formulario', grupo: 'Pantallas', tipo: 'vista', etiqueta: 'Formularios', descripcion: 'Ver los datos del formulario de cada SLEP y mes.' },
  { clave: 'inspector', grupo: 'Pantallas', tipo: 'vista', etiqueta: 'Inspector de validaciones', descripcion: 'Ver qué campos tienen errores y por qué.' },
  { clave: 'exportar_informe', grupo: 'Pantallas', tipo: 'vista', etiqueta: 'Informe interactivo', descripcion: 'Ver el informe e imprimirlo o guardarlo en PDF.' },
  { clave: 'historico', grupo: 'Pantallas', tipo: 'vista', etiqueta: 'Histórico', descripcion: 'Comparar el avance entre meses.' },

  { clave: 'importar_excel', grupo: 'Carga de datos', tipo: 'accion', etiqueta: 'Cargar archivos Excel', descripcion: 'Subir un Excel para llenar el formulario. Exige que la persona pueda cargar datos.', requiereCarga: true },
  { clave: 'editar_mes_cerrado', grupo: 'Carga de datos', tipo: 'accion', etiqueta: 'Editar meses cerrados', descripcion: 'Corregir datos de un mes que ya fue cerrado.', sensible: true, requiereCarga: true },

  { clave: 'crear_mes', grupo: 'Gestión de meses', tipo: 'accion', etiqueta: 'Crear mes', descripcion: 'Abrir un mes nuevo para los SLEP.' },
  { clave: 'cerrar_mes', grupo: 'Gestión de meses', tipo: 'accion', etiqueta: 'Cerrar mes', descripcion: 'Cerrar un mes para que no se modifique.' },
  { clave: 'reabrir_mes', grupo: 'Gestión de meses', tipo: 'accion', etiqueta: 'Reabrir mes', descripcion: 'Volver a abrir un mes que ya estaba cerrado.', sensible: true },
  { clave: 'eliminar_mes', grupo: 'Gestión de meses', tipo: 'accion', etiqueta: 'Eliminar mes', descripcion: 'Quitar un mes completo de la vista de todos. Los datos se conservan en la base de datos.', sensible: true },

  { clave: 'exportar_excel_consolidado', grupo: 'Descargas', tipo: 'accion', etiqueta: 'Excel consolidado', descripcion: 'Descargar el Excel con todos los SLEP.' },
  { clave: 'exportar_excel_slep', grupo: 'Descargas', tipo: 'accion', etiqueta: 'Excel por SLEP', descripcion: 'Descargar el Excel de los SLEP de su alcance.' },

  { clave: 'mensajes', grupo: 'Mensajes', tipo: 'accion', etiqueta: 'Escribir mensajes', descripcion: 'Participar en las conversaciones de cada formulario.' },
  { clave: 'moderar_mensajes', grupo: 'Mensajes', tipo: 'accion', etiqueta: 'Moderar mensajes', descripcion: 'Editar o borrar mensajes escritos por otras personas.', sensible: true, requiere: ['mensajes'] },

  // Pantallas propias de Sumarios para consultar personas, perfiles y su
  // bitácora. El Superadmin las ve siempre; a cualquier otro perfil se le
  // pueden activar aquí. (Administrar sigue haciéndose en el portal.)
  { clave: 'ver_usuarios', grupo: 'Administración de la aplicación', tipo: 'vista', etiqueta: 'Ver usuarios', descripcion: 'Consultar la lista de personas dentro de Avance de Sumarios.', sensible: true },
  { clave: 'ver_perfiles', grupo: 'Administración de la aplicación', tipo: 'vista', etiqueta: 'Ver perfiles', descripcion: 'Consultar los perfiles y sus permisos dentro de Avance de Sumarios.' },
  { clave: 'ver_bitacora', grupo: 'Administración de la aplicación', tipo: 'vista', etiqueta: 'Ver bitácora', descripcion: 'Consultar la bitácora propia de Avance de Sumarios (quién hizo qué y cuándo).', sensible: true },
];

// Carga de datos de un perfil: siempre · opcional (activada o desactivada al
// asignar el perfil; después se cambia persona por persona) · nunca.
export type ModoCarga = 'siempre' | 'opcional_si' | 'opcional_no' | 'nunca';

export interface RestriccionesPerfil {
  exigeSlep: boolean; // no puede tener "Todos los SLEP"
  carga: ModoCarga;
  cargaSoloSuperadmin: boolean; // solo el Superadmin cambia la carga de estas personas
}

const PANTALLAS = ['dashboard', 'formulario', 'inspector', 'exportar_informe', 'historico'];

// Los 3 perfiles de hoy parten EXACTAMENTE como funcionan hoy, más "Visita".
export const PERFILES_INICIALES_SUMARIOS = [
  {
    id: 'perfil_admin', nombre: 'Admin', color: '#006BB9', orden: 1,
    descripcion: 'Administra el seguimiento: crea y cierra meses, y descarga todo.',
    permisos: [...PANTALLAS, 'importar_excel', 'crear_mes', 'cerrar_mes', 'exportar_excel_consolidado', 'exportar_excel_slep', 'mensajes'],
    restricciones: { exigeSlep: false, carga: 'opcional_si', cargaSoloSuperadmin: true } as RestriccionesPerfil,
  },
  {
    id: 'perfil_validador', nombre: 'Validador', color: '#1D9FD0', orden: 2,
    descripcion: 'Revisa los datos de los SLEP y acompaña el cierre de cada mes.',
    permisos: [...PANTALLAS, 'importar_excel', 'crear_mes', 'cerrar_mes', 'exportar_excel_consolidado', 'exportar_excel_slep', 'mensajes'],
    restricciones: { exigeSlep: false, carga: 'opcional_no', cargaSoloSuperadmin: false } as RestriccionesPerfil,
  },
  {
    id: 'perfil_digitador', nombre: 'Digitador', color: '#4A7D12', orden: 3,
    descripcion: 'Carga los datos de su SLEP cada mes.',
    permisos: [...PANTALLAS, 'importar_excel', 'exportar_excel_slep', 'mensajes'],
    restricciones: { exigeSlep: true, carga: 'siempre', cargaSoloSuperadmin: false } as RestriccionesPerfil,
  },
  {
    id: 'perfil_visita', nombre: 'Visita', color: '#64748B', orden: 4,
    descripcion: 'Solo puede ver y descargar. No modifica nada.',
    permisos: [...PANTALLAS, 'exportar_excel_consolidado', 'exportar_excel_slep'],
    restricciones: { exigeSlep: false, carga: 'nunca', cargaSoloSuperadmin: false } as RestriccionesPerfil,
  },
];
