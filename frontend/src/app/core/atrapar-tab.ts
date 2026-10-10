// Con una ventana abierta, Tab recorre solo lo que hay dentro de ella (para
// teclado y lectores de pantalla). Se usa en todas las ventanas del portal.
export function atraparTab(e: KeyboardEvent, ventana: HTMLElement | undefined): void {
  if (e.key !== 'Tab' || !ventana) return;
  const enfocables = Array.from(
    ventana.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'),
  ).filter((el) => el.offsetParent !== null);
  if (!enfocables.length) return;
  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primero.focus();
  }
}
