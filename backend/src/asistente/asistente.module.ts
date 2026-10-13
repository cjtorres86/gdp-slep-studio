import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
import { Slep } from '../administracion/slep.entity';
import { IngresoUnicoModule } from '../ingreso-unico/ingreso-unico.module';
import { Informe } from './informe.entity';
import { InformesService } from './informes.service';
import { AsistenteController } from './asistente.controller';

// Asistente de la pantalla de inicio: los informes de las aplicaciones, con
// las preguntas que hace antes de abrir cada uno.
@Module({
  imports: [TypeOrmModule.forFeature([Informe, Aplicacion, Acceso, PerfilAplicacion, Slep]), AuthModule, IngresoUnicoModule],
  controllers: [AsistenteController],
  providers: [InformesService],
})
export class AsistenteModule {}
