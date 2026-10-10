import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { identidadPara, variableClave } from './identidad';

// Avisa AL INSTANTE a cada aplicación integrada cuando una persona cambia o
// se desactiva, para que su copia quede al día y el bloqueo sea inmediato
// (la aplicación revisa esa copia en cada petición).
//
// Si una aplicación no responde (ej. Render la tiene dormida), no se frena
// el guardado en el portal: queda anotado en el registro, y la aplicación
// igual recibe los datos frescos la próxima vez que la persona entre.
@Injectable()
export class NotificadorService {
  private readonly log = new Logger('Notificador');

  constructor(@InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>) {}

  async avisarCambio(persona: Usuario): Promise<void> {
    if (!persona.usuario) return; // cuenta pendiente: todavía no existe en ninguna aplicación
    const apps = await this.aplicaciones.find({ where: { urlIntegracion: Not(IsNull()), estado: 'activa' } });
    await Promise.all(
      apps.map(async (app) => {
        const clave = process.env[variableClave(app.id)];
        if (!clave || !app.manifiesto) return;
        try {
          const r = await fetch(`${app.urlIntegracion!.replace(/\/$/, '')}/integracion/personas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-clave-portal': clave },
            body: JSON.stringify(identidadPara(persona, app)),
            signal: AbortSignal.timeout(10000),
          });
          if (!r.ok) this.log.warn(`${app.id} respondió ${r.status} al avisar el cambio de "${persona.usuario}".`);
        } catch (e) {
          this.log.warn(`No se pudo avisar a ${app.id} el cambio de "${persona.usuario}": ${(e as Error).message}`);
        }
      }),
    );
  }
}
