import { BitacoraService } from '../bitacora/bitacora.service';
import { diferencias, listaDeCampos } from '../bitacora/diferencias';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { Acceso } from '../catalogo/entities/acceso.entity';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CrearPersonaDto, EditarPersonaDto } from './administracion.dto';
import { AccesoNormalizado, motivoRechazo, normalizarAccesos, normalizarRut } from './reglas';
import { Slep } from './slep.entity';
import { NotificadorService } from '../ingreso-unico/notificador.service';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';

// Lo que ve la pantalla "Usuarios y accesos" de cada persona. Nunca el hash.
function vistaPersona(u: Usuario) {
  return {
    id: u.id,
    usuario: u.usuario,
    nombreParaMostrar: u.nombreParaMostrar,
    rut: u.rut,
    rolPortal: u.rolPortal,
    activo: u.activo,
    // Sin usuario o sin clave todavía no puede entrar (cuenta pendiente).
    pendiente: !u.usuario || !u.contrasenaHash,
    creadoEn: u.creadoEn,
    accesos: (u.accesos ?? [])
      .map((a) => ({ aplicacionId: a.aplicacionId, rol: a.rol, alcance: a.alcance, opciones: a.opciones ?? {} }))
      .sort((x, y) => x.aplicacionId.localeCompare(y.aplicacionId)),
  };
}

@Injectable()
export class AdministracionService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Aplicacion) private readonly aplicaciones: Repository<Aplicacion>,
    @InjectRepository(Slep) private readonly sleps: Repository<Slep>,
    @InjectRepository(PerfilAplicacion) private readonly perfiles: Repository<PerfilAplicacion>,
    private readonly dataSource: DataSource,
    private readonly notificador: NotificadorService,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar() {
    const lista = await this.usuarios.find({ relations: { accesos: true }, order: { nombreParaMostrar: 'ASC' } });
    return lista.map(vistaPersona);
  }

  // Lo que la pantalla necesita para armar el formulario: las aplicaciones
  // que se pueden asignar (con su ficha) y la lista oficial de SLEP.
  async referencias(editor: Usuario) {
    const apps = await this.aplicaciones.find({ order: { orden: 'ASC' } });
    return {
      aplicaciones: apps
        .filter((a) => a.estado === 'activa' && a.visibilidad === 'por_acceso' && a.manifiesto)
        .map((a) => ({ id: a.id, nombre: a.nombre, manifiesto: a.manifiesto })),
      // Perfiles de cada aplicación (para elegirlos al dar un acceso).
      perfiles: (await this.perfiles.find({ order: { orden: 'ASC', nombre: 'ASC' } })).map((p) => ({
        id: p.id, aplicacionId: p.aplicacionId, nombre: p.nombre, color: p.color, restricciones: p.restricciones,
      })),
      sleps: (await this.sleps.find({ order: { orden: 'ASC' } })).map((s) => s.nombre),
      editor: { id: editor.id, rolPortal: editor.rolPortal },
    };
  }

  async crear(editor: Usuario, dto: CrearPersonaDto) {
    const rolPortal = dto.rolPortal ?? 'usuario';
    this.exigir(motivoRechazo(editor, null, { rolPortal }));
    const persona = this.usuarios.create({ nombreParaMostrar: dto.nombreParaMostrar.trim(), rolPortal, activo: true });
    await this.aplicarCampos(persona, dto);
    const creada = await this.guardarConAccesos(editor, persona, dto.accesos, []);
    await this.bitacora.registrar(editor, 'persona_creada', `Creó a "${creada.nombreParaMostrar}"${creada.usuario ? ` (usuario "${creada.usuario}")` : ''}.`, { persona: creada, conClave: !!dto.contrasena });
    return creada;
  }

  async editar(editor: Usuario, id: string, dto: EditarPersonaDto) {
    const persona = await this.buscar(id);
    this.exigir(motivoRechazo(editor, persona, { rolPortal: dto.rolPortal }));
    const antes = vistaPersona(persona);
    if (dto.nombreParaMostrar) persona.nombreParaMostrar = dto.nombreParaMostrar.trim();
    if (dto.rolPortal) persona.rolPortal = dto.rolPortal;
    await this.aplicarCampos(persona, dto);
    const actuales = (persona.accesos ?? []).map((a) => ({ aplicacionId: a.aplicacionId, rol: a.rol, alcance: a.alcance, opciones: a.opciones ?? {} }));
    const despues = await this.guardarConAccesos(editor, persona, dto.accesos, actuales);
    // Bitácora: solo lo que cambió (antes → después). De la clave, solo que se cambió.
    const cambios = diferencias(antes, despues, ['nombreParaMostrar', 'usuario', 'rut', 'rolPortal', 'accesos']);
    const campos = Object.keys(cambios).concat(dto.contrasena ? ['clave'] : []);
    if (campos.length) {
      await this.bitacora.registrar(editor, 'persona_editada', `Editó a "${despues.nombreParaMostrar}": cambió ${listaDeCampos(campos)}.`, { cambios, claveCambiada: !!dto.contrasena });
    }
    return despues;
  }

  async cambiarEstado(editor: Usuario, id: string, activo: boolean) {
    const persona = await this.buscar(id);
    this.exigir(motivoRechazo(editor, persona, { activo }));
    persona.activo = activo;
    await this.usuarios.save(persona);
    const actualizada = await this.buscar(id);
    await this.bitacora.registrar(editor, activo ? 'persona_activada' : 'persona_desactivada', `${activo ? 'Activó' : 'Desactivó'} a "${actualizada.nombreParaMostrar}".`, { personaId: actualizada.id });
    // Aviso inmediato a las aplicaciones integradas (sin hacer esperar al guardado).
    void this.notificador.avisarCambio(actualizada);
    return vistaPersona(actualizada);
  }

  // ---------------------------------------------------------------------

  private async buscar(id: string) {
    const persona = await this.usuarios.findOne({ where: { id }, relations: { accesos: true } });
    if (!persona) throw new NotFoundException('No existe esa persona.');
    return persona;
  }

  private exigir(motivo: string | null) {
    if (motivo) throw new ForbiddenException(motivo);
  }

  // Usuario, RUT y clave: comunes a crear y editar.
  private async aplicarCampos(persona: Usuario, dto: CrearPersonaDto | EditarPersonaDto) {
    if (dto.usuario !== undefined) {
      const usuario = dto.usuario.trim();
      // La comparación de la base no distingue mayúsculas ni tildes:
      // "los alamos" choca con "Los Álamos", igual que al ingresar.
      const otro = await this.usuarios.findOne({ where: { usuario } });
      if (otro && otro.id !== persona.id) throw new ConflictException(`Ya existe una cuenta con el usuario "${otro.usuario}".`);
      persona.usuario = usuario;
    }
    if (dto.rut !== undefined) {
      if (!dto.rut.trim()) {
        persona.rut = null;
      } else {
        const rut = normalizarRut(dto.rut);
        if (!rut) throw new BadRequestException('El RUT no es válido (revisa el dígito verificador).');
        const otro = await this.usuarios.findOne({ where: { rut } });
        if (otro && otro.id !== persona.id) throw new ConflictException(`Ese RUT ya está asignado a "${otro.nombreParaMostrar}".`);
        persona.rut = rut;
      }
    }
    if (dto.contrasena) persona.contrasenaHash = await bcrypt.hash(dto.contrasena, 10);
  }

  // Guarda la persona y, si vinieron, REEMPLAZA sus accesos — todo en una
  // sola transacción: o queda todo, o no queda nada.
  private async guardarConAccesos(editor: Usuario, persona: Usuario, pedidos: CrearPersonaDto['accesos'], actuales: AccesoNormalizado[]) {
    let accesos: AccesoNormalizado[] | null = null;
    // El Superadmin entra a todas las aplicaciones con todos los permisos:
    // sus accesos no se editan uno por uno.
    if (pedidos && persona.rolPortal !== 'superadmin') {
      const apps = new Map((await this.aplicaciones.find()).map((a) => [a.id, a]));
      const sleps = (await this.sleps.find({ order: { orden: 'ASC' } })).map((s) => s.nombre);
      const r = normalizarAccesos(editor, pedidos, actuales, apps, sleps, await this.perfiles.find());
      if ('error' in r) throw new BadRequestException(r.error);
      accesos = r.accesos;
    }
    const id = await this.dataSource.transaction(async (m) => {
      const { accesos: _sinAccesos, ...soloPersona } = persona;
      const guardada = await m.getRepository(Usuario).save(soloPersona);
      if (accesos) {
        await m.getRepository(Acceso).delete({ usuarioId: guardada.id });
        if (accesos.length) await m.getRepository(Acceso).save(accesos.map((a) => ({ ...a, usuarioId: guardada.id })));
      }
      return guardada.id;
    });
    const actualizada = await this.buscar(id);
    void this.notificador.avisarCambio(actualizada);
    return vistaPersona(actualizada);
  }
}
