import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R, S, T, sombra } from "../lib/tema";

/**
 * Puerta de permiso de Android.
 *
 * Si la cámara está denegada no se monta el WebView: abrirlo solo mostraría una
 * pantalla negra sin explicación (fue el bug del GATE 1). Se ofrecen las dos
 * salidas reales: reintentar (si fue un "no" pasajero) o abrir los ajustes del
 * sistema (si quedó marcado "no volver a preguntar").
 */
export function PuertaPermiso({
  motivo,
  onReintentar,
}: {
  motivo: string;
  onReintentar: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.contenedor,
        {
          paddingTop: insets.top + S.xl,
          paddingBottom: insets.bottom + S.xl,
        },
      ]}
    >
      <View style={styles.icono}>
        <View style={styles.lente} />
      </View>

      <Text style={styles.titulo}>Falta el permiso de cámara</Text>
      <Text style={styles.texto}>{motivo}</Text>
      <Text style={styles.nota}>
        Dizelf no graba ni envía vídeo: usa la cámara solo para ubicar el modelo
        sobre tu piso.
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onReintentar}
        style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
      >
        <Text style={styles.botonTexto}>Volver a pedir permiso</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openSettings()}
        style={({ pressed }) => [
          styles.botonSecundario,
          pressed && styles.presionado,
        ]}
      >
        <Text style={styles.botonTextoSecundario}>Abrir ajustes del sistema</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    backgroundColor: C.fondo,
    paddingHorizontal: S.xl,
  },
  icono: {
    width: 64,
    height: 64,
    borderRadius: R.grande,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.acentoFondo,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.35)",
    marginBottom: S.xs,
  },
  lente: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.acento,
  },
  titulo: { color: C.texto, ...T.titulo, textAlign: "center" },
  texto: {
    color: C.textoSeco,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  nota: {
    color: C.textoDebil,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: S.xs,
  },
  boton: {
    alignSelf: "stretch",
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    marginTop: S.xs,
    borderRadius: R.chico,
    backgroundColor: C.acento,
    ...sombra,
  },
  botonTexto: { color: C.sobreAcento, fontSize: 15, fontWeight: "700" },
  botonSecundario: {
    alignSelf: "stretch",
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    borderRadius: R.chico,
    borderWidth: 1,
    borderColor: C.borde,
  },
  botonTextoSecundario: { color: C.textoSeco, fontSize: 13, fontWeight: "600" },
  presionado: { opacity: 0.7 },
});
