import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID, createHash, timingSafeEqual } from 'crypto';
import * as ExcelJS from 'exceljs';
import { Brackets, Repository } from 'typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { variableClave } from '../ingreso-unico/identidad';
import { RolPortal, Usuario } from '../usuarios/entities/usuario.entity';
import { RegistroBitacora } from './registro-bitacora.entity';

const PERFIL_PORTAL: Record<RolPortal, string> = { superadmin: 'Superadmin', admin: 'Administrador', usuario: 'Usuario' };

export interface FiltrosBitacora {
  origen?: string;
  persona?: string;
  accion?: string;
  desde?: string; // ISO (inicio del día en Chile, lo calcula la pantalla)
  hasta?: string; // ISO (fin del día en Chile)
  q?: string;
}

// Registro que entrega una aplicación integrada (contrato de integración).
export interface RegistroDeAplicacion {
  origenId: string;
  creadoEn: string;
  personaPortalId?: string | null;
  personaNombre: string;
  personaPerfil: string;
  accion: string;
  descripcion: string;
  detalle?: unknown;
  ip?: string | null;
}

const MAX_EXCEL = 50_000;

@Injectable()
export class BitacoraService {
  private readonly log = new Logger('Bitacora');

  constructor(
    @InjectRepository(RegistroBitacora) private readonly registros: Repository<RegistroBitacora>,
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
  ) {}

  // Registra algo que pasó en el portal. Nunca hace fallar la acción
  // principal: si no se pudo escribir, queda en el registro del servidor.
  async registrar(persona: Usuario | null, accion: string, descripcion: string, detalle?: unknown, ip?: string | null, personaSinCuenta?: string): Promise<void> {
    try {
      await this.registros.insert({
        id: randomUUID(),
        origen: 'portal',
        origenId: null,
        creadoEn: new Date(),
        personaPortalId: persona?.id ?? null,
        personaNombre: persona?.nombreParaMostrar ?? personaSinCuenta ?? '—',
        personaPerfil: persona ? PERFIL_PORTAL[persona.rolPortal] : '—',
        accion,
        descripcion,
        detalle: (detalle ?? null) as object,
        ip: ip ?? null,
      });
    } catch (e) {
      this.log.error(`No se pudo registrar "${accion}" en la Bitácora: ${(e as Error).message}`);
    }
  }

  // Lote que envía una aplicación integrada (de servidor a servidor, con su
  // clave). Si un registro ya había llegado, no se duplica. Devuelve los ids
  // de la aplicación que quedaron guardados, para que los marque como enviados.
  async recibirDeAplicacion(aplicacionId: string, claveRecibida: string | undefined, lote: RegistroDeAplicacion[]): Promise<{ recibidos: string[] }> {
    const app = await this.aplicaciones.findOne({ where: { id: aplicacionId } });
    const clave = process.env[variableClave(aplicacionId)];
    if (!app || !clave || !claveRecibida || !mismaClave(claveRecibida, clave)) throw new UnauthorizedException('Aplicación no autorizada.');
    const validos = (lote ?? []).filter((r) => r?.origenId && r.accion && r.creadoEn).slice(0, 500);
    if (!validos.length) return { recibidos: [] };
    await this.registros
      .createQueryBuilder()
      .insert()
      .orIgnore() // ya recibido antes: no se duplica
      .values(
        validos.map((r) => ({
          id: randomUUID(),
          origen: app.id,
          origenId: String(r.origenId).slice(0, 80),
          creadoEn: new Date(r.creadoEn),
          personaPortalId: r.personaPortalId ?? null,
          personaNombre: (r.personaNombre || '—').slice(0, 120),
          personaPerfil: (r.personaPerfil || '—').slice(0, 80),
          accion: r.accion.slice(0, 60),
          descripcion: r.descripcion ?? '',
          detalle: (r.detalle ?? null) as object,
          ip: r.ip ? String(r.ip).slice(0, 64) : null,
        })),
      )
      .execute();
    return { recibidos: validos.map((r) => String(r.origenId)) };
  }

  private consulta(f: FiltrosBitacora) {
    const qb = this.registros.createQueryBuilder('r');
    if (f.origen) qb.andWhere('r.origen = :origen', { origen: f.origen });
    if (f.persona) qb.andWhere('r.persona_nombre = :persona', { persona: f.persona });
    if (f.accion) qb.andWhere('r.accion = :accion', { accion: f.accion });
    if (f.desde) qb.andWhere('r.creado_en >= :desde', { desde: new Date(f.desde) });
    if (f.hasta) qb.andWhere('r.creado_en <= :hasta', { hasta: new Date(f.hasta) });
    if (f.q?.trim()) {
      const q = `%${f.q.trim()}%`;
      qb.andWhere(new Brackets((w) => w.where('r.descripcion LIKE :q', { q }).orWhere('r.persona_nombre LIKE :q', { q })));
    }
    return qb.orderBy('r.creado_en', 'DESC').addOrderBy('r.id', 'DESC');
  }

  async buscar(f: FiltrosBitacora, pagina = 1, porPagina = 50) {
    const [filas, total] = await this.consulta(f).skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    return { total, pagina, porPagina, filas };
  }

  // Lo que alimenta los filtros de la pantalla.
  async opciones() {
    const apps = await this.aplicaciones.find();
    const nombreApp = new Map(apps.map((a) => [a.id, a.nombre]));
    const origenes: { origen: string }[] = await this.registros.createQueryBuilder('r').select('DISTINCT r.origen', 'origen').getRawMany();
    const acciones: { accion: string }[] = await this.registros.createQueryBuilder('r').select('DISTINCT r.accion', 'accion').orderBy('accion').getRawMany();
    const personas: { persona: string }[] = await this.registros.createQueryBuilder('r').select('DISTINCT r.persona_nombre', 'persona').orderBy('persona').limit(1000).getRawMany();
    return {
      origenes: origenes.map((o) => ({ id: o.origen, nombre: o.origen === 'portal' ? 'Portal' : (nombreApp.get(o.origen) ?? o.origen) })),
      acciones: acciones.map((a) => a.accion),
      personas: personas.map((p) => p.persona),
    };
  }

  // Excel con lo que se ve filtrado (hasta 50.000 registros).
  async excel(f: FiltrosBitacora): Promise<{ archivo: Buffer; truncado: boolean }> {
    const filas = await this.consulta(f).take(MAX_EXCEL + 1).getMany();
    const truncado = filas.length > MAX_EXCEL;
    const apps = new Map((await this.aplicaciones.find()).map((a) => [a.id, a.nombre]));
    const fecha = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Bitácora');
    hoja.columns = [
      { header: 'Fecha y hora (Chile)', key: 'fecha', width: 22 },
      { header: 'Origen', key: 'origen', width: 28 },
      { header: 'Persona', key: 'persona', width: 26 },
      { header: 'Perfil', key: 'perfil', width: 18 },
      { header: 'Acción', key: 'accion', width: 24 },
      { header: 'Descripción', key: 'descripcion', width: 70 },
      { header: 'Detalle', key: 'detalle', width: 60 },
      { header: 'IP', key: 'ip', width: 16 },
    ];
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF25306B' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of filas.slice(0, MAX_EXCEL)) {
      hoja.addRow({
        fecha: fecha.format(r.creadoEn).replace(',', ''),
        origen: r.origen === 'portal' ? 'Portal' : (apps.get(r.origen) ?? r.origen),
        persona: r.personaNombre,
        perfil: r.personaPerfil,
        accion: r.accion,
        descripcion: r.descripcion,
        detalle: r.detalle ? JSON.stringify(r.detalle) : '',
        ip: r.ip ?? '',
      });
    }
    hoja.autoFilter = { from: 'A1', to: 'H1' };
    return { archivo: Buffer.from(await libro.xlsx.writeBuffer()), truncado };
  }
}

function mismaClave(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
