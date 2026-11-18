/**
 * Cliente HTTP del backend.
 *
 * La app habla con el backend **directo** (Render), no con el proxy de Vercel
 * del front web: no hay cookie same-origin que proteger, y la sesión viaja como
 * `Authorization: Bearer`. El backend acepta peticiones sin `Origin` (clientes
 * nativos) porque su CORS solo restringe a los navegadores.
 */

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  ""
);
const BASE = API_BASE;

/**
 * URL pública del visor AR (la misma que se prueba en el navegador).
 *
 * Siempre termina en `/`: las pantallas le pegan rutas directamente
 * (`plano.html`). Si la variable se configura sin la barra final —lo normal al
 * copiar la URL desde el navegador— el resultado sería
 * `https://hostplano.html`, un host inválido: la AR seguiría abriendo (el
 * `?glb=` va pegado al host) pero la vista 3D se quedaría en blanco.
 */
const BASE_AR3D =
  process.env.EXPO_PUBLIC_AR3D_URL ?? "https://ar3d-puce.vercel.app";

export const URL_AR3D = BASE_AR3D.endsWith("/") ? BASE_AR3D : `${BASE_AR3D}/`;

/** 15 s como el front: si el backend no responde, el usuario tiene que saberlo. */
const TIMEOUT_MS = 15_000;

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado: number
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

interface OpcionesPedido {
  token?: string;
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  /** Milisegundos; la descarga del GLB usa un tope mucho más alto. */
  timeoutMs?: number;
  senal?: AbortSignal;
}

export async function pedir<T>(
  ruta: string,
  opciones: OpcionesPedido = {}
): Promise<T> {
  if (!BASE) {
    throw new ErrorApi(
      "Falta EXPO_PUBLIC_API_URL: la app no sabe a qué backend hablarle.",
      0
    );
  }

  const control = new AbortController();
  const temporizador = setTimeout(
    () => control.abort(),
    opciones.timeoutMs ?? TIMEOUT_MS
  );
  const alAbortar = () => control.abort();
  opciones.senal?.addEventListener("abort", alAbortar, { once: true });

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: {
        Accept: "application/json",
        ...(opciones.cuerpo ? { "Content-Type": "application/json" } : {}),
        ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      },
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      signal: control.signal,
    });
  } catch {
    throw new ErrorApi(
      "No se pudo conectar con el servidor. Revisá tu conexión.",
      0
    );
  } finally {
    clearTimeout(temporizador);
    opciones.senal?.removeEventListener("abort", alAbortar);
  }

  if (!respuesta.ok) {
    const mensaje = await leerMensajeDeError(respuesta);
    throw new ErrorApi(mensaje, respuesta.status);
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}

/**
 * El backend responde `message` como string o como arreglo (class-validator).
 * Se unifica para poder mostrarlo tal cual en pantalla.
 */
async function leerMensajeDeError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { message?: string | string[] };
    if (Array.isArray(cuerpo.message)) return cuerpo.message.join(". ");
    if (typeof cuerpo.message === "string") return cuerpo.message;
  } catch {
    // Respuesta sin JSON: se usa el mensaje genérico.
  }

  if (respuesta.status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (respuesta.status === 403) return "No tenés permiso para ver este proyecto.";
  if (respuesta.status === 404) return "No encontramos el recurso.";
  return `Error del servidor (${respuesta.status}).`;
}
