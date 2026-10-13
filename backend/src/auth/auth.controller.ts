import { BitacoraService } from '../bitacora/bitacora.service';
import { Body, Controller, Get, HttpCode, Ip, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsOptional, Matches } from 'class-validator';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginDto } from './auth.dto';
import { AuthService, FONDO_VALIDO, usuarioPublico } from './auth.service';

// Configuración → Vista. fondo null = el fondo institucional.
class VistaDto {
  @IsOptional() @Matches(FONDO_VALIDO)
  fondo?: string | null;
}
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioActual } from './usuario-actual.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly bitacora: BitacoraService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  // Preferencias de vista de la persona con sesión (hoy: su fondo de pantalla).
  // Cualquier persona puede cambiar las suyas, y solo las suyas.
  @UseGuards(JwtAuthGuard)
  @Patch('vista')
  async vista(@UsuarioActual() usuario: Usuario, @Body() dto: VistaDto) {
    await this.usuarios.update({ id: usuario.id }, { fondo: dto.fondo ?? null });
    return { fondo: dto.fondo ?? null };
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.usuario, dto.contrasena, ip);
  }

  // Salida del portal: la sesión la borra el navegador; esto solo la deja
  // registrada en la Bitácora.
  @UseGuards(JwtAuthGuard)
  @Post('salir')
  @HttpCode(200)
  async salir(@UsuarioActual() usuario: Usuario, @Ip() ip: string) {
    await this.bitacora.registrar(usuario, 'sesion_cerrada', 'Cerró sesión en el portal.', null, ip);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@UsuarioActual() usuario: Usuario) {
    return usuarioPublico(usuario);
  }
}
