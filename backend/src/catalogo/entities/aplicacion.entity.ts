import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { Modulo } from './modulo.entity';
import { Acceso } from './acceso.entity';
import type { PermisoCatalogo } from '../../perfiles/catalogo-sumarios';

export type EstadoAplicacion = 'activa' | 'proximamente';

// Quién la ve:
//  - por_acceso: quien tenga una fila en Acceso para esta aplicación
//    (las aplicaciones "proximamente" las ve todo el mundo, como vitrina).
//  - admin: Superadmin y Admin del portal.
//  - superadmin: solo Superadmin.
export type VisibilidadAplicacion = 'por_acceso' | 'admin' | 'superadmin';

// La "ficha" que cada aplicación integrada entrega al portal (contrato de
// integración): su catálogo de permisos, si su alcance es por SLEP y qué
// opciones individuales existen. Sus PERFILES viven en la tabla
// perfiles_aplicacion (se administran en Configuración → Perfiles).
export interface OpcionManifiesto {
  clave: string; // hoy solo "cargar_datos", regida por la carga de cada perfil
  etiqueta: string;
  descripcion: string;
}
export interface Manifiesto {
  permisos: PermisoCatalogo[];
  // slep: uno o más SLEP · slep_uno: un solo SLEP (o todos) · ninguno
  alcance: 'slep' | 'slep_uno' | 'ninguno';
  opciones: OpcionManifiesto[];
}

@Entity('aplicaciones')
export class Aplicacion {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id: string;

  @Column({ name: 'modulo_id', type: 'varchar', length: 40 })
  moduloId: string;

  @ManyToOne(() => Modulo, (m) => m.aplicaciones)
  @JoinColumn({ name: 'modulo_id' })
  modulo: Modulo;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  // Dirección a la que lleva la tarjeta. Vacía mientras esté "proximamente".
  @Column({ type: 'varchar', length: 300, nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 20 })
  estado: EstadoAplicacion;

  @Column({ type: 'varchar', length: 20, default: 'por_acceso' })
  visibilidad: VisibilidadAplicacion;

  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'json', nullable: true })
  manifiesto: Manifiesto | null;

  // Palabras con que el Asistente Virtual encuentra la aplicación (vienen del
  // catálogo único, catalogo/catalogo-general.json).
  @Column({ name: 'palabras_clave', type: 'json', nullable: true })
  palabrasClave: string[] | null;

  // Dirección del SERVIDOR de la aplicación integrada, para avisarle al
  // instante cuando una persona cambia o se desactiva.
  @Column({ name: 'url_integracion', type: 'varchar', length: 300, nullable: true })
  urlIntegracion: string | null;

  @OneToMany(() => Acceso, (a) => a.aplicacion)
  accesos: Acceso[];
}
