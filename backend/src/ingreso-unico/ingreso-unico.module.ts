import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { IngresoUnicoController } from './ingreso-unico.controller';
import { IngresoUnicoService } from './ingreso-unico.service';
import { NotificadorService } from './notificador.service';
import { PaseIngreso } from './pase-ingreso.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Aplicacion, Usuario, PaseIngreso, PerfilAplicacion])],
  controllers: [IngresoUnicoController],
  providers: [IngresoUnicoService, NotificadorService],
  exports: [NotificadorService, IngresoUnicoService],
})
export class IngresoUnicoModule {}
