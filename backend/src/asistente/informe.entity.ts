import { Column, Entity, PrimaryColumn } from 'typeorm';

// Una pregunta que el asistente le hace a la persona antes de abrir un
// informe. "opcionTodos": el texto de la respuesta que no filtra (ej. "Todos
// los SLEP"); null = la pregunta es obligatoria (hay que elegir uno).
export interface PreguntaInforme {
  clave: 'mes' | 'slep';
  texto: string;
  opcionTodos: string | null;
}

export type FormatoInforme = 'excel' | 'interactivo' | 'pdf';

// Informes y archivos que entregan las aplicaciones, para el asistente de la
// pantalla de inicio. La ruta es una página de la aplicación; {mes} y {anio}
// se reemplazan por la respuesta de la persona (si la ruta no los lleva, el
// mes y el SLEP elegidos van como parámetros ?mes=&anio=&slep=).
@Entity('informes_asistente')
export class Informe {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id: string;

  @Column({ name: 'aplicacion_id', type: 'varchar', length: 60 })
  aplicacionId: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 20 })
  formato: FormatoInforme;

  // Permiso del catálogo de la aplicación que hace falta (ej. "exportar_informe").
  @Column({ type: 'varchar', length: 60 })
  permiso: string;

  // Solo para quien trabaja con todos los SLEP (ej. Consolidado por Mes).
  @Column({ name: 'requiere_alcance_todos', type: 'boolean', default: false })
  requiereAlcanceTodos: boolean;

  @Column({ type: 'varchar', length: 300 })
  ruta: string;

  @Column({ type: 'json' })
  preguntas: PreguntaInforme[];

  @Column({ name: 'palabras_clave', type: 'json' })
  palabrasClave: string[];

  @Column({ type: 'int' })
  orden: number;
}
