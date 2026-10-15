import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Atajo } from './atajos';

// Accesos directos de cada persona (los rectángulos «Próxima aplicación» de la
// ventana Aplicaciones). En su propia tabla y no como columna de usuarios: así
// las consultas de usuarios no dependen de ella.
@Entity('atajos_usuario')
export class AtajosUsuario {
  @PrimaryColumn({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @Column({ type: 'json' })
  atajos: Atajo[];

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
