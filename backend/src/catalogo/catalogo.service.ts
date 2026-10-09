import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Acceso } from './entities/acceso.entity';
import { Aplicacion } from './entities/aplicacion.entity';
import { Modulo } from './entities/modulo.entity';
import { construirCatalogo, ModuloVista } from './construir-catalogo';

@Injectable()
export class CatalogoService {
  constructor(
    @InjectRepository(Modulo) private readonly modulos: Repository<Modulo>,
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
    @InjectRepository(Acceso) private readonly accesos: Repository<Acceso>,
  ) {}

  // 3 consultas en total, sin importar cuántas aplicaciones haya.
  async catalogoDe(usuario: Usuario): Promise<ModuloVista[]> {
    const [modulos, aplicaciones, accesos] = await Promise.all([
      this.modulos.find(),
      this.aplicaciones.find(),
      this.accesos.find({ where: { usuarioId: usuario.id } }),
    ]);
    return construirCatalogo(modulos, aplicaciones, usuario.rolPortal, accesos);
  }
}
