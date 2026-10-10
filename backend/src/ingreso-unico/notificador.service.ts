import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { identidadPara, perfilParaAplicacion, variableClave } from './identidad';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';

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

  constructor(
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
    @InjectRepository(PerfilAplicacion) private readonly perfiles: Repository<PerfilAplicacion>,
  ) {}

  // Avisa a la aplicación la lista COMPLETA de sus perfiles (al crear, editar
  // o eliminar uno): así quienes tienen ese perfil ven el cambio al instante.
  async avisarPerfiles(aplicacionId: string): Promise<void> {
    const app = await this.aplicaciones.findOne({ where: { id: aplicacionId } });
    const clave = process.env[variableClave(aplicacionId)];
    if (!app?.urlIntegracion || !app.manifiesto || !clave) return;
    const lista = (await this.perfiles.find({ where: { aplicacionId } })).map((p) => perfilParaAplicacion(p, app));
    await this.enviar(app, clave, '/integracion/perfiles', { perfiles: lista }, 'los perfiles');
  }

  private async enviar(app: Aplicacion, clave: string, ruta: string, cuerpo: unknown, que: string): Promise<void> {
    try {
      const r = await fetch(`${app.urlIntegracion!.replace(/\/$/, '')}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clave-portal': clave },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) this.log.warn(`${app.id} respondió ${r.status} al avisar ${que}.`);
    } catch (e) {
      this.log.warn(`No se pudo avisar a ${app.id} ${que}: ${(e as Error).message}`);
    }
  }

  async avisarCambio(persona: Usuario): Promise<void> {
    if (!persona.usuario) return; // cuenta pendiente: todavía no existe en ninguna aplicación
    const apps = await this.aplicaciones.find({ where: { urlIntegracion: Not(IsNull()), estado: 'activa' } });
    const perfiles = await this.perfiles.find();
    await Promise.all(
      apps.map(async (app) => {
        const clave = process.env[variableClave(app.id)];
        if (!clave || !app.manifiesto) return;
        await this.enviar(app, clave, '/integracion/personas', identidadPara(persona, app, perfiles), `el cambio de "${persona.usuario}"`);
      }),
    );
  }
}
