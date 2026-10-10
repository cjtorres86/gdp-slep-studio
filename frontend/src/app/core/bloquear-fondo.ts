import { DestroyRef, Signal, effect, inject } from '@angular/core';

// Mientras alguna ventana esté abierta, la página de fondo queda inmóvil: la
// rueda del mouse (o el dedo) no la desplaza, aunque el puntero esté sobre el
// fondo difuminado. Cada componente pasa sus ventanas; se lleva la cuenta para
// que dos componentes con ventanas no se pisen.
let abiertas = 0;

function aplicar(): void {
  document.documentElement.style.overflow = abiertas > 0 ? 'hidden' : '';
}

export function bloquearFondoMientras(...ventanas: Signal<unknown>[]): void {
  let bloqueando = false;
  const soltar = () => {
    if (bloqueando) {
      bloqueando = false;
      abiertas--;
      aplicar();
    }
  };
  effect(() => {
    const hayAbierta = ventanas.some((v) => !!v());
    if (hayAbierta && !bloqueando) {
      bloqueando = true;
      abiertas++;
      aplicar();
    } else if (!hayAbierta) {
      soltar();
    }
  });
  // Si se sale de la página con una ventana abierta, el fondo se suelta igual.
  inject(DestroyRef).onDestroy(soltar);
}
