import { Injectable, signal } from '@angular/core';

// Pantallas de la ventana Opciones (botón de la barra superior): el inicio
// (Configuración y Documentación) y lo que hay dentro de cada una.
export type PantallaOpciones = 'inicio' | 'configuracion' | 'administracion' | 'vista' | 'documentacion';

// Ventanas de la barra superior (las dibuja el marco común): Opciones y Ver
// marco legal. Las páginas las consultan para no robarles la tecla Esc.
@Injectable({ providedIn: 'root' })
export class PanelConfigService {
  readonly abierto = signal(false);
  readonly pantalla = signal<PantallaOpciones>('inicio');
  readonly marcoAbierto = signal(false);
  // Quien la abrió: al cerrar, el foco vuelve ahí.
  origen: HTMLElement | null = null;

  abrir(origen?: HTMLElement | null, pantalla: PantallaOpciones = 'inicio'): void {
    this.origen = origen ?? (document.activeElement as HTMLElement | null);
    this.pantalla.set(pantalla);
    this.abierto.set(true);
  }
}
