import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CatalogoService } from '../../core/catalogo.service';
import { RolPortal } from '../../core/models';
import { atraparTab } from '../../core/atrapar-tab';
import { bloquearFondoMientras } from '../../core/bloquear-fondo';

const ETIQUETA_ROL: Record<RolPortal, string> = {
  superadmin: 'Superadmin',
  admin: 'Administrador',
  usuario: 'Usuario',
};

// Marco común de todas las páginas con sesión: barra superior (Inicio,
// Configuración, persona, Salir), la página actual y el pie.
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit {
  private readonly catalogo = inject(CatalogoService);
  readonly configuracion = this.catalogo.configuracion;
  readonly configAbierta = signal(false);
  // ¿Estamos en el inicio (asistente)? Ahí la página mide el alto de la ventana y no lleva pie.
  private readonly router = inject(Router);
  readonly enInicio = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0] === '/'),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] === '/' },
  );
  private readonly botonConfig = viewChild<ElementRef<HTMLButtonElement>>('botonConfig');
  private readonly ventanaConfig = viewChild<ElementRef<HTMLElement>>('ventanaConfig');

  constructor(readonly auth: AuthService) {
    bloquearFondoMientras(this.configAbierta);
  }

  ngOnInit(): void {
    this.catalogo.cargar();
  }

  etiquetaRol(rol: RolPortal | undefined): string {
    return rol ? ETIQUETA_ROL[rol] : '';
  }

  irInicio(): void {
    this.configAbierta.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  abrirConfig(): void {
    this.configAbierta.set(true);
    setTimeout(() => this.ventanaConfig()?.nativeElement.querySelector<HTMLElement>('[data-cerrar]')?.focus());
  }

  // devolverFoco=false cuando se cierra porque se eligió una opción (la
  // persona se va a otra página: el foco no debe volver al botón).
  cerrarConfig(devolverFoco = true): void {
    if (!this.configAbierta()) return;
    this.configAbierta.set(false);
    if (devolverFoco) setTimeout(() => this.botonConfig()?.nativeElement.focus());
  }

  @HostListener('document:keydown', ['$event'])
  alPresionarTecla(e: KeyboardEvent): void {
    if (!this.configAbierta()) return;
    if (e.key === 'Escape') this.cerrarConfig();
    else atraparTab(e, this.ventanaConfig()?.nativeElement);
  }
}
