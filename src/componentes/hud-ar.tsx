import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R, S } from "../lib/tema";

export type TonoHud = "ok" | "aviso" | "error";

const COLOR: Record<TonoHud, string> = {
  ok: C.ok,
  aviso: C.aviso,
  error: C.error,
};

/**
 * Estado de la AR sobre la escena.
 *
 * En el APK no hay consola ni barra del navegador, así que este texto es la
 * única señal de qué está pasando: modelo cargado, tracking perdido o error del
 * motor. Se alimenta de los mensajes de `puente.ts`.
 *
 * Usa `insets.top` para no quedar debajo de la barra de estado, y se corre
 * 44 px más abajo para no pisar el botón de volver: el visor es a pantalla
 * completa y el notch tapaba el chip.
 */
export function HudAr({
  mensaje,
  tono,
}: {
  mensaje: string;
  tono: TonoHud;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="none"
      style={[styles.contenedor, { paddingTop: insets.top + 44 }]}
    >
      <View style={styles.chip}>
        <View style={[styles.punto, { backgroundColor: COLOR[tono] }]} />
        <Text numberOfLines={2} style={styles.texto}>
          {mensaje}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: "absolute",
    top: 0,
    left: S.md,
    right: S.md,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.xs,
    maxWidth: "100%",
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    backgroundColor: "rgba(7,13,24,0.78)",
  },
  texto: { color: C.texto, fontSize: 12, fontWeight: "500" },
  punto: { width: 7, height: 7, borderRadius: 4 },
});
