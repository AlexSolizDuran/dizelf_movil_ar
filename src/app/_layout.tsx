import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Stack, router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { rutaDeNotificacion } from "../lib/push";
import { C } from "../lib/tema";

/** Avisos ya procesados: el listener y el arranque en frío pueden repetir el tap. */
const procesadas = new Set<string>();

/**
 * Navegación de la app.
 *
 * Tres rutas: la lista de proyectos (`index`), el login y la pantalla de AR a
 * pantalla completa. Sin headers nativos: la app es un visor, no un formulario,
 * y en la AR cualquier barra le roba píxeles a la cámara.
 *
 * `SafeAreaProvider` va en la raíz porque las pantallas necesitan los insets
 * reales del teléfono: sin eso la barra de controles de la AR queda debajo de
 * los botones de Android y deja de responder.
 */
export default function Layout() {
  /**
   * Abre el plano del proyecto al tocar una notificación.
   *
   * `getLastNotificationResponseAsync` cubre el arranque en frío (la app estaba
   * cerrada); el listener cubre la app en segundo plano o abierta.
   */
  useEffect(() => {
    const abrir = (respuesta: Notifications.NotificationResponse | null) => {
      if (!respuesta) return;

      const id = respuesta.notification.request.identifier;
      if (procesadas.has(id)) return;
      procesadas.add(id);

      const ruta = rutaDeNotificacion(
        respuesta.notification.request.content.data
      );
      if (ruta) router.push(ruta as Href);
    };

    const suscripcion =
      Notifications.addNotificationResponseReceivedListener(abrir);

    void Notifications.getLastNotificationResponseAsync().then((respuesta) => {
      if (!respuesta) return;
      abrir(respuesta);
      void Notifications.clearLastNotificationResponseAsync();
    });

    return () => suscripcion.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.fondo },
        }}
      />
    </SafeAreaProvider>
  );
}
