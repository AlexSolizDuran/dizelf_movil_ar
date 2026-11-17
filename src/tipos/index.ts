/**
 * Tipos de la app.
 *
 * Son espejos de los DTO del backend (`dizelf_back/src/modules/...`). Se
 * declaran acá y no se importan del backend porque son proyectos separados sin
 * monorepo: compartir el código obligaría a un paquete común.
 */

export interface Persona {
  id: number;
  nombre: string;
  apellido: string;
  gmail: string;
}

export interface Usuario {
  id: number;
  username: string;
  persona: Persona;
}

/** Respuesta de `POST /auth/token` (solo para clientes nativos). */
export interface TokenMovil {
  token: string;
  expiraEnSegundos: number;
  usuario: Usuario;
}

/** Item de `GET /proyectos`, sin el `esquemaJson` del plano. */
export interface ProyectoLista {
  id: string;
  nombre: string;
  creadorId: number;
  miRol: string;
  totalColaboradores: number;
  puedeEditar: boolean;
}

export interface ProyectosPaginados {
  datos: ProyectoLista[];
  total: number;
  pagina: number;
  limite: number;
}

/** `GET /proyectos/:id/modelo/meta`. `version` es la clave de caché. */
export interface MetaModeloAr {
  hay: boolean;
  version: number;
  bytes: number;
  actualizado: string | null;
}
