import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Usuario } from '../usuarios/entities/usuario.entity';

// Crear, editar o eliminar perfiles: solo el Superadmin. Se revisa ANTES que
// los datos del formulario, para que un Admin reciba siempre el mensaje que
// corresponde ("solo el Superadmin…") y no un error de validación.
@Injectable()
export class SoloSuperadminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const usuario = ctx.switchToHttp().getRequest().user as Usuario | undefined;
    if (usuario?.rolPortal !== 'superadmin') throw new ForbiddenException('Solo el Superadmin puede modificar perfiles.');
    return true;
  }
}
