import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { BitacoraController } from './bitacora.controller';
import { BitacoraService } from './bitacora.service';
import { RegistroBitacora } from './registro-bitacora.entity';

// Global: el ingreso, las personas, los perfiles y el ingreso único
// registran en la Bitácora sin tener que importarla uno por uno.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RegistroBitacora, Aplicacion])],
  controllers: [BitacoraController],
  providers: [BitacoraService],
  exports: [BitacoraService],
})
export class BitacoraModule {}
