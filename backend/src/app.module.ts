import { BitacoraModule } from './bitacora/bitacora.module';
import { AsistenteModule } from './asistente/asistente.module';
import { PerfilesModule } from './perfiles/perfiles.module';
import { IngresoUnicoModule } from './ingreso-unico/ingreso-unico.module';
import { AdministracionModule } from './administracion/administracion.module';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { dataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    CatalogoModule,
    AdministracionModule,
    IngresoUnicoModule,
    PerfilesModule,
    BitacoraModule,
    AsistenteModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
