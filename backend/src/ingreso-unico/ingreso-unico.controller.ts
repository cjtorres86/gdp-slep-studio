import { Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { IngresoUnicoService } from './ingreso-unico.service';

class PedirPaseDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  aplicacionId: string;
}

class CanjearDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  aplicacionId: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  pase: string;
}

@Controller('ingreso-unico')
export class IngresoUnicoController {
  constructor(private readonly servicio: IngresoUnicoService) {}

  // Desde el navegador, con sesión del portal.
  @UseGuards(JwtAuthGuard)
  @Post('pase')
  pedirPase(@UsuarioActual() persona: Usuario, @Body() dto: PedirPaseDto) {
    return this.servicio.emitirPase(persona, dto.aplicacionId);
  }

  // De servidor a servidor: la aplicación se identifica con su clave secreta.
  @Post('canjear')
  @HttpCode(200)
  canjear(@Headers('x-clave-aplicacion') clave: string | undefined, @Body() dto: CanjearDto) {
    return this.servicio.canjear(dto.aplicacionId, clave, dto.pase);
  }
}
