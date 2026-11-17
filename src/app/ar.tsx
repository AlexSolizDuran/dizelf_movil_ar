import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArWebView, type RefWebView } from "../componentes/ar-webview";
import { BarraAr } from "../componentes/barra-ar";
import { HudAr, type TonoHud } from "../componentes/hud-ar";
import { PuertaPermiso } from "../componentes/puerta-permiso";
import { URL_AR3D } from "../lib/api";
import { prepararModelo } from "../lib/modelo";
import { jsDeComando, type ComandoWeb, type MensajeWeb } from "../lib/puente";
import { leerSesion } from "../lib/sesion";
import { C, R, S, T, sombra } from "../lib/tema";

type Fase = "iniciando" | "permiso" | "preparando" | "listo" | "error";

/**
 * Pantalla de AR.
 *
 * ORDEN QUE NO SE PUEDE ALTERAR
 * -----------------------------
 * 1. Permiso **de Android** (acá, en RN).
 * 2. Modelo: `/modelo/meta`, caché local y URL prefirmada del bucket.
 * 3. Montar el WebView: recién con 1 y 2 resueltos.
 * 4. El permiso **de la web** sigue siendo aparte: la página pide la cámara en
 *    su botón "Iniciar AR" (con `?auto=1` lo intenta sola porque el WebView ya
 *    concede el acceso con `mediaCapturePermissionGrantType="grant"`).
 *
 * Con `demo=1` no hay backend ni sesión: sirve para el GATE 2 (M1), que solo
 * comprueba que la cámara abra dentro del APK.
 */
export default function Ar() {
  const { proyectoId, nombre, demo } = useLocalSearchParams<{
    proyectoId?: string;
    nombre?: string;
    demo?: string;
  }>();

  const esDemo = demo === "1";
  const referencia = useRef<RefWebView | null>(null);
  const insets = useSafeAreaInsets();

  const [fase, setFase] = useState<Fase>("iniciando");
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motivoPermiso, setMotivoPermiso] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [hud, setHud] = useState<{ mensaje: string; tono: TonoHud }>({
    mensaje: "Iniciando motor AR…",
    tono: "aviso",
  });
  const [bloqueado, setBloqueado] = useState(false);
  const [escala, setEscala] = useState(1);

  const iniciar = useCallback(async () => {
    setError(null);
    setMotivoPermiso(null);
    setFase("iniciando");

    const concedido = await pedirPermisoCamara();
    if (!concedido) {
      setMotivoPermiso(
        "Android no le dio la cámara a la app. Sin eso la realidad aumentada no puede arrancar."
      );
      setFase("permiso");
      return;
    }

    setFase("preparando");
    try {
      if (esDemo) {
        setUri(`${URL_AR3D}?modelo=demo&auto=1`);
        setFase("listo");
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

      // `glb` es una URL prefirmada del bucket: la página la carga directo y el
      // token de sesión nunca entra a la URL del WebView.
      setUri(`${URL_AR3D}?glb=${encodeURIComponent(modelo.url)}&auto=1`);
      setFase("listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar el modelo.");
      setFase("error");
    }
  }, [esDemo, proyectoId]);

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  const alRecibir = useCallback((mensaje: MensajeWeb) => {
    switch (mensaje.tipo) {
      case "modelo-listo": {
        setEscala(mensaje.escala);
        // Las medidas son la única pista cuando el modelo "desaparece": si
        // miden 840 m, el GLB vino en centímetros; si miden 0.02 m, al revés.
        const m = mensaje.tam;
        const medida = m
          ? `${m.x.toFixed(1)} × ${m.z.toFixed(1)} × ${m.y.toFixed(1)} m`
          : `${mensaje.escala.toFixed(1)}×`;
        setHud({
          mensaje: mensaje.aviso ?? `Modelo listo · ${medida}`,
          tono: mensaje.aviso ? "aviso" : "ok",
        });
        break;
      }
      case "tracking":
        // 8th Wall no tiene estado "perdido": mientras arranca manda LIMITED
        // con reason INITIALIZING, que es normal y no hay que alarmar.
        setHud(
          mensaje.valor === "ok"
            ? { mensaje: "Tracking estable · caminá alrededor", tono: "ok" }
            : mensaje.motivo === "inicializando"
              ? {
                  mensaje: "Calibrando · mové el teléfono de adelante hacia atrás",
                  tono: "aviso",
                }
              : {
                  mensaje: "Tracking limitado · más luz y textura, movete despacio",
                  tono: "aviso",
                }
        );
        break;
      case "error":
        setHud({ mensaje: mensaje.motivo, tono: "error" });
        break;
    }
  }, []);

  const alComandar = useCallback((comando: ComandoWeb) => {
    // Estado optimista: el botón responde aunque la web tarde un frame.
    if (comando.tipo === "bloquear") setBloqueado(comando.valor);
    if (comando.tipo === "escala") setEscala(comando.valor);
    referencia.current?.injectJavaScript(jsDeComando(comando));
  }, []);

  return (
    <View style={styles.contenedor}>
      {fase === "listo" && uri ? (
        <ArWebView
          onFallo={(motivo) => {
            setError(motivo);
            setFase("error");
          }}
          onMensaje={alRecibir}
          referencia={referencia}
          uri={uri}
        />
      ) : null}

      {fase === "listo" ? (
        <>
          <HudAr mensaje={hud.mensaje} tono={hud.tono} />
          <BarraAr
            bloqueado={bloqueado}
            escala={escala}
            onComando={alComandar}
          />
        </>
      ) : null}

      {fase === "iniciando" || fase === "preparando" ? (
        <View style={styles.centro}>
          <View style={styles.marca}>
            <Text style={styles.marcaTexto}>AR</Text>
          </View>
          <ActivityIndicator color={C.acento} size="large" />
          <Text style={styles.estado}>
            {fase === "iniciando"
              ? "Pidiendo permiso de cámara…"
              : progreso > 0 && progreso < 1
                ? `Descargando modelo… ${Math.round(progreso * 100)}%`
                : "Preparando el modelo…"}
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

      {fase === "permiso" && motivoPermiso ? (
        <PuertaPermiso motivo={motivoPermiso} onReintentar={() => void iniciar()} />
      ) : null}

      {fase === "error" ? (
        <View style={styles.centro}>
          <View style={styles.tarjetaError}>
            <Text style={styles.tituloError}>No se pudo abrir la AR</Text>
            <Text style={styles.estado}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void iniciar()}
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

/**
 * Permiso de Android.
 *
 * Es la primera capa; la segunda es el `getUserMedia` de la página. Si esta
 * falla, el WebView ni se monta: aparecería negro sin explicación.
 */
async function pedirPermisoCamara(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const resultado = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: "Cámara para realidad aumentada",
      message:
        "Dizelf usa la cámara para anclar el modelo a tu piso. No se graba ni se envía nada.",
      buttonPositive: "Permitir",
      buttonNegative: "Cancelar",
    }
  );

  return resultado === PermissionsAndroid.RESULTS.GRANTED;
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#000" },
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
  marcaTexto: { color: C.acento, fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
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
