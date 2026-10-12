import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Busqueda, ResultadoBusqueda } from './entities/busqueda.entity';

// Cuántas búsquedas se guardan por persona (las más antiguas se borran).
const MAXIMO_POR_PERSONA = 50;

export interface BusquedaVista {
  id: string;
  texto: string;
  aplicacionId: string | null;
  resultado: ResultadoBusqueda;
  creadoEn: Date;
}

@Injectable()
export class BusquedasService {
  constructor(@InjectRepository(Busqueda) private readonly busquedas: Repository<Busqueda>) {}

  // Las más recientes primero.
  async historial(usuarioId: string, limite = 20): Promise<BusquedaVista[]> {
    const filas = await this.busquedas.find({ where: { usuarioId }, order: { creadoEn: 'DESC' }, take: limite });
    return filas.map(({ id, texto, aplicacionId, resultado, creadoEn }) => ({ id, texto, aplicacionId, resultado, creadoEn }));
  }

  async registrar(usuarioId: string, texto: string, aplicacionId: string | null, resultado: ResultadoBusqueda): Promise<BusquedaVista> {
    const fila = await this.busquedas.save(this.busquedas.create({ usuarioId, texto: texto.trim(), aplicacionId, resultado, creadoEn: new Date() }));
    // Se conserva solo lo reciente: no hace falta guardar todo para siempre.
    const viejas = await this.busquedas.find({ where: { usuarioId }, order: { creadoEn: 'DESC' }, skip: MAXIMO_POR_PERSONA, select: { id: true } });
    if (viejas.length) await this.busquedas.delete(viejas.map((v) => v.id));
    return { id: fila.id, texto: fila.texto, aplicacionId, resultado, creadoEn: fila.creadoEn };
  }

  async borrar(usuarioId: string): Promise<{ borradas: number }> {
    const r = await this.busquedas.delete({ usuarioId });
    return { borradas: r.affected ?? 0 };
  }
}
