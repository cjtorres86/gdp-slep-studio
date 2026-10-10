import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';
import { Slep } from './slep.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
import { IngresoUnicoModule } from '../ingreso-unico/ingreso-unico.module';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Aplicacion, Acceso, Slep, PerfilAplicacion]), IngresoUnicoModule],
  controllers: [AdministracionController],
  providers: [AdministracionService],
})
export class AdministracionModule {}
