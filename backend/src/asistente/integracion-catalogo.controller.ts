import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { variableClave } from '../ingreso-unico/identidad';
import { CatalogoGeneralService } from './catalogo-general.service';

// De servidor a servidor: cada aplicación pide su parte del catálogo único
// (nombres, formatos, descripciones y orden de sus informes) para armar su
// propia ventana de descargas. Se identifica con su clave secreta, igual que
// al canjear un pase de ingreso.
@Controller('integracion')
export class IntegracionCatalogoController {
  constructor(private readonly catalogo: CatalogoGeneralService) {}

  @Get('catalogo')
  informes(@Query('aplicacionId') aplicacionId: string, @Headers('x-clave-aplicacion') clave: string | undefined) {
    const esperada = aplicacionId ? process.env[variableClave(aplicacionId)] : undefined;
    if (!esperada || !clave || !mismaClave(clave, esperada)) throw new UnauthorizedException('Aplicación no autorizada.');
    return this.catalogo.informesDeAplicacion(aplicacionId);
  }
}

// Comparación que tarda lo mismo acierte o no (no deja adivinar la clave midiendo tiempos).
function mismaClave(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
