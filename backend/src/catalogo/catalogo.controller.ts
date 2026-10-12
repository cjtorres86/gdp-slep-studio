import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CatalogoService } from './catalogo.service';
import { BusquedasService } from './busquedas.service';
import { RegistrarBusquedaDto } from './busquedas.dto';

@UseGuards(JwtAuthGuard)
@Controller('portal')
export class CatalogoController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly busquedas: BusquedasService,
  ) {}

  @Get('catalogo')
  catalogoDeLaPersona(@UsuarioActual() usuario: Usuario) {
    return this.catalogo.catalogoDe(usuario);
  }

  // Historial del asistente de la pantalla de inicio: siempre el de la
  // persona con sesión, nunca el de otra.
  @Get('busquedas')
  historial(@UsuarioActual() usuario: Usuario) {
    return this.busquedas.historial(usuario.id);
  }

  @Post('busquedas')
  registrar(@UsuarioActual() usuario: Usuario, @Body() dto: RegistrarBusquedaDto) {
    return this.busquedas.registrar(usuario.id, dto.texto, dto.aplicacionId ?? null, dto.resultado);
  }

  @Delete('busquedas')
  borrar(@UsuarioActual() usuario: Usuario) {
    return this.busquedas.borrar(usuario.id);
  }
}
