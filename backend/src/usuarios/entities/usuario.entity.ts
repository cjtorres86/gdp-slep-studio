import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Acceso } from '../../catalogo/entities/acceso.entity';

// Rol DENTRO DEL PORTAL (no confundir con el rol que una persona tiene
// dentro de cada aplicación — ese vive en Acceso, uno por aplicación).
// Solo decide si ve la sección "Configuración" del portal.
export type RolPortal = 'superadmin' | 'admin' | 'usuario';

// Identidad global de una persona. Una sola fila por persona, sin
// importar a cuántas aplicaciones entre — lo que cambia por aplicación
// (rol y alcance) está en Acceso.
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable: una cuenta "pendiente" (persona registrada de antemano,
  // todavía sin usuario/clave) existe sin ellos; ingresará con su RUT
  // cuando se active ClaveÚnica.
  @Column({ type: 'varchar', length: 60, unique: true, nullable: true })
  usuario: string | null;

  @Column({ name: 'contrasena_hash', type: 'varchar', length: 255, nullable: true })
  contrasenaHash: string | null;

  // RUT: la llave con la que ClaveÚnica identificará a la persona. El
  // emparejamiento RUT → accesos lo hace siempre un administrador, de
  // antemano — nunca la propia persona al entrar.
  @Column({ type: 'varchar', length: 12, unique: true, nullable: true })
  rut: string | null;

  @Column({ name: 'nombre_para_mostrar', type: 'varchar', length: 120 })
  nombreParaMostrar: string;

  @Column({ name: 'rol_portal', type: 'varchar', length: 20, default: 'usuario' })
  rolPortal: RolPortal;

  // Desactivar bloquea el ingreso al portal (y por lo tanto a todas las
  // aplicaciones) sin borrar nada.
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  // Configuración → Vista: el fondo de pantalla que eligió la persona (el id
  // de una imagen de la galería del portal). null = el fondo institucional.
  // Es una preferencia de la persona: la sigue en cualquier computador.
  @Column({ type: 'varchar', length: 40, nullable: true })
  fondo: string | null;

  @OneToMany(() => Acceso, (a) => a.usuario)
  accesos: Acceso[];
}
