import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { InformesService } from './informes.service';

// Respuestas a las preguntas del asistente. Sin mes = "todos los meses";
// sin SLEP = "todos los SLEP".
class AbrirInformeDto {
  @IsOptional() @IsString() @MaxLength(20)
  mes?: string;

  @IsOptional() @IsString() @MaxLength(4)
  anio?: string;

  @IsOptional() @IsString() @MaxLength(60)
  slep?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('portal/informes')
export class AsistenteController {
  constructor(private readonly informes: InformesService) {}

  @Get()
  listar(@UsuarioActual() usuario: Usuario) {
    return this.informes.informesDe(usuario);
  }

  @Get('opciones')
  opciones(@Query('aplicacionId') aplicacionId: string) {
    return this.informes.opciones(aplicacionId);
  }

  @Post(':id/abrir')
  abrir(@UsuarioActual() usuario: Usuario, @Param('id') id: string, @Body() dto: AbrirInformeDto) {
    return this.informes.abrir(usuario, id, {
      mes: dto.mes && dto.anio ? { mes: dto.mes, anio: dto.anio } : 'todos',
      slep: dto.slep || 'todos',
    });
  }
}
