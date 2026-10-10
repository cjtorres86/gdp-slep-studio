import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { IngresoUnicoModule } from '../ingreso-unico/ingreso-unico.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PerfilAplicacion } from './perfil-aplicacion.entity';
import { PerfilesController } from './perfiles.controller';
import { PerfilesService } from './perfiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([PerfilAplicacion, Aplicacion, Acceso, Usuario]), IngresoUnicoModule],
  controllers: [PerfilesController],
  providers: [PerfilesService],
})
export class PerfilesModule {}
