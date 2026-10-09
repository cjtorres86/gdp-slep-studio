import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CatalogoService } from './catalogo.service';

@UseGuards(JwtAuthGuard)
@Controller('portal')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('catalogo')
  catalogoDeLaPersona(@UsuarioActual() usuario: Usuario) {
    return this.catalogo.catalogoDe(usuario);
  }
}
