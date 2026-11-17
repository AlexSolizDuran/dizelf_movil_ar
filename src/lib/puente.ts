/**
 * Protocolo web ⇄ RN (congelado en `ar3d/puente.js`).
 *
 *   web → RN : modelo-listo {escala} | tracking {valor} | error {motivo}
 *   RN → web : recentrar | reset | bloquear {valor} | escala {valor}
 *
 * Este archivo es un espejo tipado, no una segunda implementación: si cambia el
 * protocolo hay que cambiar los dos lados a la vez (T5 del plan).
 */

/** Tamaño del modelo en metros, medido por la página al cargarlo. */
export interface TamanoModelo {
  x: number;
  y: number;
  z: number;
}

export type MensajeWeb =
  | {
      tipo: "modelo-listo";
      escala: number;
      tam?: TamanoModelo;
      /** Ajuste automático que hizo la página (p. ej. venía en cm). */
      aviso?: string | null;
    }
  | { tipo: "tracking"; valor: "ok" | "perdido"; motivo?: MotivoTracking }
  | { tipo: "error"; motivo: string };

/**
 * Por qué no está en `ok`: `inicializando` es el arranque normal del SLAM (unos
 * segundos) y `limitado` es poca luz/textura o movimiento rápido. 8th Wall no
 * tiene un estado "perdido": `trackingStatus` solo vale LIMITED o NORMAL.
 */
export type MotivoTracking = "inicializando" | "limitado";

/** Comandos que la app puede inyectar en la escena. */
export type ComandoWeb =
  | { tipo: "recentrar" }
  | { tipo: "reset" }
  | { tipo: "bloquear"; valor: boolean }
  | { tipo: "escala"; valor: number };

/**
 * Parsea un mensaje del WebView.
 *
 * Devuelve `null` en vez de lanzar: la web puede mandar cualquier cosa (o el
 * puente puede no estar montado todavía) y un mensaje raro no debe tumbar la
 * pantalla de AR.
 */
export function leerMensaje(crudo: string): MensajeWeb | null {
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return null;
  }

  if (!datos || typeof datos !== "object") return null;
  const mensaje = datos as {
    tipo?: unknown;
    escala?: unknown;
    valor?: unknown;
    motivo?: unknown;
    tam?: unknown;
    aviso?: unknown;
  };

  switch (mensaje.tipo) {
    case "modelo-listo":
      return {
        tipo: "modelo-listo",
        escala: typeof mensaje.escala === "number" ? mensaje.escala : 1,
        tam: leerTamano(mensaje.tam),
        aviso: typeof mensaje.aviso === "string" && mensaje.aviso ? mensaje.aviso : null,
      };
    case "tracking":
      // `escena.js` manda 'ok' o 'perdido' (no un porcentaje).
      return {
        tipo: "tracking",
        valor: mensaje.valor === "ok" ? "ok" : "perdido",
        motivo:
          mensaje.motivo === "inicializando" || mensaje.motivo === "limitado"
            ? mensaje.motivo
            : undefined,
      };
    case "error":
      return {
        tipo: "error",
        motivo:
          typeof mensaje.motivo === "string" && mensaje.motivo
            ? mensaje.motivo
            : "Error desconocido del motor AR.",
      };
    default:
      return null;
  }
}

/** Valida el tamaño que manda la página: números finitos y positivos. */
function leerTamano(crudo: unknown): TamanoModelo | undefined {
  if (!crudo || typeof crudo !== "object") return undefined;
  const { x, y, z } = crudo as { x?: unknown; y?: unknown; z?: unknown };
  const numeros = [x, y, z].map(Number);
  if (!numeros.every((n) => Number.isFinite(n) && n > 0)) return undefined;
  return { x: numeros[0], y: numeros[1], z: numeros[2] };
}

/**
 * JS que se inyecta en el WebView para ejecutar un comando.
 *
 * Se usa `window.__comando`, que `activarPuente()` define en `app.js`; pasa por
 * el mismo camino que los gestos, así que no hay una segunda lógica de escena.
 */
export function jsDeComando(comando: ComandoWeb): string {
  const serializado = JSON.stringify(comando);
  return `window.__comando && window.__comando(${serializado}); true;`;
}
