import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Aplicacion } from './aplicacion.entity';

// Un "módulo" es cada rectángulo de la pantalla de inicio del portal
// (Gestor de Formularios, Automatización de Procesos, Configuración) —
// agrupa aplicaciones. Es una tabla, no código fijo: agregar un módulo
// o moverle aplicaciones no requiere tocar el frontend.
@Entity('modulos')
export class Modulo {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  // Nombre del ícono que dibuja el frontend (ver home.component).
  @Column({ type: 'varchar', length: 30 })
  icono: string;

  // Color de acento, de la paleta oficial del Manual de Normas Gráficas DEP 2026.
  @Column({ type: 'varchar', length: 9 })
  color: string;

  @Column({ type: 'int' })
  orden: number;

  @OneToMany(() => Aplicacion, (a) => a.modulo)
  aplicaciones: Aplicacion[];
}
