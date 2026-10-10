import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { RestriccionesPerfil } from './catalogo-sumarios';

// Perfil de una aplicación integrada (ej. Digitador en Sumarios), administrado
// desde el portal. Su id es el MISMO que usa la aplicación (ej.
// "perfil_digitador"), y nunca cambia: el acceso de cada persona guarda este
// id, así que renombrar un perfil no deja a nadie sin perfil.
@Entity('perfiles_aplicacion')
export class PerfilAplicacion {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id: string;

  @Column({ name: 'aplicacion_id', type: 'varchar', length: 60 })
  aplicacionId: string;

  @Column({ type: 'varchar', length: 60 })
  nombre: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  descripcion: string;

  @Column({ type: 'varchar', length: 9 })
  color: string;

  // Claves del catálogo de la aplicación (ej. ["dashboard", "crear_mes"]).
  @Column({ type: 'json' })
  permisos: string[];

  @Column({ type: 'json' })
  restricciones: RestriccionesPerfil;

  @Column({ type: 'int', default: 99 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
