import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Identidad, identidadPara, variableClave } from './identidad';
import { PaseIngreso } from './pase-ingreso.entity';

const VIGENCIA_PASE_MS = 60_000;
const huella = (pase: string) => createHash('sha256').update(pase).digest('hex');

@Injectable()
export class IngresoUnicoService {
  constructor(
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(PaseIngreso) private readonly pases: Repository<PaseIngreso>,
    private readonly dataSource: DataSource,
  ) {}

  // La persona (con sesión en el portal) pide entrar a una aplicación: se le
  // entrega la dirección de la aplicación con un pase de un solo uso.
  async emitirPase(persona: Usuario, aplicacionId: string): Promise<{ url: string }> {
    const app = await this.aplicaciones.findOne({ where: { id: aplicacionId } });
    if (!app || app.estado !== 'activa' || !app.url || !app.manifiesto) throw new NotFoundException('Esa aplicación no admite ingreso desde el portal.');
    const conAccesos = await this.usuarios.findOne({ where: { id: persona.id }, relations: { accesos: true } });
    if (!conAccesos || !identidadPara(conAccesos, app).tieneAcceso) throw new ForbiddenException('No tienes acceso a esa aplicación.');

    const pase = randomBytes(32).toString('base64url');
    await this.pases.insert({ huella: huella(pase), usuarioId: persona.id, aplicacionId: app.id, venceEn: new Date(Date.now() + VIGENCIA_PASE_MS), usadoEn: null });
    // Limpieza de pases vencidos (no hace falta guardarlos).
    await this.pases.createQueryBuilder().delete().where('vence_en < :limite', { limite: new Date(Date.now() - 3600_000) }).execute();
    return { url: `${app.url.replace(/\/$/, '')}/sso?pase=${encodeURIComponent(pase)}` };
  }

  // La APLICACIÓN (de servidor a servidor, con su clave secreta) canjea el
  // pase y recibe quién es la persona. El pase queda gastado aunque algo
  // falle después: nunca sirve dos veces.
  async canjear(aplicacionId: string, claveRecibida: string | undefined, pase: string): Promise<Identidad> {
    const app = await this.aplicaciones.findOne({ where: { id: aplicacionId } });
    const claveEsperada = process.env[variableClave(aplicacionId)];
    if (!app || !claveEsperada || !claveRecibida || !mismaClave(claveRecibida, claveEsperada)) {
      throw new UnauthorizedException('Aplicación no autorizada.');
    }
    const rechazo = new UnauthorizedException('El pase no es válido o ya venció. Vuelve a entrar desde el portal.');
    const h = huella(pase ?? '');
    // Se marca como usado en la misma operación que lo verifica: si llegan
    // dos canjes a la vez con el mismo pase, solo uno gana.
    const r = await this.dataSource.query(
      'UPDATE `pases_ingreso` SET `usado_en` = NOW() WHERE `huella` = ? AND `aplicacion_id` = ? AND `usado_en` IS NULL AND `vence_en` > ?',
      [h, app.id, new Date()],
    );
    if ((r as { affectedRows?: number }).affectedRows !== 1) throw rechazo;
    const registro = await this.pases.findOne({ where: { huella: h } });
    const persona = registro ? await this.usuarios.findOne({ where: { id: registro.usuarioId }, relations: { accesos: true } }) : null;
    if (!persona || !persona.activo) throw rechazo;
    const identidad = identidadPara(persona, app);
    if (!identidad.tieneAcceso) throw new ForbiddenException('Esta persona ya no tiene acceso a la aplicación.');
    return identidad;
  }
}

// Comparación que tarda lo mismo acierte o no (no deja adivinar la clave
// midiendo tiempos).
function mismaClave(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
