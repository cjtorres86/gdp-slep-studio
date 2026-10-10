import { BitacoraService } from '../bitacora/bitacora.service';
import { diferencias, listaDeCampos } from '../bitacora/diferencias';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { NotificadorService } from '../ingreso-unico/notificador.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { valorCarga } from '../administracion/reglas';
import { RestriccionesPerfil } from './catalogo-sumarios';
import { CrearPerfilDto, EditarPerfilDto } from './perfiles.dto';
import { PerfilAplicacion } from './perfil-aplicacion.entity';

const RESTRICCIONES_POR_DEFECTO: RestriccionesPerfil = { exigeSlep: false, carga: 'opcional_no', cargaSoloSuperadmin: false };

// "abc Déf" → "abc_def" (para el id de un perfil nuevo).
const slug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

@Injectable()
export class PerfilesService {
  constructor(
    @InjectRepository(PerfilAplicacion) private readonly perfiles: Repository<PerfilAplicacion>,
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
    @InjectRepository(Acceso) private readonly accesos: Repository<Acceso>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly notificador: NotificadorService,
    private readonly bitacora: BitacoraService,
  ) {}

  // Todo lo que muestra la pantalla Perfiles: cada aplicación integrada con
  // su catálogo de permisos y sus perfiles (y cuántas personas tiene cada uno).
  async listar(editor: Usuario) {
    const apps = (await this.aplicaciones.find({ order: { orden: 'ASC' } })).filter((a) => a.manifiesto && a.estado === 'activa' && a.visibilidad === 'por_acceso');
    const perfiles = await this.perfiles.find({ order: { orden: 'ASC', nombre: 'ASC' } });
    const conteo: { rol: string; total: string }[] = await this.accesos.createQueryBuilder('a').select('a.rol', 'rol').addSelect('COUNT(*)', 'total').groupBy('a.rol').getRawMany();
    const personas = new Map(conteo.map((c) => [c.rol, Number(c.total)]));
    return {
      puedeEditar: editor.rolPortal === 'superadmin',
      aplicaciones: apps.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        catalogo: a.manifiesto!.permisos,
        perfiles: perfiles.filter((p) => p.aplicacionId === a.id).map((p) => ({ ...p, personas: personas.get(p.id) ?? 0 })),
      })),
    };
  }

  async crear(editor: Usuario, dto: CrearPerfilDto) {
    this.exigirSuperadmin(editor);
    const app = await this.app(dto.aplicacionId);
    const nombre = dto.nombre.trim();
    await this.nombreLibre(app.id, nombre, null);
    let id = `perfil_${slug(nombre) || 'nuevo'}`;
    for (let n = 2; await this.perfiles.findOne({ where: { id } }); n++) id = `perfil_${slug(nombre)}_${n}`;
    const restricciones = dto.restricciones ?? RESTRICCIONES_POR_DEFECTO;
    const perfil = this.perfiles.create({
      id,
      aplicacionId: app.id,
      nombre,
      descripcion: dto.descripcion?.trim() ?? '',
      color: dto.color ?? '#64748B',
      permisos: this.validarPermisos(app, dto.permisos ?? [], restricciones),
      restricciones,
      orden: 50,
    });
    await this.perfiles.save(perfil);
    await this.bitacora.registrar(editor, 'perfil_creado', `Creó el perfil "${perfil.nombre}" en ${app.nombre}.`, { perfil });
    await this.notificador.avisarPerfiles(app.id);
    return perfil;
  }

  async editar(editor: Usuario, id: string, dto: EditarPerfilDto) {
    this.exigirSuperadmin(editor);
    const perfil = await this.buscar(id);
    const app = await this.app(perfil.aplicacionId);
    const antes = { ...perfil, permisos: [...perfil.permisos], restricciones: { ...perfil.restricciones } };
    if (dto.nombre !== undefined) {
      await this.nombreLibre(app.id, dto.nombre.trim(), perfil.id);
      perfil.nombre = dto.nombre.trim();
    }
    if (dto.descripcion !== undefined) perfil.descripcion = dto.descripcion.trim();
    if (dto.color !== undefined) perfil.color = dto.color;
    const cambiaCarga = !!dto.restricciones && dto.restricciones.carga !== perfil.restricciones.carga;
    if (dto.restricciones) perfil.restricciones = dto.restricciones;
    perfil.permisos = this.validarPermisos(app, dto.permisos ?? perfil.permisos, perfil.restricciones);
    await this.perfiles.save(perfil);
    const cambios = diferencias(antes as unknown as Record<string, unknown>, perfil as unknown as Record<string, unknown>, ['nombre', 'descripcion', 'color', 'permisos', 'restricciones']);
    if (Object.keys(cambios).length) {
      // Permisos: además de antes/después, cuáles se agregaron y cuáles se quitaron.
      const agregados = perfil.permisos.filter((k) => !antes.permisos.includes(k));
      const quitados = antes.permisos.filter((k) => !perfil.permisos.includes(k));
      await this.bitacora.registrar(editor, 'perfil_editado', `Editó el perfil "${perfil.nombre}" de ${app.nombre}: cambió ${listaDeCampos(Object.keys(cambios))}.`, { cambios, permisosAgregados: agregados, permisosQuitados: quitados });
    }

    // Si cambió la carga del perfil, "Puede cargar datos" de quienes lo
    // tienen se ajusta (ej. a "nunca" → todos quedan sin carga).
    const afectados = await this.usuarios.find({ where: { accesos: { rol: perfil.id } }, relations: { accesos: true } });
    if (cambiaCarga) {
      for (const u of afectados) {
        const acceso = u.accesos.find((a) => a.rol === perfil.id)!;
        const nuevo = valorCarga(perfil, { id: editor.id, rolPortal: 'superadmin' }, undefined, acceso.opciones?.['cargar_datos']);
        if (acceso.opciones?.['cargar_datos'] !== nuevo) {
          acceso.opciones = { ...(acceso.opciones ?? {}), cargar_datos: nuevo };
          await this.accesos.save(acceso);
        }
      }
    }
    // Primero la aplicación recibe los perfiles (nombre y permisos nuevos)...
    await this.notificador.avisarPerfiles(app.id);
    // ...y después, si cambió la carga, la carga de cada persona afectada.
    if (cambiaCarga) for (const u of afectados) await this.notificador.avisarCambio(await this.usuarios.findOneOrFail({ where: { id: u.id }, relations: { accesos: true } }));
    return { ...perfil, personas: afectados.length };
  }

  async eliminar(editor: Usuario, id: string) {
    this.exigirSuperadmin(editor);
    const perfil = await this.buscar(id);
    const enUso = await this.accesos.count({ where: { rol: perfil.id } });
    if (enUso) throw new ConflictException(`No se puede eliminar "${perfil.nombre}": lo tiene${enUso === 1 ? '' : 'n'} ${enUso} persona${enUso === 1 ? '' : 's'}. Cámbiales el perfil primero.`);
    await this.perfiles.delete({ id: perfil.id });
    await this.bitacora.registrar(editor, 'perfil_eliminado', `Eliminó el perfil "${perfil.nombre}".`, { perfil });
    await this.notificador.avisarPerfiles(perfil.aplicacionId);
    return { ok: true };
  }

  // ---------------------------------------------------------------------

  private exigirSuperadmin(editor: Usuario) {
    if (editor.rolPortal !== 'superadmin') throw new ForbiddenException('Solo el Superadmin puede modificar perfiles.');
  }

  private async app(id: string) {
    const app = await this.aplicaciones.findOne({ where: { id } });
    if (!app?.manifiesto) throw new NotFoundException('Esa aplicación no tiene perfiles administrables.');
    return app;
  }

  private async buscar(id: string) {
    const p = await this.perfiles.findOne({ where: { id } });
    if (!p) throw new NotFoundException('No existe ese perfil.');
    return p;
  }

  private async nombreLibre(aplicacionId: string, nombre: string, idActual: string | null) {
    const otro = await this.perfiles.findOne({ where: { aplicacionId, nombre } });
    if (otro && otro.id !== idActual) throw new ConflictException(`Ya existe un perfil llamado "${otro.nombre}".`);
  }

  // Solo permisos que la aplicación declara; respeta las dependencias
  // (ej. "Moderar mensajes" exige "Escribir mensajes", y "Cargar Excel" no
  // tiene sentido si el perfil nunca carga datos).
  private validarPermisos(app: Aplicacion, permisos: string[], r: RestriccionesPerfil): string[] {
    const catalogo = app.manifiesto!.permisos;
    const unicos = [...new Set(permisos)];
    for (const clave of unicos) {
      const def = catalogo.find((c) => c.clave === clave);
      if (!def) throw new BadRequestException(`"${clave}" no es un permiso de ${app.nombre}.`);
      const falta = def.requiere?.find((x) => !unicos.includes(x));
      if (falta) throw new BadRequestException(`"${def.etiqueta}" exige también "${catalogo.find((c) => c.clave === falta)?.etiqueta ?? falta}".`);
      if (def.requiereCarga && r.carga === 'nunca') throw new BadRequestException(`"${def.etiqueta}" no tiene sentido en un perfil que nunca carga datos.`);
    }
    return catalogo.map((c) => c.clave).filter((c) => unicos.includes(c)); // en el orden del catálogo
  }
}
