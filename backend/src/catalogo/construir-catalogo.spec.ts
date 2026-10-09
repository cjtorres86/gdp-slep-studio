import { construirCatalogo } from './construir-catalogo';
import { Acceso } from './entities/acceso.entity';
import { Aplicacion } from './entities/aplicacion.entity';
import { Modulo } from './entities/modulo.entity';

const modulos = [
  { id: 'gestor', nombre: 'Gestor de Formularios', icono: 'formularios', color: '#1f84ec', orden: 1 },
  { id: 'auto', nombre: 'Automatización de Procesos', icono: 'automatizacion', color: '#90d039', orden: 2 },
  { id: 'config', nombre: 'Configuración', icono: 'configuracion', color: '#25306B', orden: 3 },
] as Modulo[];

const apps = [
  { id: 'sumarios', moduloId: 'gestor', nombre: 'Reporte Avance de Sumarios', descripcion: '', url: 'https://sumarios.example', estado: 'activa', visibilidad: 'por_acceso', orden: 1 },
  { id: 'circular30', moduloId: 'gestor', nombre: 'Reporte Circular 30', descripcion: '', url: null, estado: 'proximamente', visibilidad: 'por_acceso', orden: 2 },
  { id: 'licencias', moduloId: 'auto', nombre: 'Licencias Médicas', descripcion: '', url: null, estado: 'proximamente', visibilidad: 'por_acceso', orden: 1 },
  { id: 'usuarios', moduloId: 'config', nombre: 'Usuarios y accesos', descripcion: '', url: null, estado: 'proximamente', visibilidad: 'admin', orden: 1 },
  { id: 'bitacora', moduloId: 'config', nombre: 'Bitácora', descripcion: '', url: null, estado: 'proximamente', visibilidad: 'superadmin', orden: 2 },
] as Aplicacion[];

const acceso = (aplicacionId: string, rol: string, alcance: string[]) => ({ usuarioId: 'u1', aplicacionId, rol, alcance }) as Acceso;
const ids = (r: ReturnType<typeof construirCatalogo>) => r.map((m) => `${m.id}:${m.aplicaciones.map((a) => a.id).join(',')}`);

describe('construirCatalogo', () => {
  it('una persona con acceso a Sumarios ve la app activa con su rol y alcance, más la vitrina de "próximamente"', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', [acceso('sumarios', 'Digitador', ['Barrancas'])]);
    expect(ids(r)).toEqual(['gestor:sumarios,circular30', 'auto:licencias']);
    const sumarios = r[0].aplicaciones[0];
    expect(sumarios.rol).toBe('Digitador');
    expect(sumarios.alcance).toEqual(['Barrancas']);
    expect(sumarios.url).toBe('https://sumarios.example');
  });

  it('una persona SIN acceso a Sumarios no ve esa tarjeta (pero sí la vitrina de próximamente)', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', []);
    expect(ids(r)).toEqual(['gestor:circular30', 'auto:licencias']);
  });

  it('las aplicaciones "próximamente" no llevan dirección (no se puede entrar)', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', []);
    expect(r.flatMap((m) => m.aplicaciones).every((a) => a.url === null)).toBe(true);
  });

  it('un usuario común NO ve el módulo Configuración (desaparece entero)', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', [acceso('sumarios', 'Validador', ['todos'])]);
    expect(r.map((m) => m.id)).not.toContain('config');
  });

  it('Admin ve Configuración, pero solo "Usuarios y accesos" (no Bitácora)', () => {
    const r = construirCatalogo(modulos, apps, 'admin', [acceso('sumarios', 'Admin', ['todos'])]);
    expect(ids(r).find((x) => x.startsWith('config'))).toBe('config:usuarios');
  });

  it('Superadmin ve todo, incluida la Bitácora, y entra a las aplicaciones activas aunque no tenga fila de acceso', () => {
    const r = construirCatalogo(modulos, apps, 'superadmin', []);
    expect(ids(r)).toEqual(['gestor:sumarios,circular30', 'auto:licencias', 'config:usuarios,bitacora']);
    expect(r[0].aplicaciones[0].rol).toBe('Superadmin');
  });

  it('respeta el orden definido (módulos y aplicaciones)', () => {
    const desordenadas = [...apps].reverse();
    const r = construirCatalogo([...modulos].reverse(), desordenadas, 'superadmin', []);
    expect(r.map((m) => m.id)).toEqual(['gestor', 'auto', 'config']);
    expect(r[0].aplicaciones.map((a) => a.id)).toEqual(['sumarios', 'circular30']);
  });

  it('una persona con acceso a varios SLEP los conserva como lista', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', [acceso('sumarios', 'Digitador', ['Barrancas', 'Los Álamos'])]);
    expect(r[0].aplicaciones[0].alcance).toEqual(['Barrancas', 'Los Álamos']);
  });
});

describe('construirCatalogo — módulo Documentación (solo Admin y Superadmin)', () => {
  const mods = [
    ...modulos.filter((m) => m.id !== 'config'),
    { id: 'docs', nombre: 'Documentación', icono: 'documentacion', color: '#3abff0', orden: 3 },
    { id: 'config', nombre: 'Configuración', icono: 'configuracion', color: '#25306B', orden: 4 },
  ] as Modulo[];
  const conDocs = [
    ...apps,
    { id: 'doc_proyecto', moduloId: 'docs', nombre: 'Documentación del Proyecto', descripcion: '', url: 'https://proyecto.example', estado: 'activa', visibilidad: 'admin', orden: 1 },
    { id: 'doc_marco_legal', moduloId: 'docs', nombre: 'Documentación Marco Legal', descripcion: '', url: 'https://marco.example', estado: 'activa', visibilidad: 'admin', orden: 2 },
  ] as Aplicacion[];

  it('una persona normal (ej.: un SLEP) no ve el módulo, ni siquiera como "próximamente"', () => {
    const r = construirCatalogo(mods, conDocs, 'usuario', [acceso('sumarios', 'Digitador', ['Barrancas'])]);
    expect(r.map((m) => m.id)).not.toContain('docs');
  });

  it('un Admin lo ve con sus dos accesos, con dirección, entre Automatización y Configuración', () => {
    const r = construirCatalogo(mods, conDocs, 'admin', []);
    expect(r.map((m) => m.id)).toEqual(['gestor', 'auto', 'docs', 'config']);
    const docs = r.find((m) => m.id === 'docs')!;
    expect(docs.aplicaciones.map((a) => [a.id, a.url])).toEqual([
      ['doc_proyecto', 'https://proyecto.example'],
      ['doc_marco_legal', 'https://marco.example'],
    ]);
  });

  it('el Superadmin también lo ve', () => {
    const r = construirCatalogo(mods, conDocs, 'superadmin', []);
    expect(r.find((m) => m.id === 'docs')!.aplicaciones).toHaveLength(2);
  });
});
