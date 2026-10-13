// Galería de fondos de pantalla del portal (Configuración → Vista). Las
// imágenes son archivos del propio sitio (public/fondos/): viajan con el
// portal al migrarlo, sin base de datos ni almacenamiento aparte. En la base
// solo se guarda el id que eligió cada persona (usuarios.fondo).
//
// Para agregar una imagen: dejar el archivo optimizado (WebP, ~1920 px) y su
// miniatura (~480 px) en public/fondos/ y sumar una entrada aquí.
export interface FondoPortal {
  id: string;
  nombre: string;
  lugar: string;
  descripcion: string;
  archivo: string;
  miniatura: string;
}

export const FONDOS: FondoPortal[] = [
  {
    id: 'desierto-florido',
    nombre: 'Desierto florido',
    lugar: 'Región de Atacama, Chile',
    descripcion:
      'En los años de lluvias inusuales, el desierto más árido del mundo se cubre de flores. El color fucsia es de la "pata de guanaco", que tiñe kilómetros de llanura frente a los cerros.',
    archivo: 'fondos/desierto-florido.webp',
    miniatura: 'fondos/desierto-florido-mini.webp',
  },
  {
    id: 'san-pedro-de-atacama',
    nombre: 'Altiplano de San Pedro de Atacama',
    lugar: 'Región de Antofagasta, Chile',
    descripcion:
      'Una vicuña, camélido silvestre protegido de los Andes, entre pajonales de paja brava, frente a las laderas de colores del altiplano atacameño.',
    archivo: 'fondos/san-pedro-de-atacama.webp',
    miniatura: 'fondos/san-pedro-de-atacama-mini.webp',
  },
];

export const fondoPorId = (id: string | null | undefined): FondoPortal | null => FONDOS.find((f) => f.id === id) ?? null;
