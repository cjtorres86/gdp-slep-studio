import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Se vuelve a leer a la persona en CADA petición (no se confía solo en
  // lo que dice el token): así, desactivar una cuenta la bloquea al
  // instante, sin esperar a que venza su sesión.
  async validate(payload: { sub: string }): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo) throw new UnauthorizedException('Sesión no válida.');
    return usuario;
  }
}
