import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';
import { Slep } from './slep.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Aplicacion, Acceso, Slep])],
  controllers: [AdministracionController],
  providers: [AdministracionService],
})
export class AdministracionModule {}
