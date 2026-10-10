import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { esAdministrador } from './reglas';

// Solo Admin y Superadmin del portal. Va DESPUÉS de JwtAuthGuard, que deja
// en la petición a la persona leída fresca de la base: si le quitan el rol
// de Admin con la sesión abierta, la siguiente petición ya se rechaza.
@Injectable()
export class AdministradorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const usuario = ctx.switchToHttp().getRequest().user as Usuario | undefined;
    if (!usuario || !esAdministrador(usuario.rolPortal)) {
      throw new ForbiddenException('Esta sección es solo para administradores del portal.');
    }
    return true;
  }
}
