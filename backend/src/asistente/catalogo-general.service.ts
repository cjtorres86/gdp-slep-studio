import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource, In, Not, Repository } from 'typeorm';
import { Aplicacion } from '../catalogo/entities/aplicacion.entity';
import { Modulo } from '../catalogo/entities/modulo.entity';
import { Informe } from './informe.entity';
import { CatalogoGeneral, preguntasParaBase, validarCatalogo } from './catalogo-general';

// Dónde está el catálogo único: en la raíz del repositorio del portal
// (catalogo/catalogo-general.json). Se puede cambiar con CATALOGO_GENERAL.
// Desde src/asistente o dist/asistente, la raíz queda tres carpetas arriba.
const RUTA_CATALOGO = process.env.CATALOGO_GENERAL ?? resolve(__dirname, '../../../catalogo/catalogo-general.json');

// Al arrancar, copia el catálogo único a la base de datos: el archivo es la
// única fuente; la base es la copia de trabajo que leen el Asistente Virtual
// y las aplicaciones. Solo metadatos (nombres, relaciones, palabras clave,
// preguntas, direcciones): nunca toca accesos, perfiles ni direcciones de las
// aplicaciones (esas dependen de cada ambiente).
@Injectable()
export class CatalogoGeneralService implements OnApplicationBootstrap {
  private readonly log = new Logger('CatalogoGeneral');

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Informe) private readonly informes: Repository<Informe>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sincronizar();
    } catch (e) {
      // Un catálogo con problemas no debe impedir que el portal arranque.
      this.log.error(`No se pudo copiar el catálogo a la base: ${(e as Error).message}`);
    }
  }

  async sincronizar(): Promise<void> {
    if (!existsSync(RUTA_CATALOGO)) {
      this.log.warn(`No se encontró el catálogo en ${RUTA_CATALOGO}: se mantiene lo que hay en la base.`);
      return;
    }
    const catalogo = JSON.parse(readFileSync(RUTA_CATALOGO, 'utf8')) as CatalogoGeneral;
    const errores = validarCatalogo(catalogo);
    if (errores.length) {
      this.log.error(`El catálogo tiene errores y no se aplicó:\n - ${errores.join('\n - ')}`);
      return;
    }
    await this.dataSource.transaction(async (m) => {
      // Módulos y aplicaciones: solo se ACTUALIZAN los que ya existen (crear una
      // aplicación pide más que metadatos: dirección, accesos, integración).
      for (const mod of catalogo.modulos) {
        await m.update(Modulo, { id: mod.id }, { nombre: mod.nombre, icono: mod.icono, color: mod.color, orden: mod.orden });
      }
      for (const a of catalogo.aplicaciones) {
        await m.update(Aplicacion, { id: a.id }, { moduloId: a.modulo_id, nombre: a.nombre, descripcion: a.descripcion, estado: a.estado as Aplicacion['estado'], orden: a.orden, palabrasClave: a.palabras_clave });
      }
      // Informes: el archivo manda (se crean, actualizan y los que ya no están se quitan).
      await m.save(
        Informe,
        catalogo.informes.map((i) => ({
          id: i.id,
          aplicacionId: i.aplicacion_id,
          nombre: i.nombre_formal,
          descripcion: i.descripcion,
          formato: i.formato,
          categoria: i.categoria,
          estado: i.estado,
          permiso: i.permiso,
          requiereAlcanceTodos: i.requiere_alcance_todos,
          ruta: i.url_destino,
          preguntas: preguntasParaBase(i),
          palabrasClave: i.palabras_clave,
          orden: i.orden,
        })),
      );
      const ids = catalogo.informes.map((i) => i.id);
      if (ids.length) await m.delete(Informe, { id: Not(In(ids)) });
    });
    this.log.log(`Catálogo aplicado: ${catalogo.modulos.length} módulos, ${catalogo.aplicaciones.length} aplicaciones, ${catalogo.informes.length} informes.`);
  }

  // Lo que la aplicación necesita para su ventana de descargas (solo sus informes).
  async informesDeAplicacion(aplicacionId: string) {
    const lista = await this.informes.find({ where: { aplicacionId }, order: { orden: 'ASC' } });
    return lista.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      descripcion: i.descripcion,
      categoria: i.categoria,
      formato: i.formato,
      estado: i.estado,
      permiso: i.permiso,
      requiereAlcanceTodos: i.requiereAlcanceTodos,
      urlDestino: i.ruta,
      palabrasClave: i.palabrasClave,
      orden: i.orden,
    }));
  }
}
