import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_BASE, pedir } from "./api";

/**
 * Push de la app.
 *
 * El token de Expo identifica una instalación del dispositivo. El backend lo
 * asocia al usuario autenticado (`POST /notificaciones/dispositivos`), así que
 * este módulo solo se ocupa de pedir permiso, obtener el token y darlo de baja
 * al cerrar sesión.
 *
 * Nada de esto puede bloquear el login: si el usuario niega el permiso, está en
 * un emulador o FCM no está configurado, la app sigue funcionando sin avisos.
 */

const CLAVE_TOKEN = "dizelf.push.token";
const CLAVE_DISPOSITIVO = "dizelf.dispositivo";
const CANAL = "modelos-ar";

/** Evita dos registros simultáneos (login + foco de la lista). */
let registrando: Promise<void> | null = null;
/** Último token enviado en esta ejecución: no se repite el POST en cada foco. */
let tokenRegistrado: string | null = null;

/**
 * Se ejecuta al importar el módulo: Expo exige el handler antes de mostrar
 * cualquier notificación. En foreground mostramos banner y lista; el sonido lo
 * decide el propio mensaje.
 */
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Canal de Android con importancia alta: sin canal, Android 8+ descarta el aviso. */
async function prepararCanal(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CANAL, {
    name: "Modelos 3D",
    description: "Avisos cuando un proyecto publica un modelo nuevo.",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22d3ee",
  });
}

async function asegurarPermiso(): Promise<boolean> {
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;

  // En Android 13+ esto abre el diálogo de POST_NOTIFICACIONES; en iOS el de
  // alertas. Si ya se rechazó, el sistema no lo vuelve a mostrar y devuelve
  // `granted: false` sin molestar.
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

/** Id estable de esta instalación (el backend lo usa para rotar tokens). */
async function obtenerDispositivoId(): Promise<string> {
  const guardado = await SecureStore.getItemAsync(CLAVE_DISPOSITIVO);
  if (guardado) return guardado;

  const nuevo = Crypto.randomUUID();
  await SecureStore.setItemAsync(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

/**
 * Registra el dispositivo para el usuario de la sesión.
 *
 * Best-effort: cualquier fallo se registra en consola de desarrollo y se
 * ignora. Se llama después del login y al abrir la app con sesión activa (el
 * token de Expo puede rotar).
 */
export async function registrarPush(tokenSesion: string): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;
  if (registrando) return registrando;

  registrando = (async () => {
    try {
      if (!API_BASE) return;

      await prepararCanal();

      if (!(await asegurarPermiso())) return;

      const projectId = (
        Constants.expoConfig?.extra as
          | { eas?: { projectId?: string } }
          | undefined
      )?.eas?.projectId;

      if (!projectId) {
        if (__DEV__) {
          console.warn("Push: falta extra.eas.projectId en app.json.");
        }
        return;
      }

      const { data: tokenExpo } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      if (tokenExpo === tokenRegistrado) return;

      await pedir("/notificaciones/dispositivos", {
        metodo: "POST",
        token: tokenSesion,
        cuerpo: {
          token: tokenExpo,
          plataforma: Platform.OS === "ios" ? "ios" : "android",
          dispositivoId: await obtenerDispositivoId(),
        },
      });

      tokenRegistrado = tokenExpo;
      await SecureStore.setItemAsync(CLAVE_TOKEN, tokenExpo);
    } catch (error) {
      if (__DEV__) {
        console.warn(
          `Push: no se pudo registrar el dispositivo (${(error as Error).message}).`
        );
      }
    }
  })().finally(() => {
    registrando = null;
  });

  return registrando;
}

/**
 * Da de baja el token del usuario actual antes de borrar la sesión.
 *
 * Se lee del SecureStore porque `getExpoPushTokenAsync` puede fallar si el
 * permiso se revocó; el token guardado alcanza para borrar la fila.
 */
export async function darDeBajaPush(tokenSesion: string): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const tokenExpo = await SecureStore.getItemAsync(CLAVE_TOKEN);
    if (!tokenExpo || !API_BASE) return;

    await pedir("/notificaciones/dispositivos", {
      metodo: "DELETE",
      token: tokenSesion,
      cuerpo: { token: tokenExpo },
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `Push: no se pudo dar de baja el dispositivo (${(error as Error).message}).`
      );
    }
  } finally {
    tokenRegistrado = null;
    await SecureStore.deleteItemAsync(CLAVE_TOKEN).catch(() => undefined);
  }
}

/**
 * Ruta interna a abrir cuando el usuario toca la notificación.
 *
 * Solo se aceptan avisos de modelo y rutas `/plano`: el contenido viene del
 * backend, pero validarlo evita que un payload manipulado navegue a otra
 * pantalla.
 */
export function rutaDeNotificacion(datos: unknown): string | null {
  if (!datos || typeof datos !== "object") return null;

  const { tipo, url } = datos as { tipo?: unknown; url?: unknown };
  if (tipo !== "modelo-ar") return null;
  if (typeof url !== "string" || !url.startsWith("/plano")) return null;

  return url;
}
