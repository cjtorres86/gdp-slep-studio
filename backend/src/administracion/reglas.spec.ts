import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { AccesoNormalizado, Editor, motivoRechazo, normalizarAccesos, normalizarRut } from './reglas';
import type { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';

const superadmin = { id: 's', rolPortal: 'superadmin' as const };
const admin = { id: 'a', rolPortal: 'admin' as const };

const sumarios = {
  id: 'sumarios', nombre: 'Sumarios', estado: 'activa', visibilidad: 'por_acceso',
  manifiesto: { permisos: [], alcance: 'slep', opciones: [{ clave: 'cargar_datos', etiqueta: '', descripcion: '' }] },
} as unknown as Aplicacion;
const proxima = { id: 'licencias', nombre: 'Licencias', estado: 'proximamente', visibilidad: 'por_acceso', manifiesto: null } as unknown as Aplicacion;
const apps = new Map([[sumarios.id, sumarios], [proxima.id, proxima]]);
const SLEPS = ['Aconcagua', 'Barrancas', 'Los Álamos'];
const perfil = (id: string, nombre: string, carga: string, extra: Partial<{ exigeSlep: boolean; cargaSoloSuperadmin: boolean }> = {}) =>
  ({ id, aplicacionId: 'sumarios', nombre, restricciones: { exigeSlep: false, cargaSoloSuperadmin: false, carga, ...extra } }) as unknown as PerfilAplicacion;
const PERFILES = [
  perfil('perfil_admin', 'Admin', 'opcional_si', { cargaSoloSuperadmin: true }),
  perfil('perfil_validador', 'Validador', 'opcional_no'),
  perfil('perfil_digitador', 'Digitador', 'siempre', { exigeSlep: true }),
  perfil('perfil_visita', 'Visita', 'nunca'),
];
const norm = (editor: Editor, pedidos: Parameters<typeof normalizarAccesos>[1], actuales: AccesoNormalizado[] = [], a = apps) =>
  normalizarAccesos(editor, pedidos, actuales, a, SLEPS, PERFILES);
const ok = (r: ReturnType<typeof normalizarAccesos>) => (r as { accesos: AccesoNormalizado[] }).accesos;

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

describe('normalizarAccesos — se valida contra la ficha y los perfiles de cada aplicación', () => {
  it('rechaza perfiles inexistentes, SLEP inventados, aplicaciones "próximamente" y alcance vacío', () => {
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_jefe', alcance: ['todos'] }])).toHaveProperty('error');
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['Narnia'] }])).toHaveProperty('error');
    expect(norm(admin, [{ aplicacionId: 'licencias', rol: 'x', alcance: [] }])).toHaveProperty('error');
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: [] }])).toHaveProperty('error');
  });
  it('guarda el ID del perfil, ordena los SLEP según la lista oficial y respeta "todos"', () => {
    const r = ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['Los Álamos', 'Aconcagua'] }]));
    expect(r[0].rol).toBe('perfil_validador');
    expect(r[0].alcance).toEqual(['Aconcagua', 'Los Álamos']);
    expect(ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['todos', 'Barrancas'] }]))[0].alcance).toEqual(['todos']);
  });
  it('"Exige un SLEP específico": un Digitador no puede tener "Todos los SLEP"', () => {
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_digitador', alcance: ['todos'] }])).toHaveProperty('error');
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_digitador', alcance: ['Barrancas'] }])).toHaveProperty('accesos');
  });
  it('carga "siempre" y "nunca" son fijas: no se pueden cambiar persona por persona', () => {
    expect(ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_digitador', alcance: ['Barrancas'], opciones: { cargar_datos: false } }]))[0].opciones.cargar_datos).toBe(true);
    expect(ok(norm(superadmin, [{ aplicacionId: 'sumarios', rol: 'perfil_visita', alcance: ['todos'], opciones: { cargar_datos: true } }]))[0].opciones.cargar_datos).toBe(false);
  });
  it('carga opcional: parte con el valor del perfil y se puede activar', () => {
    expect(ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['todos'] }]))[0].opciones.cargar_datos).toBe(false);
    expect(ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['todos'], opciones: { cargar_datos: true } }]))[0].opciones.cargar_datos).toBe(true);
  });
  it('"solo el Superadmin cambia la carga" (Admin): un Admin no la mueve, el Superadmin sí', () => {
    const actual: AccesoNormalizado[] = [{ aplicacionId: 'sumarios', rol: 'perfil_admin', alcance: ['todos'], opciones: { cargar_datos: true } }];
    expect(ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_admin', alcance: ['todos'], opciones: { cargar_datos: false } }], actual))[0].opciones.cargar_datos).toBe(true);
    expect(ok(norm(superadmin, [{ aplicacionId: 'sumarios', rol: 'perfil_admin', alcance: ['todos'], opciones: { cargar_datos: false } }], actual))[0].opciones.cargar_datos).toBe(false);
  });
  it('si no se envía la opción, conserva el valor que la persona ya tenía en ese perfil', () => {
    const actual: AccesoNormalizado[] = [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['todos'], opciones: { cargar_datos: true } }];
    expect(ok(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['Barrancas'] }], actual))[0].opciones.cargar_datos).toBe(true);
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
  const unSlep = { ...sumarios, manifiesto: { ...sumarios.manifiesto!, alcance: 'slep_uno' } } as unknown as Aplicacion;
  const appsUno = new Map([[unSlep.id, unSlep]]);
  it('acepta un SLEP o "todos", y rechaza dos o más', () => {
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_digitador', alcance: ['Barrancas'] }], [], appsUno)).toHaveProperty('accesos');
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_validador', alcance: ['todos'] }], [], appsUno)).toHaveProperty('accesos');
    expect(norm(admin, [{ aplicacionId: 'sumarios', rol: 'perfil_digitador', alcance: ['Barrancas', 'Aconcagua'] }], [], appsUno)).toHaveProperty('error');
  });
});
