import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { URL_AR3D } from "../lib/api";
import { prepararModelo } from "../lib/modelo";
import { leerSesion } from "../lib/sesion";
import { C, R, S, T, sombra } from "../lib/tema";

/**
 * Vista 3D del plano (sin cámara, sin SLAM).
 *
 * Es la vista «de juego»: la cámara vuela sobre el modelo y lo atraviesa; la
 * única física es el piso. Vive en la misma página que la AR (`plano.html`) para
 * no duplicar el cargador de GLB ni el decodificador Draco, y así también se
 * puede abrir en Chrome para depurar.
 *
 * No pide permiso de cámara a propósito: acá no se usa.
 */
export default function Plano3D() {
  const { proyectoId, nombre, demo } = useLocalSearchParams<{
    proyectoId?: string;
    nombre?: string;
    demo?: string;
  }>();

  const esDemo = demo === "1";
  const insets = useSafeAreaInsets();

  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState(0);

  const preparar = useCallback(async () => {
    setError(null);
    setCargando(true);
    setProgreso(0);

    try {
      if (esDemo) {
        setUri(`${URL_AR3D}plano.html?modelo=demo`);
        setCargando(false);
        return;
      }

      if (!proyectoId) {
        throw new Error("Falta el proyecto. Volvé a la lista e intentá de nuevo.");
      }

      const sesion = await leerSesion();
      if (!sesion) {
        router.replace("/login");
        return;
      }

      const modelo = await prepararModelo({
        proyectoId,
        token: sesion.token,
        alProgresar: setProgreso,
      });

      setUri(`${URL_AR3D}plano.html?glb=${encodeURIComponent(modelo.url)}`);
      setCargando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la vista 3D.");
      setCargando(false);
    }
  }, [esDemo, proyectoId]);

  useEffect(() => {
    void preparar();
  }, [preparar]);

  return (
    <View style={styles.contenedor}>
      {uri ? (
        <WebView
          androidLayerType="hardware"
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
          onError={() => setError("No se pudo cargar la vista 3D.")}
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          source={{ uri }}
          style={styles.webview}
        />
      ) : null}

      {cargando ? (
        <View style={styles.centro}>
          <View style={styles.marca}>
            <Text style={styles.marcaTexto}>3D</Text>
          </View>
          <ActivityIndicator color={C.acento} size="large" />
          <Text style={styles.estado}>
            {progreso > 0 && progreso < 1
              ? `Descargando modelo… ${Math.round(progreso * 100)}%`
              : "Preparando la vista 3D…"}
          </Text>
          {progreso > 0 && progreso < 1 ? (
            <View style={styles.pista}>
              <View
                style={[
                  styles.pistaRelleno,
                  { width: `${Math.round(progreso * 100)}%` as DimensionValue },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={styles.centro}>
          <View style={styles.tarjetaError}>
            <Text style={styles.tituloError}>No se pudo abrir la vista 3D</Text>
            <Text style={styles.estado}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void preparar()}
              style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
            >
              <Text style={styles.botonTexto}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.volver,
          { top: insets.top + S.xs },
          pressed && styles.presionado,
        ]}
      >
        <Text style={styles.volverTexto}>‹ {nombre ?? "Volver"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#070d18" },
  webview: { flex: 1, backgroundColor: "#070d18" },

  centro: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    backgroundColor: C.fondo,
    padding: S.xl,
  },
  marca: {
    width: 56,
    height: 56,
    borderRadius: R.medio,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.acentoFondo,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.35)",
    marginBottom: S.xs,
  },
  marcaTexto: { color: C.acento, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  estado: {
    color: C.textoSeco,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  pista: {
    width: "70%",
    height: 4,
    borderRadius: 2,
    backgroundColor: C.panelAlto,
    overflow: "hidden",
    marginTop: S.xs,
  },
  pistaRelleno: { height: 4, backgroundColor: C.acento },

  tarjetaError: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: S.xs,
    padding: S.lg,
    borderRadius: R.grande,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: C.panel,
    ...sombra,
  },
  tituloError: { color: C.error, ...T.titulo },
  boton: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    marginTop: S.sm,
    borderRadius: R.chico,
    backgroundColor: C.acento,
  },
  botonTexto: { color: C.sobreAcento, fontSize: 14, fontWeight: "700" },

  volver: {
    position: "absolute",
    left: S.sm,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    backgroundColor: "rgba(7,13,24,0.78)",
  },
  volverTexto: { color: C.texto, fontSize: 12, fontWeight: "600" },

  presionado: { opacity: 0.7 },
});
