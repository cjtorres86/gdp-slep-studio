import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LoginDto } from './auth.dto';
import { AuthService, usuarioPublico } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioActual } from './usuario-actual.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.usuario, dto.contrasena);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@UsuarioActual() usuario: Usuario) {
    return usuarioPublico(usuario);
  }
}
