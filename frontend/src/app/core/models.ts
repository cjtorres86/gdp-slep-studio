export type RolPortal = 'superadmin' | 'admin' | 'usuario';

export interface UsuarioPortal {
  id: string;
  usuario: string | null;
  nombreParaMostrar: string;
  rolPortal: RolPortal;
}

export interface LoginRespuesta {
  accessToken: string;
  usuario: UsuarioPortal;
}

export interface AplicacionVista {
  id: string;
  nombre: string;
  descripcion: string;
  estado: 'activa' | 'proximamente';
  url: string | null;
  rol: string | null;
  alcance: string[] | null;
}

export interface ModuloVista {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  aplicaciones: AplicacionVista[];
}
