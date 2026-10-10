import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { AccesoNormalizado, motivoRechazo, normalizarAccesos, normalizarRut } from './reglas';

const superadmin = { id: 's', rolPortal: 'superadmin' as const };
const admin = { id: 'a', rolPortal: 'admin' as const };

const sumarios = {
  id: 'sumarios', nombre: 'Sumarios', estado: 'activa', visibilidad: 'por_acceso',
  manifiesto: {
    perfiles: ['Admin', 'Validador', 'Digitador'], alcance: 'slep',
    opciones: [{ clave: 'cargar_datos', etiqueta: '', descripcion: '', porDefecto: { Admin: true, Validador: false, Digitador: true }, fijo: ['Digitador'], soloSuperadmin: ['Admin'] }],
  },
} as unknown as Aplicacion;
const proxima = { id: 'licencias', nombre: 'Licencias', estado: 'proximamente', visibilidad: 'por_acceso', manifiesto: null } as unknown as Aplicacion;
const apps = new Map([[sumarios.id, sumarios], [proxima.id, proxima]]);
const SLEPS = ['Aconcagua', 'Barrancas', 'Los Álamos'];

describe('motivoRechazo — quién puede cambiar a quién', () => {
  it('un Admin no puede tocar a un Superadmin', () => {
    expect(motivoRechazo(admin, { id: 's', rolPortal: 'superadmin' }, {})).toMatch(/Superadmin/);
  });
  it('un Admin no puede dar el rol de Superadmin (ni al crear ni al editar)', () => {
    expect(motivoRechazo(admin, null, { rolPortal: 'superadmin' })).toMatch(/Superadmin/);
    expect(motivoRechazo(admin, { id: 'x', rolPortal: 'usuario' }, { rolPortal: 'superadmin' })).toMatch(/Superadmin/);
  });
  it('un Admin sí puede administrar a otros Admin y usuarios', () => {
    expect(motivoRechazo(admin, { id: 'b', rolPortal: 'admin' }, { activo: false })).toBeNull();
    expect(motivoRechazo(admin, null, { rolPortal: 'admin' })).toBeNull();
  });
  it('nadie puede desactivarse ni cambiarse su propio rol', () => {
    expect(motivoRechazo(admin, admin, { activo: false })).toMatch(/propia cuenta/);
    expect(motivoRechazo(superadmin, superadmin, { rolPortal: 'usuario' })).toMatch(/propio rol/);
  });
});

describe('normalizarAccesos — se valida contra la ficha de cada aplicación', () => {
  it('rechaza perfiles que la aplicación no tiene, SLEP inventados y aplicaciones "próximamente"', () => {
    expect(normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Jefe', alcance: ['todos'] }], [], apps, SLEPS)).toHaveProperty('error');
    expect(normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Digitador', alcance: ['Narnia'] }], [], apps, SLEPS)).toHaveProperty('error');
    expect(normalizarAccesos(admin, [{ aplicacionId: 'licencias', rol: 'x', alcance: [] }], [], apps, SLEPS)).toHaveProperty('error');
    expect(normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Digitador', alcance: [] }], [], apps, SLEPS)).toHaveProperty('error');
  });
  it('ordena los SLEP según la lista oficial y respeta "todos"', () => {
    const r = normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Digitador', alcance: ['Los Álamos', 'Aconcagua'] }], [], apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(r.accesos[0].alcance).toEqual(['Aconcagua', 'Los Álamos']);
    const t = normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Validador', alcance: ['todos', 'Barrancas'] }], [], apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(t.accesos[0].alcance).toEqual(['todos']);
  });
  it('"Puede cargar datos": por defecto según el perfil, y el Digitador siempre puede', () => {
    const r = normalizarAccesos(admin, [
      { aplicacionId: 'sumarios', rol: 'Validador', alcance: ['todos'] },
    ], [], apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(r.accesos[0].opciones).toEqual({ cargar_datos: false });
    const d = normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Digitador', alcance: ['Barrancas'], opciones: { cargar_datos: false } }], [], apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(d.accesos[0].opciones.cargar_datos).toBe(true);
  });
  it('un Admin puede activárselo a un Validador, pero NO cambiárselo a un Admin (eso es del Superadmin)', () => {
    const v = normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Validador', alcance: ['todos'], opciones: { cargar_datos: true } }], [], apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(v.accesos[0].opciones.cargar_datos).toBe(true);
    const actual: AccesoNormalizado[] = [{ aplicacionId: 'sumarios', rol: 'Admin', alcance: ['todos'], opciones: { cargar_datos: true } }];
    const a = normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Admin', alcance: ['todos'], opciones: { cargar_datos: false } }], actual, apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(a.accesos[0].opciones.cargar_datos).toBe(true);
    const s = normalizarAccesos(superadmin, [{ aplicacionId: 'sumarios', rol: 'Admin', alcance: ['todos'], opciones: { cargar_datos: false } }], actual, apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(s.accesos[0].opciones.cargar_datos).toBe(false);
  });
  it('si no se envía la opción, conserva el valor que la persona ya tenía en ese perfil', () => {
    const actual: AccesoNormalizado[] = [{ aplicacionId: 'sumarios', rol: 'Validador', alcance: ['todos'], opciones: { cargar_datos: true } }];
    const r = normalizarAccesos(admin, [{ aplicacionId: 'sumarios', rol: 'Validador', alcance: ['Barrancas'] }], actual, apps, SLEPS) as { accesos: AccesoNormalizado[] };
    expect(r.accesos[0].opciones.cargar_datos).toBe(true);
  });
});

describe('normalizarRut', () => {
  it('acepta puntos y guión, y valida el dígito verificador', () => {
    expect(normalizarRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizarRut('12345678-9')).toBeNull();
    expect(normalizarRut('10.000.013-k')).toBe('10000013-K');
    expect(normalizarRut('hola')).toBeNull();
  });
});

describe('normalizarAccesos — aplicaciones con un solo SLEP por persona', () => {
  const unSlep = { ...sumarios, id: 'uno', manifiesto: { ...sumarios.manifiesto!, alcance: 'slep_uno' } } as unknown as Aplicacion;
  const appsUno = new Map([[unSlep.id, unSlep]]);
  it('acepta un SLEP o "todos", y rechaza dos o más', () => {
    expect(normalizarAccesos(admin, [{ aplicacionId: 'uno', rol: 'Digitador', alcance: ['Barrancas'] }], [], appsUno, SLEPS)).toHaveProperty('accesos');
    expect(normalizarAccesos(admin, [{ aplicacionId: 'uno', rol: 'Validador', alcance: ['todos'] }], [], appsUno, SLEPS)).toHaveProperty('accesos');
    expect(normalizarAccesos(admin, [{ aplicacionId: 'uno', rol: 'Digitador', alcance: ['Barrancas', 'Aconcagua'] }], [], appsUno, SLEPS)).toHaveProperty('error');
  });
});
