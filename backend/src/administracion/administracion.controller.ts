import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CambiarEstadoDto, CrearPersonaDto, EditarPersonaDto } from './administracion.dto';
import { AdministradorGuard } from './administrador.guard';
import { AdministracionService } from './administracion.service';

// "Usuarios y accesos" (Configuración). Solo Admin y Superadmin del portal.
@UseGuards(JwtAuthGuard, AdministradorGuard)
@Controller('admin')
export class AdministracionController {
  constructor(private readonly servicio: AdministracionService) {}

  @Get('usuarios')
  listar() {
    return this.servicio.listar();
  }

  @Get('referencias')
  referencias(@UsuarioActual() editor: Usuario) {
    return this.servicio.referencias(editor);
  }

  @Post('usuarios')
  crear(@UsuarioActual() editor: Usuario, @Body() dto: CrearPersonaDto) {
    return this.servicio.crear(editor, dto);
  }

  @Patch('usuarios/:id')
  editar(@UsuarioActual() editor: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarPersonaDto) {
    return this.servicio.editar(editor, id, dto);
  }

  @Post('usuarios/:id/estado')
  cambiarEstado(@UsuarioActual() editor: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarEstadoDto) {
    return this.servicio.cambiarEstado(editor, id, dto.activo);
  }
}
