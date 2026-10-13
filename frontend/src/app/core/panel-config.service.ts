import { Injectable, signal } from '@angular/core';

// Ventana de Configuración (la dibuja el marco común). Se abre desde el botón
// de la barra superior o desde «Vista» en el panel izquierdo del inicio.
@Injectable({ providedIn: 'root' })
export class PanelConfigService {
  readonly abierto = signal(false);
  // Quien la abrió: al cerrar, el foco vuelve ahí.
  origen: HTMLElement | null = null;

  abrir(origen?: HTMLElement | null): void {
    this.origen = origen ?? (document.activeElement as HTMLElement | null);
    this.abierto.set(true);
  }
}
