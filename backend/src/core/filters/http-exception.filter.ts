import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

// Uniforma la forma de cualquier error de la API: el frontend siempre
// recibe { statusCode, message, path, timestamp } con "message" como TEXTO
// (nunca un objeto — ese fue el error de "[object Object]" que ya
// corregimos en Avance de Sumarios; acá nace bien hecho).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : exception);

    response.status(statusCode).json({
      statusCode,
      message: this.extraerMensaje(exception),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private extraerMensaje(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'Error interno del servidor.';
    const cuerpo = exception.getResponse();
    if (typeof cuerpo === 'string') return cuerpo;
    const interno = (cuerpo as { message?: unknown }).message;
    if (typeof interno === 'string') return interno;
    if (Array.isArray(interno)) return interno.join(' '); // errores de validación de un DTO
    return exception.message || 'Error inesperado.';
  }
}
