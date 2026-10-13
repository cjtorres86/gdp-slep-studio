import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Modulo } from '../catalogo/entities/modulo.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
import { Slep } from '../administracion/slep.entity';
import { IngresoUnicoModule } from '../ingreso-unico/ingreso-unico.module';
import { Informe } from './informe.entity';
import { InformesService } from './informes.service';
import { AsistenteController } from './asistente.controller';
import { CatalogoGeneralService } from './catalogo-general.service';
import { IntegracionCatalogoController } from './integracion-catalogo.controller';

// Asistente Virtual de la pantalla de inicio: los informes de las
// aplicaciones, con las preguntas que hace antes de abrir cada uno. También
// mantiene el catálogo único (catalogo/catalogo-general.json) copiado en la
// base y se lo entrega a cada aplicación.
@Module({
  imports: [TypeOrmModule.forFeature([Informe, Aplicacion, Modulo, Acceso, PerfilAplicacion, Slep]), AuthModule, IngresoUnicoModule],
  controllers: [AsistenteController, IntegracionCatalogoController],
  providers: [InformesService, CatalogoGeneralService],
})
export class AsistenteModule {}
