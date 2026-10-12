import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Qué pasó con una búsqueda del asistente de la pantalla de inicio.
export type ResultadoBusqueda = 'abrir' | 'proximamente' | 'sin_autorizacion' | 'sin_resultados';

// Historial de búsquedas del asistente de la pantalla de inicio: cada persona
// ve solo el suyo, en cualquier computador.
@Entity('busquedas_asistente')
@Index('IDX_busquedas_usuario_fecha', ['usuarioId', 'creadoEn'])
export class Busqueda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @Column({ type: 'varchar', length: 200 })
  texto: string;

  // La aplicación elegida (null si no hubo resultados).
  @Column({ name: 'aplicacion_id', type: 'varchar', length: 60, nullable: true })
  aplicacionId: string | null;

  @Column({ type: 'varchar', length: 20 })
  resultado: ResultadoBusqueda;

  @Column({ name: 'creado_en', type: 'datetime', precision: 3 })
  creadoEn: Date;
}
