import type { ComponentRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

/** Tipo de la instancia del WebView (la clase es genérica: `WebView<P>`). */
export type RefWebView = ComponentRef<typeof WebView>;
import { leerMensaje, type MensajeWeb } from "../lib/puente";

interface Props {
  uri: string;
  /** Ref para inyectar comandos (`jsDeComando`). */
  referencia: React.RefObject<RefWebView | null>;
  onMensaje: (mensaje: MensajeWeb) => void;
  onFallo: (motivo: string) => void;
}

/**
 * La escena 3D, a pantalla completa.
 *
 * PROPS QUE NO SON DECORACIÓN
 * ---------------------------
 * - `mediaCapturePermissionGrantType="grant"`: concede a la página el acceso a
 *   la cámara que ya autorizó Android. Sin esto, `getUserMedia` vuelve a fallar
 *   aunque el permiso nativo esté dado (son dos capas, ver §14.3 del plan).
 * - `allowsInlineMediaPlayback` y `mediaPlaybackRequiresUserAction={false}`:
 *   sin esto Android puede bloquear el canvas inline de la escena.
 * - `androidLayerType="hardware"`: sin GPU, la escena cae a 5-10 fps.
 *
 * El WebView NO sabe de modelos ni de API: recibe una URL ya resuelta (la que
 * arma la pantalla de AR) y devuelve mensajes del protocolo.
 */
export function ArWebView({ uri, referencia, onMensaje, onFallo }: Props) {
  const alRecibirMensaje = (evento: WebViewMessageEvent) => {
    const mensaje = leerMensaje(evento.nativeEvent.data);
    // Un mensaje desconocido no rompe la AR: se ignora.
    if (mensaje) onMensaje(mensaje);
  };

  return (
    <WebView
      ref={referencia}
      allowFileAccess
      allowsInlineMediaPlayback
      androidLayerType="hardware"
      domStorageEnabled
      javaScriptEnabled
      mediaCapturePermissionGrantType="grant"
      // Sin esto el canvas inline de la escena puede quedar bloqueado.
      // Para depurar la página: Android ya vuelca su consola a logcat como
      // `chromium: [INFO:CONSOLE(...)] "mensaje"`, no hace falta puente.
      mediaPlaybackRequiresUserAction={false}
      onError={(evento) =>
        onFallo(
          evento.nativeEvent.description ||
            "No se pudo cargar el visor de AR."
        )
      }
      onHttpError={(evento) =>
        onFallo(
          `El visor respondió ${evento.nativeEvent.statusCode}. Revisá tu conexión.`
        )
      }
      onMessage={alRecibirMensaje}
      originWhitelist={["*"]}
      setSupportMultipleWindows={false}
      source={{ uri }}
      style={styles.webview}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#000" },
});
