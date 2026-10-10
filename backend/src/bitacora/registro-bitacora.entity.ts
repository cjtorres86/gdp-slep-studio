import { Column, Entity, PrimaryColumn } from 'typeorm';

// Un registro de la Bitácora central. Solo se agregan: no hay forma de
// editarlos ni borrarlos (BitacoraService no lo ofrece, a propósito).
@Entity('registros_bitacora')
export class RegistroBitacora {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 60 })
  origen: string; // "portal" o el id de la aplicación

  @Column({ name: 'origen_id', type: 'varchar', length: 80, nullable: true })
  origenId: string | null;

  @Column({ name: 'creado_en', type: 'datetime', precision: 3 })
  creadoEn: Date;

  @Column({ name: 'persona_portal_id', type: 'varchar', length: 36, nullable: true })
  personaPortalId: string | null;

  @Column({ name: 'persona_nombre', type: 'varchar', length: 120 })
  personaNombre: string;

  @Column({ name: 'persona_perfil', type: 'varchar', length: 80 })
  personaPerfil: string;

  @Column({ type: 'varchar', length: 60 })
  accion: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'json', nullable: true })
  detalle: unknown;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;
}
