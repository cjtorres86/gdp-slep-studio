import { Body, Controller, Get, Headers, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdministradorGuard } from '../administracion/administrador.guard';
import { BitacoraService, FiltrosBitacora, RegistroDeAplicacion } from './bitacora.service';

// Configuración → Bitácora: Admin y Superadmin ven TODO (incluidas las
// acciones del Superadmin). Solo lectura: no hay rutas para editar ni borrar.
@Controller()
export class BitacoraController {
  constructor(private readonly servicio: BitacoraService) {}

  @UseGuards(JwtAuthGuard, AdministradorGuard)
  @Get('admin/bitacora')
  buscar(@Query() q: FiltrosBitacora & { pagina?: string; porPagina?: string }) {
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const porPagina = Math.min(200, Math.max(10, Number(q.porPagina) || 50));
    return this.servicio.buscar(q, pagina, porPagina);
  }

  @UseGuards(JwtAuthGuard, AdministradorGuard)
  @Get('admin/bitacora/opciones')
  opciones() {
    return this.servicio.opciones();
  }

  @UseGuards(JwtAuthGuard, AdministradorGuard)
  @Get('admin/bitacora/excel')
  async excel(@Query() q: FiltrosBitacora, @Res() res: Response) {
    const { archivo, truncado } = await this.servicio.excel(q);
    const hoy = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bitacora-${hoy}.xlsx"`);
    res.setHeader('X-Bitacora-Truncado', truncado ? 'si' : 'no');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Bitacora-Truncado');
    res.send(archivo);
  }

  // De servidor a servidor: una aplicación integrada entrega sus registros.
  @Post('integracion/bitacora')
  @HttpCode(200)
  recibir(@Headers('x-clave-aplicacion') clave: string | undefined, @Body() cuerpo: { aplicacionId: string; registros: RegistroDeAplicacion[] }) {
    return this.servicio.recibirDeAplicacion(cuerpo?.aplicacionId, clave, cuerpo?.registros ?? []);
  }
}
