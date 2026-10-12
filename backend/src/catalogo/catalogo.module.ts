import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Acceso } from './entities/acceso.entity';
import { Aplicacion } from './entities/aplicacion.entity';
import { Busqueda } from './entities/busqueda.entity';
import { Modulo } from './entities/modulo.entity';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { BusquedasService } from './busquedas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Modulo, Aplicacion, Acceso, Busqueda]), AuthModule],
  controllers: [CatalogoController],
  providers: [CatalogoService, BusquedasService],
})
export class CatalogoModule {}
