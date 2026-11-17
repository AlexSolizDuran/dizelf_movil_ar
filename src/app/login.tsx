import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { iniciarSesion } from "../lib/sesion";
import { C, R, S, T, sombra } from "../lib/tema";

/**
 * Login.
 *
 * Usa `POST /auth/token`, el endpoint que devuelve el JWT en el cuerpo: el
 * `/auth/login` del web solo lo entrega en una cookie httpOnly que la app no
 * puede leer (§14.9 del plan).
 */
export default function Login() {
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const insets = useSafeAreaInsets();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const completo = identificador.length > 0 && password.length > 0;

  const entrar = async () => {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(identificador.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.contenedor}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + S.xl, paddingBottom: insets.bottom + S.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.marca}>
          <Text style={styles.marcaTexto}>AR</Text>
        </View>
        <Text style={styles.titulo}>Dizelf AR</Text>
        <Text style={styles.subtitulo}>
          Entrá con tu cuenta de Dizelf para ver tus proyectos en el piso, en
          tamaño real.
        </Text>

        <View style={styles.tarjeta}>
          <Text style={styles.etiqueta}>USUARIO O CORREO</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect={false}
            editable={!enviando}
            onChangeText={setIdentificador}
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="tu usuario"
            placeholderTextColor={C.textoDebil}
            returnKeyType="next"
            style={styles.input}
            value={identificador}
          />

          <Text style={[styles.etiqueta, styles.etiquetaSeparada]}>
            CONTRASEÑA
          </Text>
          <View style={styles.inputFila}>
            <TextInput
              autoComplete="current-password"
              editable={!enviando}
              onChangeText={setPassword}
              onSubmitEditing={() => void entrar()}
              placeholder="tu contraseña"
              placeholderTextColor={C.textoDebil}
              ref={passwordRef}
              returnKeyType="go"
              secureTextEntry={!verPassword}
              style={styles.inputInterno}
              value={password}
            />
            <Pressable
              accessibilityLabel={
                verPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setVerPassword((v) => !v)}
              style={({ pressed }) => [
                styles.ojo,
                pressed && styles.presionado,
              ]}
            >
              <Text style={styles.ojoTexto}>{verPassword ? "Ocultar" : "Ver"}</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.alerta} role="alert">
              <Text style={styles.alertaTexto}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={enviando || !completo}
            onPress={() => void entrar()}
            style={({ pressed }) => [
              styles.boton,
              (enviando || !completo) && styles.botonApagado,
              pressed && styles.presionado,
            ]}
          >
            {enviando ? (
              <ActivityIndicator color={C.sobreAcento} />
            ) : (
              <Text style={styles.botonTexto}>Entrar</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.pie}>
          Es la misma cuenta que usás en el editor web.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: C.fondo },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: S.lg,
  },

  marca: {
    alignSelf: "flex-start",
    width: 52,
    height: 52,
    borderRadius: R.medio,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.acentoFondo,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.35)",
    marginBottom: S.md,
  },
  marcaTexto: { color: C.acento, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },

  titulo: { color: C.texto, ...T.marca },
  subtitulo: {
    color: C.textoDebil,
    fontSize: 13,
    lineHeight: 20,
    marginTop: S.xs,
    marginBottom: S.xl,
    maxWidth: 320,
  },

  tarjeta: {
    borderRadius: R.grande,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.panel,
    padding: S.md,
    ...sombra,
  },
  etiqueta: { color: C.textoDebil, ...T.etiqueta, marginBottom: S.xs },
  etiquetaSeparada: { marginTop: S.md },

  input: {
    borderRadius: R.chico,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.panelAlto,
    color: C.texto,
    fontSize: 15,
    paddingHorizontal: S.sm,
    paddingVertical: Platform.OS === "ios" ? S.sm : S.xs + 2,
  },
  inputFila: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: R.chico,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.panelAlto,
    paddingRight: S.xs,
  },
  inputInterno: {
    flex: 1,
    color: C.texto,
    fontSize: 15,
    paddingHorizontal: S.sm,
    paddingVertical: Platform.OS === "ios" ? S.sm : S.xs + 2,
  },
  ojo: { paddingHorizontal: S.sm, paddingVertical: S.xs },
  ojoTexto: { color: C.acento, fontSize: 12, fontWeight: "700" },

  alerta: {
    marginTop: S.md,
    padding: S.sm,
    borderRadius: R.chico,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: C.errorFondo,
  },
  alertaTexto: { color: C.error, fontSize: 12, lineHeight: 18 },

  boton: {
    marginTop: S.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: R.chico,
    backgroundColor: C.acento,
  },
  botonApagado: { opacity: 0.45 },
  botonTexto: { color: C.sobreAcento, fontSize: 15, fontWeight: "700" },

  pie: {
    color: C.textoDebil,
    fontSize: 11,
    textAlign: "center",
    marginTop: S.lg,
  },

  presionado: { opacity: 0.7 },
});
