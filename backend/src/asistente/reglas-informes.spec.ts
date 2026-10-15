import { Acceso } from '../catalogo/entities/acceso.entity';
import { PerfilAplicacion } from '../perfiles/perfil-aplicacion.entity';
import { Informe } from './informe.entity';
import { construirDestino, informeAutorizado, RespuestaInvalida, slepsDe, textosPara, visiblePara } from './reglas-informes';

const informe = (x: Partial<Informe>) => ({ id: 'i', aplicacionId: 'sumarios', permiso: 'exportar_informe', requiereAlcanceTodos: false, preguntas: [], ruta: '/x', ...x }) as Informe;
const acceso = (rol: string, alcance: string[]) => ({ usuarioId: 'u', aplicacionId: 'sumarios', rol, alcance }) as Acceso;
const perfiles = [
  { id: 'perfil_admin', permisos: ['exportar_informe', 'exportar_excel_consolidado'] },
  { id: 'perfil_digitador', permisos: ['formulario'] },
] as PerfilAplicacion[];
const MES = { clave: 'mes' as const, texto: '', opcionTodos: null };
const MES_OPCIONAL = { clave: 'mes' as const, texto: '', opcionTodos: 'Todos los meses' };
const SLEP = { clave: 'slep' as const, texto: '', opcionTodos: 'Todos los SLEP' };
const TODOS = ['Barrancas', 'Valdivia'];

describe('informeAutorizado', () => {
  it('el Superadmin abre todo, aunque no tenga acceso', () => {
    expect(informeAutorizado(informe({ requiereAlcanceTodos: true }), 'superadmin', undefined, [])).toBe(true);
  });
  it('sin acceso a la aplicación, no', () => {
    expect(informeAutorizado(informe({}), 'admin', undefined, perfiles)).toBe(false);
  });
  it('con un perfil que tiene el permiso del informe, sí; sin él, no', () => {
    expect(informeAutorizado(informe({}), 'usuario', acceso('perfil_admin', ['todos']), perfiles)).toBe(true);
    expect(informeAutorizado(informe({}), 'usuario', acceso('perfil_digitador', ['Barrancas']), perfiles)).toBe(false);
  });
  it('un informe solo para "todos los SLEP" no se abre con un SLEP puntual', () => {
    const i = informe({ permiso: 'exportar_excel_consolidado', requiereAlcanceTodos: true });
    expect(informeAutorizado(i, 'usuario', acceso('perfil_admin', ['Barrancas']), perfiles)).toBe(false);
    expect(informeAutorizado(i, 'usuario', acceso('perfil_admin', ['todos']), perfiles)).toBe(true);
  });
});

describe('un solo SLEP: solo lo suyo, con su nombre', () => {
  it('no ve los informes de todos los SLEP (rankings, consolidados de los 36, por SLEP)', () => {
    expect(visiblePara(informe({ requiereAlcanceTodos: true }), ['Valdivia'])).toBe(false);
    expect(visiblePara(informe({ requiereAlcanceTodos: false }), ['Valdivia'])).toBe(true);
    expect(visiblePara(informe({ requiereAlcanceTodos: true }), 'todos')).toBe(true);
  });
  it('"nacional" pasa a ser su SLEP, en el nombre y la descripción', () => {
    const i = { nombre: 'Informe interactivo nacional', descripcion: 'Avance de los sumarios del país: indicadores.' };
    expect(textosPara(i, ['Valdivia'])).toEqual({ nombre: 'Informe interactivo Valdivia', descripcion: 'Avance de los sumarios de Valdivia: indicadores.' });
    expect(textosPara({ nombre: 'Informe estático nacional', descripcion: 'El informe nacional del mes, de todos los SLEP, listo.' }, ['Valdivia']).nombre).toBe('Informe estático Valdivia');
    expect(textosPara(i, 'todos')).toEqual(i);
  });
});

describe('construirDestino', () => {
  it('pone el mes en la dirección y el SLEP como parámetro', () => {
    const i = informe({ ruta: '/informe/{mes}/{anio}?tipo=errores', preguntas: [MES, SLEP] });
    expect(construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' }, slep: 'Valdivia' }, 'todos', TODOS)).toBe('/informe/Agosto/2026?tipo=errores&slep=Valdivia');
  });
  it('"todos los SLEP" no agrega filtro', () => {
    const i = informe({ ruta: '/informe/{mes}/{anio}?imprimir=1', preguntas: [MES, SLEP] });
    expect(construirDestino(i, { mes: { mes: 'Julio', anio: '2026' }, slep: 'todos' }, 'todos', TODOS)).toBe('/informe/Julio/2026?imprimir=1');
  });
  it('ranking (interactivo y estático): el mes obligatorio va como ?mes=&anio=', () => {
    expect(construirDestino(informe({ ruta: '/informe-ranking', preguntas: [MES] }), { mes: { mes: 'Agosto', anio: '2026' } }, 'todos', TODOS)).toBe('/informe-ranking?mes=Agosto&anio=2026');
    expect(construirDestino(informe({ ruta: '/informe-ranking?imprimir=1', preguntas: [MES] }), { mes: { mes: 'Agosto', anio: '2026' } }, 'todos', TODOS)).toBe('/informe-ranking?imprimir=1&mes=Agosto&anio=2026');
    expect(() => construirDestino(informe({ ruta: '/informe-ranking', preguntas: [MES] }), { mes: 'todos' }, 'todos', TODOS)).toThrow(RespuestaInvalida);
  });
  it('informe por SLEP: exige un SLEP (sin "todos"); quien trabaja con uno solo recibe el suyo', () => {
    const SLEP_OBLIGATORIO = { clave: 'slep' as const, texto: '', opcionTodos: null };
    const i = informe({ ruta: '/informe/{mes}/{anio}?imprimir=1', preguntas: [MES, SLEP_OBLIGATORIO] });
    expect(construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' }, slep: 'Valdivia' }, 'todos', TODOS)).toBe('/informe/Agosto/2026?imprimir=1&slep=Valdivia');
    expect(() => construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' }, slep: 'todos' }, 'todos', TODOS)).toThrow(RespuestaInvalida);
    expect(() => construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' } }, 'todos', TODOS)).toThrow(RespuestaInvalida);
    expect(construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' } }, ['Barrancas'], TODOS)).toBe('/informe/Agosto/2026?imprimir=1&slep=Barrancas');
  });
  it('un informe que necesita mes no se abre con "todos los meses"', () => {
    const i = informe({ ruta: '/informe/{mes}/{anio}', preguntas: [MES] });
    expect(() => construirDestino(i, { mes: 'todos' }, 'todos', TODOS)).toThrow(RespuestaInvalida);
  });
  it('si el mes es opcional y no va en la dirección, va como ?mes=&anio=; "todos" no agrega nada', () => {
    const i = informe({ ruta: '/informe-avance', preguntas: [MES_OPCIONAL, SLEP] });
    expect(construirDestino(i, { mes: { mes: 'Mayo', anio: '2026' }, slep: 'todos' }, 'todos', TODOS)).toBe('/informe-avance?mes=Mayo&anio=2026');
    expect(construirDestino(i, { mes: 'todos', slep: 'todos' }, 'todos', TODOS)).toBe('/informe-avance');
  });
  it('quien trabaja con un solo SLEP siempre recibe el suyo', () => {
    const i = informe({ ruta: '/informe-avance', preguntas: [SLEP] });
    expect(construirDestino(i, { slep: 'todos' }, ['Barrancas'], TODOS)).toBe('/informe-avance?slep=Barrancas');
    expect(construirDestino(i, { slep: 'Valdivia' }, ['Barrancas'], TODOS)).toBe('/informe-avance?slep=Barrancas');
  });
  it('rechaza un SLEP que no existe o que no le corresponde, y un mes con caracteres raros', () => {
    const i = informe({ ruta: '/informe/{mes}/{anio}', preguntas: [MES, SLEP] });
    expect(() => construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' }, slep: 'Inventado' }, 'todos', TODOS)).toThrow(RespuestaInvalida);
    expect(() => construirDestino(i, { mes: { mes: 'Agosto', anio: '2026' }, slep: 'Valdivia' }, ['Barrancas', 'Chiloé'], TODOS)).toThrow(RespuestaInvalida);
    expect(() => construirDestino(i, { mes: { mes: '../x', anio: '2026' } }, 'todos', TODOS)).toThrow(RespuestaInvalida);
  });
});

describe('slepsDe', () => {
  it('Superadmin o alcance "todos" → todos; si no, su lista', () => {
    expect(slepsDe('superadmin', undefined)).toBe('todos');
    expect(slepsDe('usuario', acceso('perfil_admin', ['todos']))).toBe('todos');
    expect(slepsDe('usuario', acceso('perfil_digitador', ['Barrancas']))).toEqual(['Barrancas']);
  });
});
