// Qué cambió entre dos fotos de algo (persona o perfil), para la Bitácora:
// solo los campos distintos, con su valor antes y después.
export function diferencias<T extends Record<string, unknown>>(antes: T, despues: T, campos: (keyof T)[]) {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const c of campos) {
    if (JSON.stringify(antes[c]) !== JSON.stringify(despues[c])) cambios[c as string] = { antes: antes[c], despues: despues[c] };
  }
  return cambios;
}

const NOMBRES: Record<string, string> = {
  nombreParaMostrar: 'nombre', usuario: 'usuario', rut: 'RUT', rolPortal: 'rol en el portal', accesos: 'accesos',
  nombre: 'nombre', descripcion: 'descripción', color: 'color', permisos: 'permisos', restricciones: 'restricciones',
};

// "nombre, accesos y permisos"
export function listaDeCampos(campos: string[]): string {
  const n = campos.map((c) => NOMBRES[c] ?? c);
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}
