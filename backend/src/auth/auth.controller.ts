import { BitacoraService } from '../bitacora/bitacora.service';
import { Body, Controller, Get, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginDto } from './auth.dto';
import { AuthService, usuarioPublico } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioActual } from './usuario-actual.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly bitacora: BitacoraService,
  ) {}

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
