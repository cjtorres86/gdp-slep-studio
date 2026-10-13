import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
import { Slep } from '../administracion/slep.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { IngresoUnicoService } from '../ingreso-unico/ingreso-unico.service';
import { variableClave } from '../ingreso-unico/identidad';
import { Informe } from './informe.entity';
import { InformeVista, RespuestaInvalida, RespuestasInforme, construirDestino, informeAutorizado, slepsDe } from './reglas-informes';

// Cuánto se recuerda la lista de meses de cada aplicación (no cambia seguido).
const VIGENCIA_MESES_MS = 60_000;

@Injectable()
export class InformesService {
  private readonly log = new Logger('Informes');
  private readonly cacheMeses = new Map<string, { hasta: number; meses: { mes: string; anio: string }[] }>();

  constructor(
    @InjectRepository(Informe) private readonly informes: Repository<Informe>,
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
    @InjectRepository(Acceso) private readonly accesos: Repository<Acceso>,
    @InjectRepository(PerfilAplicacion) private readonly perfiles: Repository<PerfilAplicacion>,
    @InjectRepository(Slep) private readonly sleps: Repository<Slep>,
    private readonly ingresoUnico: IngresoUnicoService,
  ) {}

  // Todos los informes, para todos (igual que el catálogo): cada uno dice si
  // la persona puede abrirlo.
  async informesDe(usuario: Usuario): Promise<InformeVista[]> {
    const [informes, accesos, perfiles, apps] = await Promise.all([
      this.informes.find({ order: { orden: 'ASC' } }),
      this.accesos.find({ where: { usuarioId: usuario.id } }),
      this.perfiles.find(),
      this.aplicaciones.find(),
    ]);
    const activas = new Set(apps.filter((a) => a.estado === 'activa').map((a) => a.id));
    return informes
      .filter((i) => activas.has(i.aplicacionId))
      .map((i) => {
        const acceso = accesos.find((a) => a.aplicacionId === i.aplicacionId);
        return {
          id: i.id,
          aplicacionId: i.aplicacionId,
          nombre: i.nombre,
          descripcion: i.descripcion,
          formato: i.formato,
          categoria: i.categoria,
          estado: i.estado,
          palabrasClave: i.palabrasClave,
          preguntas: i.preguntas,
          autorizado: informeAutorizado(i, usuario.rolPortal, acceso, perfiles),
          sleps: slepsDe(usuario.rolPortal, acceso),
        };
      });
  }

  // Opciones para las preguntas: los SLEP salen del portal; los meses, de la
  // propia aplicación (de servidor a servidor).
  async opciones(aplicacionId: string): Promise<{ meses: { mes: string; anio: string }[]; sleps: string[] }> {
    const sleps = (await this.sleps.find({ order: { orden: 'ASC', nombre: 'ASC' } })).map((s) => s.nombre);
    return { meses: await this.mesesDe(aplicacionId), sleps };
  }

  private async mesesDe(aplicacionId: string): Promise<{ mes: string; anio: string }[]> {
    const guardado = this.cacheMeses.get(aplicacionId);
    if (guardado && guardado.hasta > Date.now()) return guardado.meses;
    const app = await this.aplicaciones.findOne({ where: { id: aplicacionId } });
    const clave = process.env[variableClave(aplicacionId)];
    if (!app?.urlIntegracion || !clave) return [];
    try {
      const r = await fetch(`${app.urlIntegracion.replace(/\/$/, '')}/integracion/meses`, {
        headers: { 'x-clave-portal': clave },
        signal: AbortSignal.timeout(60000), // la aplicación puede estar despertando (Render)
      });
      if (!r.ok) throw new Error(`respondió ${r.status}`);
      const meses = ((await r.json()) as { mes: string; anio: string }[]).map(({ mes, anio }) => ({ mes, anio }));
      this.cacheMeses.set(aplicacionId, { hasta: Date.now() + VIGENCIA_MESES_MS, meses });
      return meses;
    } catch (e) {
      this.log.warn(`No se pudieron pedir los meses a ${aplicacionId}: ${(e as Error).message}`);
      return [];
    }
  }

  // Abre un informe: arma la página con las respuestas y pide el pase de
  // ingreso único que lleva directo a ella.
  async abrir(usuario: Usuario, informeId: string, respuestas: RespuestasInforme): Promise<{ url: string }> {
    const informe = await this.informes.findOne({ where: { id: informeId } });
    if (!informe) throw new NotFoundException('Ese informe no existe.');
    if (informe.estado !== 'activa') throw new NotFoundException(`${informe.nombre} estará disponible pronto.`);
    const [acceso, perfiles, sleps] = await Promise.all([
      this.accesos.findOne({ where: { usuarioId: usuario.id, aplicacionId: informe.aplicacionId } }),
      this.perfiles.find({ where: { aplicacionId: informe.aplicacionId } }),
      this.sleps.find(),
    ]);
    if (!informeAutorizado(informe, usuario.rolPortal, acceso ?? undefined, perfiles)) {
      throw new ForbiddenException('No tienes autorización para ver este informe.');
    }
    let ruta: string;
    try {
      ruta = construirDestino(informe, respuestas, slepsDe(usuario.rolPortal, acceso ?? undefined), sleps.map((s) => s.nombre));
    } catch (e) {
      if (e instanceof RespuestaInvalida) throw new BadRequestException(e.message);
      throw e;
    }
    return this.ingresoUnico.emitirPase(usuario, informe.aplicacionId, { ruta, descripcion: `"${informe.nombre}"` });
  }
}
