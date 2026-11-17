import * as SecureStore from "expo-secure-store";
import { pedir } from "./api";
import type { TokenMovil, Usuario } from "../tipos";

/**
 * Sesión de la app.
 *
 * El token va en `SecureStore` (Keystore de Android), nunca en `AsyncStorage`
 * ni en la URL del WebView: un WebView puede leer `localStorage` y las URLs
 * quedan en logs e historial.
 *
 * La app guarda además la fecha de expiración para no mandar un token muerto y
 * mostrar el error genérico del backend.
 */

const CLAVE = "dizelf.sesion";

export interface Sesion {
  token: string;
  expiraEn: number;
  usuario: Usuario;
}

export async function iniciarSesion(
  identificador: string,
  password: string
): Promise<Sesion> {
  const respuesta = await pedir<TokenMovil>("/auth/token", {
    metodo: "POST",
    cuerpo: { identificador, password },
  });

  const sesion: Sesion = {
    token: respuesta.token,
    expiraEn: Date.now() + respuesta.expiraEnSegundos * 1000,
    usuario: respuesta.usuario,
  };

  await SecureStore.setItemAsync(CLAVE, JSON.stringify(sesion));
  return sesion;
}

/** Devuelve la sesión vigente, o `null` si no hay o ya expiró. */
export async function leerSesion(): Promise<Sesion | null> {
  const crudo = await SecureStore.getItemAsync(CLAVE);
  if (!crudo) return null;

  try {
    const sesion = JSON.parse(crudo) as Sesion;
    // Margen de un minuto: no se manda un token que vence en el camino.
    if (!sesion.token || sesion.expiraEn <= Date.now() + 60_000) {
      await cerrarSesion();
      return null;
    }
    return sesion;
  } catch {
    await cerrarSesion();
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE);
}
