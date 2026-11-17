import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { C } from "../lib/tema";

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
