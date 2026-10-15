import { MAXIMO_ATAJOS, limpiarAtajos } from './atajos';

describe('limpiarAtajos', () => {
  it('conserva aplicaciones, informes y enlaces web bien formados', () => {
    const atajos = [
      { id: 'a1', nombre: ' Sumarios ', tipo: 'app', destino: 'reporte_avance_sumarios' },
      { id: 'a2', nombre: 'Ranking', tipo: 'informe', destino: 'ranking_pdf' },
      { id: 'a3', nombre: 'Drive', tipo: 'enlace', destino: 'https://drive.google.com/x' },
    ];
    expect(limpiarAtajos(atajos)).toEqual([{ ...atajos[0], nombre: 'Sumarios' }, atajos[1], atajos[2]]);
  });

  it('descarta enlaces que no son web, nombres vacíos, tipos desconocidos e ids repetidos', () => {
    expect(
      limpiarAtajos([
        { id: 'a1', nombre: 'X', tipo: 'enlace', destino: 'javascript:alert(1)' },
        { id: 'a2', nombre: '  ', tipo: 'app', destino: 'x' },
        { id: 'a3', nombre: 'X', tipo: 'otro', destino: 'x' },
        { id: 'a4', nombre: 'X', tipo: 'app', destino: 'x' },
        { id: 'a4', nombre: 'Y', tipo: 'app', destino: 'y' },
      ]),
    ).toEqual([{ id: 'a4', nombre: 'X', tipo: 'app', destino: 'x' }]);
  });

  it('no guarda más del máximo', () => {
    const muchos = Array.from({ length: 20 }, (_, k) => ({ id: `a${k}`, nombre: 'X', tipo: 'app', destino: 'x' }));
    expect(limpiarAtajos(muchos)).toHaveLength(MAXIMO_ATAJOS);
    expect(limpiarAtajos('nada')).toEqual([]);
  });
});
