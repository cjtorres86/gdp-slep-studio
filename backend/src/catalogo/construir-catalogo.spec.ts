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
  { id: 'usuarios', moduloId: 'config', nombre: 'Usuarios y accesos', descripcion: '', url: '/configuracion/usuarios', estado: 'activa', visibilidad: 'admin', orden: 1 },
  { id: 'bitacora', moduloId: 'config', nombre: 'Bitácora', descripcion: '', url: '/configuracion/bitacora', estado: 'activa', visibilidad: 'superadmin', orden: 2 },
] as Aplicacion[];

const acceso = (aplicacionId: string, rol: string, alcance: string[]) => ({ usuarioId: 'u1', aplicacionId, rol, alcance }) as Acceso;
const ids = (r: ReturnType<typeof construirCatalogo>) => r.map((m) => `${m.id}:${m.aplicaciones.map((a) => a.id).join(',')}`);
const app = (r: ReturnType<typeof construirCatalogo>, id: string) => r.flatMap((m) => m.aplicaciones).find((a) => a.id === id)!;
const TODO = ['gestor:sumarios,circular30', 'auto:licencias', 'config:usuarios,bitacora'];

describe('construirCatalogo', () => {
  it('todas las personas ven todo el catálogo, sin importar su perfil', () => {
    expect(ids(construirCatalogo(modulos, apps, 'usuario', []))).toEqual(TODO);
    expect(ids(construirCatalogo(modulos, apps, 'admin', []))).toEqual(TODO);
    expect(ids(construirCatalogo(modulos, apps, 'superadmin', []))).toEqual(TODO);
  });

  it('una persona con acceso a Sumarios entra, con su rol, alcance y dirección', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', [acceso('sumarios', 'Digitador', ['Barrancas'])]);
    const s = app(r, 'sumarios');
    expect(s.autorizado).toBe(true);
    expect(s.rol).toBe('Digitador');
    expect(s.alcance).toEqual(['Barrancas']);
    expect(s.url).toBe('https://sumarios.example');
  });

  it('una persona SIN acceso ve Sumarios, pero no autorizado y sin dirección', () => {
    const s = app(construirCatalogo(modulos, apps, 'usuario', []), 'sumarios');
    expect(s.autorizado).toBe(false);
    expect(s.url).toBeNull();
    expect(s.rol).toBeNull();
  });

  it('las aplicaciones "próximamente" no llevan dirección (no se puede entrar)', () => {
    const r = construirCatalogo(modulos, apps, 'superadmin', []);
    expect([app(r, 'circular30').url, app(r, 'licencias').url]).toEqual([null, null]);
  });

  it('un usuario común ve Configuración, pero sin autorización en ninguna opción', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', [acceso('sumarios', 'Validador', ['todos'])]);
    expect([app(r, 'usuarios').autorizado, app(r, 'bitacora').autorizado]).toEqual([false, false]);
    expect(app(r, 'usuarios').url).toBeNull();
  });

  it('Admin entra a "Usuarios y accesos", pero no a lo que es solo del Superadmin', () => {
    const r = construirCatalogo(modulos, apps, 'admin', []);
    expect(app(r, 'usuarios').autorizado).toBe(true);
    expect(app(r, 'bitacora').autorizado).toBe(false);
  });

  it('Superadmin entra a todo lo activo aunque no tenga fila de acceso', () => {
    const r = construirCatalogo(modulos, apps, 'superadmin', []);
    expect(app(r, 'sumarios').autorizado).toBe(true);
    expect(app(r, 'sumarios').rol).toBe('Superadmin');
    expect(app(r, 'bitacora').autorizado).toBe(true);
  });

  it('respeta el orden definido (módulos y aplicaciones)', () => {
    const r = construirCatalogo([...modulos].reverse(), [...apps].reverse(), 'superadmin', []);
    expect(r.map((m) => m.id)).toEqual(['gestor', 'auto', 'config']);
    expect(r[0].aplicaciones.map((a) => a.id)).toEqual(['sumarios', 'circular30']);
  });

  it('una persona con acceso a varios SLEP los conserva como lista', () => {
    const r = construirCatalogo(modulos, apps, 'usuario', [acceso('sumarios', 'Digitador', ['Barrancas', 'Los Álamos'])]);
    expect(app(r, 'sumarios').alcance).toEqual(['Barrancas', 'Los Álamos']);
  });

  it('un módulo sin aplicaciones no se dibuja', () => {
    const r = construirCatalogo([...modulos, { id: 'vacio', nombre: 'Vacío', icono: '', color: '', orden: 9 } as Modulo], apps, 'superadmin', []);
    expect(r.map((m) => m.id)).not.toContain('vacio');
  });
});

describe('construirCatalogo — módulo Documentación', () => {
  const mods = [...modulos, { id: 'docs', nombre: 'Documentación', icono: 'documentacion', color: '#3abff0', orden: 3 }] as Modulo[];
  const conDocs = [
    ...apps,
    { id: 'doc_proyecto', moduloId: 'docs', nombre: 'Documentación del Proyecto', descripcion: '', url: 'https://proyecto.example', estado: 'activa', visibilidad: 'admin', orden: 1 },
  ] as Aplicacion[];

  it('una persona normal lo ve, pero sin autorización ni dirección', () => {
    const d = app(construirCatalogo(mods, conDocs, 'usuario', [acceso('sumarios', 'Digitador', ['Barrancas'])]), 'doc_proyecto');
    expect(d.autorizado).toBe(false);
    expect(d.url).toBeNull();
  });

  it('un Admin entra, con su dirección', () => {
    const d = app(construirCatalogo(mods, conDocs, 'admin', []), 'doc_proyecto');
    expect(d.autorizado).toBe(true);
    expect(d.url).toBe('https://proyecto.example');
  });
});
