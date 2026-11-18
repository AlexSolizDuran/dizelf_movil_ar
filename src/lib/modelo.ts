import { Directory, File, Paths } from "expo-file-system";
import { API_BASE, ErrorApi, pedir } from "./api";
import type { MetaModeloAr } from "../tipos";

/**
 * GLB del proyecto: caché local + URL firmada para el visor.
 *
 * POR QUÉ DESCARGA Y ADEMÁS PIDE UNA URL
 * --------------------------------------
 * El visor `ar3d` corre en un WebView con el origen de Vercel, no en un servidor
 * local (M2 sigue pendiente), así que la página carga el GLB desde el bucket con
 * una **URL prefirmada**. La app, además, guarda el archivo para no volver a
 * bajarlo cuando la versión no cambió (`/modelo/meta` da el `version`).
 *
 * Cuando M2 exista, el WebView apuntará a `127.0.0.1` y la descarga local pasará
 * a ser la única fuente; la interfaz de este módulo no cambia.
 */

export interface ModeloPreparado {
  /** URL prefirmada del bucket, la que recibe el WebView. */
  url: string;
  meta: MetaModeloAr;
  /** Ruta del GLB en el dispositivo (caché). */
  uriLocal: string;
  /** `true` si no hizo falta descargar: la versión local ya era la vigente. */
  desdeCache: boolean;
}

export function metaModelo(
  proyectoId: string,
  token: string
): Promise<MetaModeloAr> {
  return pedir<MetaModeloAr>(`/proyectos/${proyectoId}/modelo/meta`, { token });
}

/**
 * Deja el modelo listo para el visor.
 *
 * @param alProgresar fracción 0..1 de la descarga (se omite si venía cacheado).
 */
export async function prepararModelo(opciones: {
  proyectoId: string;
  token: string;
  alProgresar?: (fraccion: number) => void;
}): Promise<ModeloPreparado> {
  const { proyectoId, token, alProgresar } = opciones;

  const meta = await metaModelo(proyectoId, token);
  if (!meta.hay) {
    throw new ErrorApi(
      "Este proyecto todavía no tiene un modelo AR publicado. Publicalo desde el editor.",
      404
    );
  }

  const carpeta = new Directory(Paths.document, "modelos", proyectoId);
  if (!carpeta.exists) {
    carpeta.create({ intermediates: true });
  }

  const archivo = new File(carpeta, `v${meta.version}.glb`);
  const alDia = archivo.exists && archivo.size === meta.bytes;

  if (alDia) {
    return {
      url: await pedirUrlFirmada(proyectoId, token),
      meta,
      uriLocal: archivo.uri,
      desdeCache: true,
    };
  }

  const { url } = await descargar(proyectoId, token, archivo, alProgresar);
  limpiarVersionesViejas(carpeta, archivo.name);

  return { url, meta, uriLocal: archivo.uri, desdeCache: false };
}

/**
 * Pide la URL prefirmada sin bajar el archivo.
 *
 * `GET /modelo` responde 302 al bucket. Con `redirect: 'manual'` la URL sale del
 * header `Location`.
 *
 * OJO: React Native ignora `redirect: 'manual'` y sigue el redirect; ahí el
 * `Range: bytes=0-0` es lo que evita bajar el GLB entero solo para leer la URL.
 * Sin él, abrir la vista 3D de un modelo ya cacheado descargaba el archivo por
 * segunda vez (y en memoria) antes de montar el WebView: pantalla en negro con
 * el spinner para un GLB de varios MB.
 */
async function pedirUrlFirmada(
  proyectoId: string,
  token: string
): Promise<string> {
  const destino = `${API_BASE}/proyectos/${proyectoId}/modelo`;

  const respuesta = await fetch(destino, {
    headers: { Authorization: `Bearer ${token}`, Range: "bytes=0-0" },
    redirect: "manual",
  });

  const location = respuesta.headers.get("location");
  if (location) {
    await respuesta.body?.cancel().catch(() => undefined);
    return location;
  }

  if (respuesta.url && respuesta.url !== destino) {
    await respuesta.body?.cancel().catch(() => undefined);
    return respuesta.url;
  }

  if (respuesta.status === 404) {
    throw new ErrorApi("Este proyecto todavía no tiene un modelo AR publicado.", 404);
  }

  throw new ErrorApi(
    `El servidor no devolvió la URL del modelo (${respuesta.status}).`,
    respuesta.status
  );
}

/**
 * Descarga el GLB con progreso real.
 *
 * Se lee el stream para poder informar avance: un archivo de 20 MB por 4G tarda
 * y sin barra el usuario cree que la app se colgó.
 */
async function descargar(
  proyectoId: string,
  token: string,
  archivo: File,
  alProgresar?: (fraccion: number) => void
): Promise<{ url: string }> {
  const respuesta = await fetch(`${API_BASE}/proyectos/${proyectoId}/modelo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok) {
    throw new ErrorApi(
      `No se pudo descargar el modelo (${respuesta.status}).`,
      respuesta.status
    );
  }

  const total =
    Number(respuesta.headers.get("content-length")) ||
    Number(respuesta.headers.get("x-total-bytes")) ||
    0;

  const lector = respuesta.body?.getReader();
  let bytes: Uint8Array;

  if (!lector) {
    bytes = new Uint8Array(await respuesta.arrayBuffer());
    alProgresar?.(1);
  } else {
    const trozos: Uint8Array[] = [];
    let recibidos = 0;

    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (value) {
        trozos.push(value);
        recibidos += value.byteLength;
        if (total > 0) alProgresar?.(Math.min(recibidos / total, 0.99));
      }
    }

    bytes = unir(trozos, recibidos);
    alProgresar?.(1);
  }

  // `write` crea el archivo si no existe; no hace falta `create` antes.
  await archivo.write(bytes);

  return { url: respuesta.url };
}

function unir(trozos: Uint8Array[], total: number): Uint8Array {
  const salida = new Uint8Array(total);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    salida.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }
  return salida;
}

/** Borra las versiones anteriores: el bucket solo guarda la vigente. */
function limpiarVersionesViejas(carpeta: Directory, vigente: string): void {
  for (const entrada of carpeta.list()) {
    if (entrada instanceof File && entrada.name !== vigente) {
      entrada.delete();
    }
  }
}
