// Aplica el catálogo único (catalogo/catalogo-general.json) a la base, sin
// levantar el servidor: npm run catalogo:aplicar. El servidor hace lo mismo
// solo cada vez que arranca; esto sirve para aplicarlo a mano y ver el resultado.
import dataSource from '../data-source';
import { CatalogoGeneralService } from '../../asistente/catalogo-general.service';
import { Informe } from '../../asistente/informe.entity';

async function main() {
  await dataSource.initialize();
  try {
    await new CatalogoGeneralService(dataSource, dataSource.getRepository(Informe)).sincronizar();
    const informes = await dataSource.getRepository(Informe).find({ order: { orden: 'ASC' } });
    informes.forEach((i) => console.log(`  ${i.orden}. [${i.categoria} · ${i.formato}] ${i.nombre}`));
    const [m] = await dataSource.query("SELECT `nombre` FROM `modulos` WHERE `id` = 'gestor_formularios'");
    console.log(`  Módulo gestor_formularios: ${m?.nombre}`);
  } finally {
    await dataSource.destroy();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
