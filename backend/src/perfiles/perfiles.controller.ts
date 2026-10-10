import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { AdministradorGuard } from '../administracion/administrador.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CrearPerfilDto, EditarPerfilDto } from './perfiles.dto';
import { PerfilesService } from './perfiles.service';
import { SoloSuperadminGuard } from './solo-superadmin.guard';

// Configuración → Perfiles. Admin y Superadmin los VEN; solo el Superadmin
// los crea, edita o elimina (lo verifica PerfilesService).
@UseGuards(JwtAuthGuard, AdministradorGuard)
@Controller('admin/perfiles')
export class PerfilesController {
  constructor(private readonly servicio: PerfilesService) {}

  @Get()
  listar(@UsuarioActual() editor: Usuario) {
    return this.servicio.listar(editor);
  }

  @UseGuards(SoloSuperadminGuard)
  @Post()
  crear(@UsuarioActual() editor: Usuario, @Body() dto: CrearPerfilDto) {
    return this.servicio.crear(editor, dto);
  }

  @UseGuards(SoloSuperadminGuard)
  @Patch(':id')
  editar(@UsuarioActual() editor: Usuario, @Param('id') id: string, @Body() dto: EditarPerfilDto) {
    return this.servicio.editar(editor, id, dto);
  }

  @UseGuards(SoloSuperadminGuard)
  @Delete(':id')
  eliminar(@UsuarioActual() editor: Usuario, @Param('id') id: string) {
    return this.servicio.eliminar(editor, id);
  }
}
