// Catálogo del asistente de la pantalla de inicio: las palabras con que la
// búsqueda encuentra cada aplicación, además de su nombre y su descripción.
//
// El nombre, la descripción, el estado (disponible / próximamente), la
// dirección y si la persona está autorizada vienen del servidor (tabla
// "aplicaciones"): así hay una sola fuente de verdad. Aquí solo se agregan las
// palabras clave, por el mismo id de la aplicación. Una aplicación nueva sin
// palabras clave se encuentra igual por su nombre y su descripción.
export interface EntradaCatalogo {
  id: string;
  palabras_clave: string[];
}

export const CATALOGO_ASISTENTE: EntradaCatalogo[] = [
  {
    id: 'reporte_avance_sumarios',
    palabras_clave: ['reporte', 'sumario', 'sumarios', 'avance', 'seguimiento', 'administrativo', 'mensual', 'slep', 'reporte de sumarios'],
  },
  {
    id: 'reporte_circular_30',
    palabras_clave: ['reporte', 'circular', '30', 'circular 30', 'reporte circular'],
  },
  {
    id: 'licencias_medicas',
    palabras_clave: ['licencia', 'licencias', 'medica', 'médica', 'salud', 'enfermedad', 'reposo'],
  },
  {
    id: 'doc_proyecto',
    palabras_clave: ['documentacion', 'documentación', 'proyecto', 'informe', 'informes', 'tecnico', 'técnico'],
  },
  {
    id: 'doc_marco_legal',
    palabras_clave: ['ley', 'legal', 'marco', 'marco legal', 'normativa', 'norma', 'documento', 'pdf', '21.180', '21.663', 'circular'],
  },
  {
    id: 'config_usuarios',
    palabras_clave: ['usuario', 'usuarios', 'cuenta', 'cuentas', 'acceso', 'accesos', 'persona', 'personas', 'configuracion', 'configuración'],
  },
  {
    id: 'config_perfiles',
    palabras_clave: ['perfil', 'perfiles', 'permiso', 'permisos', 'rol', 'roles', 'configuracion', 'configuración'],
  },
  {
    id: 'config_bitacora',
    palabras_clave: ['bitacora', 'bitácora', 'registro', 'auditoria', 'auditoría', 'trazabilidad', 'historial', 'configuracion', 'configuración'],
  },
];
