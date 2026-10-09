import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';

// Lo único que sale hacia el navegador. Nunca el hash de la contraseña.
export function usuarioPublico(u: Usuario) {
  return {
    id: u.id,
    usuario: u.usuario,
    nombreParaMostrar: u.nombreParaMostrar,
    rolPortal: u.rolPortal,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
  ) {}

  async login(usuario: string, contrasena: string) {
    const encontrado = await this.usuarios.findOne({ where: { usuario } });
    // Mismo mensaje para "no existe", "clave incorrecta", "cuenta pendiente"
    // y "cuenta desactivada": que el mensaje no le diga a un atacante cuál
    // de esos casos es.
    const rechazo = new UnauthorizedException('Usuario o contraseña incorrectos.');
    if (!encontrado || !encontrado.contrasenaHash || !encontrado.activo) {
      // Se hace igual una comparación falsa para que responder "no existe"
      // no sea notoriamente más rápido que responder "clave incorrecta".
      await bcrypt.compare(contrasena, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
      throw rechazo;
    }
    if (!(await bcrypt.compare(contrasena, encontrado.contrasenaHash))) throw rechazo;

    const accessToken = await this.jwt.signAsync({ sub: encontrado.id, rolPortal: encontrado.rolPortal });
    return { accessToken, usuario: usuarioPublico(encontrado) };
  }
}
