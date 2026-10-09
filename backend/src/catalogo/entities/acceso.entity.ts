import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Aplicacion } from './aplicacion.entity';

// El corazón del modelo: qué persona entra a qué aplicación, con qué rol
// y sobre qué datos. Una fila por (persona, aplicación) — así la misma
// persona puede ser Validador en una aplicación y Revisora en otra, y no
// tener acceso a una tercera.
@Entity('accesos')
export class Acceso {
  @PrimaryColumn({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @PrimaryColumn({ name: 'aplicacion_id', type: 'varchar', length: 60 })
  aplicacionId: string;

  @ManyToOne(() => Usuario, (u) => u.accesos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Aplicacion, (a) => a.accesos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aplicacion_id' })
  aplicacion: Aplicacion;

  // Nombre del rol DENTRO de esa aplicación (ej. "Validador"). Qué puede
  // hacer ese rol lo sabe cada aplicación — el portal solo lo asigna.
  @Column({ type: 'varchar', length: 60 })
  rol: string;

  // Alcance como LISTA: ["todos"] o uno o más SLEP, ej. ["Barrancas",
  // "Los Álamos"]. Así una persona puede trabajar con varios SLEP sin
  // tener que ser "todos".
  @Column({ type: 'json' })
  alcance: string[];
}
