import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComandoWeb } from "../lib/puente";
import { C, R, S, sombra } from "../lib/tema";

/**
 * Controles de la escena, en nativo.
 *
 * Cada botón manda un comando del protocolo congelado (`puente.js`), no una
 * llamada directa a la escena: la app no conoce IDs ni estado del grafo 3D.
 * `bloquear` y `escala` necesitan estado, así que vive acá y se refleja en el
 * estilo del botón.
 *
 * La barra se apoya en `insets.bottom`: con `bottom: 28` fijo quedaba debajo de
 * los botones de Android y no se podía tocar.
 */
export function BarraAr({
  bloqueado,
  escala,
  onComando,
}: {
  bloqueado: boolean;
  escala: number;
  onComando: (comando: ComandoWeb) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.contenedor, { paddingBottom: insets.bottom + S.sm }]}>
      <View style={styles.barra}>
        <Boton
          etiqueta="Recentrar"
          glifo="⌖"
          onPress={() => onComando({ tipo: "recentrar" })}
        />
        <Boton
          activo={bloqueado}
          etiqueta={bloqueado ? "Fijo" : "Fijar"}
          glifo="⌾"
          onPress={() => onComando({ tipo: "bloquear", valor: !bloqueado })}
        />
        <Boton
          etiqueta="Reset"
          glifo="↺"
          onPress={() => onComando({ tipo: "reset" })}
        />

        <View style={styles.separador} />

        <View style={styles.escala}>
          <Boton
            compacto
            etiqueta="Achicar"
            glifo="−"
            onPress={() =>
              onComando({
                tipo: "escala",
                valor: Math.round((escala - 0.1) * 100) / 100,
              })
            }
          />
          <Text style={styles.escalaTexto}>{escala.toFixed(1)}×</Text>
          <Boton
            compacto
            etiqueta="Agrandar"
            glifo="+"
            onPress={() =>
              onComando({
                tipo: "escala",
                valor: Math.round((escala + 0.1) * 100) / 100,
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

function Boton({
  etiqueta,
  glifo,
  onPress,
  activo = false,
  compacto = false,
}: {
  etiqueta: string;
  glifo: string;
  onPress: () => void;
  activo?: boolean;
  compacto?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={etiqueta}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        compacto && styles.botonCompacto,
        activo && styles.botonActivo,
        pressed && styles.botonPresionado,
      ]}
    >
      <Text style={[styles.glifo, activo && styles.glifoActivo]}>{glifo}</Text>
      {compacto ? null : (
        <Text style={[styles.etiqueta, activo && styles.etiquetaActiva]}>
          {etiqueta}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: "absolute",
    left: S.sm,
    right: S.sm,
    bottom: 0,
    alignItems: "center",
  },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.xs,
    borderRadius: R.grande,
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    backgroundColor: "rgba(7,13,24,0.86)",
    padding: S.xs,
    ...sombra,
  },
  boton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 62,
    gap: 2,
    borderRadius: R.medio,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: S.xs,
    paddingVertical: 6,
  },
  botonCompacto: { minWidth: 36, paddingHorizontal: 6 },
  botonActivo: {
    borderColor: "rgba(34,211,238,0.45)",
    backgroundColor: C.acentoFondo,
  },
  botonPresionado: { opacity: 0.55 },
  glifo: { color: C.textoSeco, fontSize: 17, lineHeight: 20 },
  glifoActivo: { color: C.acento },
  etiqueta: { color: C.textoDebil, fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },
  etiquetaActiva: { color: C.acento },
  separador: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: S.xs,
    backgroundColor: C.borde,
  },
  escala: { flexDirection: "row", alignItems: "center", gap: 2 },
  escalaTexto: {
    color: C.texto,
    fontSize: 12,
    fontWeight: "700",
    minWidth: 38,
    textAlign: "center",
  },
});
