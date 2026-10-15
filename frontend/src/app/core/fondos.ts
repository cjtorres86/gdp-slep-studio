// Galería de fondos de pantalla del portal (Configuración → Vista). Las
// imágenes son archivos del propio sitio (public/fondos/): viajan con el
// portal al migrarlo, sin base de datos ni almacenamiento aparte. En la base
// solo se guarda el id que eligió cada persona (usuarios.fondo).
//
// Para agregar una imagen: dejar el archivo optimizado (WebP, ~2560 px) y su
// miniatura (~480 px) en public/fondos/ y sumar una entrada aquí. Un fondo con
// varias imágenes las va pasando cada CAMBIO_IMAGEN_MS.
export interface ImagenFondo {
  archivo: string;
  miniatura: string;
}

export interface FondoPortal {
  id: string;
  nombre: string;
  region: string;
  lugar: string;
  descripcion: string;
  imagenes: ImagenFondo[];
}

export const CAMBIO_IMAGEN_MS = 7000;
// Recorrido (interruptor del encabezado): todas las imágenes de todos los
// fondos, una tras otra, cada RECORRIDO_MS.
export const RECORRIDO_MS = 12000;

const imagen = (nombre: string): ImagenFondo => ({ archivo: `fondos/${nombre}.webp`, miniatura: `fondos/${nombre}-mini.webp` });

// El fondo de siempre (sin imagen): la tarjeta de la galería cuenta qué es la DEP.
export const FONDO_INSTITUCIONAL = {
  nombre: 'Institucional',
  lugar: 'Dirección de Educación Pública',
  descripcion:
    'La Dirección de Educación Pública (DEP), creada por la Ley 21.040 en 2017, es el servicio del Ministerio de Educación que conduce el nuevo Sistema de Educación Pública. Acompaña a los Servicios Locales de Educación Pública (SLEP), que asumen gradualmente las escuelas, liceos y jardines que antes administraban los municipios, para que cada estudiante de Chile reciba una educación pública de calidad.',
};

export const FONDOS: FondoPortal[] = [
  {
    id: 'desierto-florido',
    nombre: 'Desierto florido',
    region: 'Región de Atacama',
    lugar: 'Llanos de Atacama',
    descripcion:
      'En los años de lluvias inusuales, el desierto más árido del mundo se cubre de flores: la "pata de guanaco" tiñe de fucsia kilómetros de llanura. Entre ellas cruza el tren de carga del norte, heredero de la línea Caldera–Copiapó de 1851, la primera de Chile. Lo que parecía dormido solo esperaba su momento.',
    imagenes: [imagen('desierto-florido'), imagen('desierto-florido-tren')],
  },
  {
    id: 'alma',
    nombre: 'Observatorio ALMA',
    region: 'Región de Antofagasta',
    lugar: 'Llano de Chajnantor, a 5.000 m de altura',
    descripcion:
      'Bajo el cielo más limpio del planeta, 66 antenas trabajan como un solo gran telescopio para estudiar el origen de las estrellas y las galaxias. Sobre ellas se dibujan la Vía Láctea y las Nubes de Magallanes: aquí, mirar lejos es una forma de entender de dónde venimos.',
    imagenes: [imagen('alma')],
  },
  {
    id: 'anga-roa',
    nombre: 'Anga Roa, Rapa Nui',
    region: 'Región de Valparaíso',
    lugar: 'Isla de Pascua',
    descripcion:
      'Los moái, tallados por el pueblo rapanui, se levantan de espaldas al mar para proteger a su gente. Al atardecer sus siluetas se recortan contra un cielo de fuego: un recordatorio de que lo que se construye en comunidad atraviesa los siglos.',
    imagenes: [imagen('anga-roa')],
  },
  {
    id: 'torres-del-paine',
    nombre: 'Parque Nacional Torres del Paine',
    region: 'Región de Magallanes y de la Antártica Chilena',
    lugar: 'Patagonia chilena',
    descripcion:
      'Las Torres y los Cuernos de granito se elevan sobre lagos turquesa, el hielo azul del glaciar Grey avanza lento y los senderos de madera invitan a seguir caminando. Reserva de la Biosfera desde 1978, es la prueba de que los grandes paisajes se recorren paso a paso.',
    imagenes: [imagen('torres-del-paine'), imagen('torres-del-paine-glaciar'), imagen('torres-del-paine-pasarela')],
  },
  {
    id: 'patagonia-puma',
    nombre: 'Patagonia chilena',
    region: 'Región de Magallanes y de la Antártica Chilena',
    lugar: 'Tierra del puma',
    descripcion:
      'El puma, el gran felino de Chile, recorre en silencio las estepas patagónicas. Paciente y atento, enseña a sus cachorros a moverse en uno de los territorios más exigentes del mundo: fuerza, calma y aprendizaje que pasa de una generación a otra.',
    imagenes: [imagen('patagonia-puma'), imagen('patagonia-puma-cachorro')],
  },
];

export const fondoPorId = (id: string | null | undefined): FondoPortal | null => FONDOS.find((f) => f.id === id) ?? null;
