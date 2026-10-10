import { Column, Entity, PrimaryColumn } from 'typeorm';

// Lista oficial de los 36 SLEP. El portal decide sobre qué SLEP trabaja cada
// persona en cada aplicación, así que la lista vive aquí.
@Entity('sleps')
export class Slep {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  nombre: string;

  @Column({ type: 'int' })
  orden: number;
}
