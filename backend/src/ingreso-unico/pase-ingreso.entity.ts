import { Column, Entity, PrimaryColumn } from 'typeorm';

// Pase de un solo uso para entrar a una aplicación sin volver a escribir la
// clave. Solo se guarda su huella (SHA-256): si alguien leyera la base, no
// podría usar los pases.
@Entity('pases_ingreso')
export class PaseIngreso {
  @PrimaryColumn({ type: 'char', length: 64 })
  huella: string;

  @Column({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @Column({ name: 'aplicacion_id', type: 'varchar', length: 60 })
  aplicacionId: string;

  @Column({ name: 'vence_en', type: 'datetime' })
  venceEn: Date;

  @Column({ name: 'usado_en', type: 'datetime', nullable: true })
  usadoEn: Date | null;
}
