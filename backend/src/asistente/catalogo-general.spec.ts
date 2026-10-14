import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CatalogoGeneral, validarCatalogo } from './catalogo-general';

const real = (): CatalogoGeneral => JSON.parse(readFileSync(resolve(__dirname, '../../../catalogo/catalogo-general.json'), 'utf8'));

describe('catálogo único (catalogo/catalogo-general.json)', () => {
  it('el archivo real es válido', () => {
    expect(validarCatalogo(real())).toEqual([]);
  });

  it('sigue la nomenclatura "Informe [formato] de [contenido]" y trae los 10 informes, 2 + 4 + 4', () => {
    const c = real();
    expect(c.informes.every((i) => i.nombre_formal.startsWith('Informe '))).toBe(true);
    const por = (cat: string) => c.informes.filter((i) => i.categoria === cat).map((i) => i.formato);
    expect(por('consolidado')).toEqual(['xlsx', 'xlsx']);
    expect(por('interactivo')).toEqual(['html', 'html', 'html', 'html']);
    expect(por('estatico')).toEqual(['pdf', 'pdf', 'pdf', 'pdf']);
    expect(new Set(c.informes.map((i) => i.orden)).size).toBe(c.informes.length);
  });

  it('"Gestor de Formularios" se llama "Reportabilidad"', () => {
    expect(real().modulos.find((m) => m.id === 'gestor_formularios')?.nombre).toBe('Reportabilidad');
  });

  it('detecta errores de escritura: formato, categoría, referencias y preguntas', () => {
    const c = real();
    c.informes[0].formato = 'docx' as never;
    c.informes[1].categoria = 'otra' as never;
    c.informes[2].aplicacion_id = 'no_existe';
    c.informes.find((i) => i.id === 'sumarios_errores_interactivo')!.preguntas = []; // su dirección lleva {mes}
    c.aplicaciones[0].modulo_id = 'tampoco';
    const errores = validarCatalogo(c).join('\n');
    expect(errores).toContain('formato "docx"');
    expect(errores).toContain('categoría "otra"');
    expect(errores).toContain('"no_existe" no existe');
    expect(errores).toContain('debe preguntar el mes');
    expect(errores).toContain('"tampoco" no existe');
  });

  it('rechaza un archivo sin las tres listas', () => {
    expect(validarCatalogo({})).toHaveLength(1);
  });
});
