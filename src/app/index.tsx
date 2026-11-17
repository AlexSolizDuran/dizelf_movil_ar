import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pedir } from "../lib/api";
import { cerrarSesion, leerSesion, type Sesion } from "../lib/sesion";
import { C, R, S, T, sombra } from "../lib/tema";
import type { ProyectoLista, ProyectosPaginados } from "../tipos";

/**
 * Proyectos que el usuario puede abrir en AR.
 *
 * La lista NO sabe si cada proyecto tiene modelo publicado: se averigua al
 * entrar (el `meta` se pide ahí). Pedirlo para 50 proyectos al abrir la lista
 * serían 50 peticiones para pintar un dato secundario (ver §14.9, opcional).
 */
export default function Proyectos() {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined);
  const [proyectos, setProyectos] = useState<ProyectoLista[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const insets = useSafeAreaInsets();

  const cargar = useCallback(async (activa: Sesion) => {
    setCargando(true);
    try {
      const pagina = await pedir<ProyectosPaginados>(
        "/proyectos?limite=50",
        { token: activa.token }
      );
      setProyectos(pagina.datos);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void leerSesion().then((activa) => {
      setSesion(activa);
      if (activa) void cargar(activa);
    });
  }, [cargar]);

  // Al volver de la AR (o del login) se refresca: otro dispositivo pudo
  // publicar un modelo nuevo.
  useFocusEffect(
    useCallback(() => {
      void leerSesion().then((activa) => {
        setSesion(activa);
        if (activa) void cargar(activa);
      });
    }, [cargar])
  );

  if (sesion === undefined) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.acento} />
      </View>
    );
  }

  if (sesion === null) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + S.sm }]}>
      <View style={styles.cabecera}>
        <View style={styles.marcaFila}>
          <View style={styles.marca}>
            <Text style={styles.marcaTexto}>AR</Text>
          </View>
          <View style={styles.marcaTextos}>
            <Text style={styles.titulo}>Dizelf AR</Text>
            <Text style={styles.subtitulo} numberOfLines={1}>
              {sesion.usuario.persona.nombre}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await cerrarSesion();
            setSesion(null);
          }}
          style={({ pressed }) => [styles.salir, pressed && styles.presionado]}
        >
          <Text style={styles.salirTexto}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.etiqueta}>PROYECTOS</Text>
        <Text style={styles.contador}>
          {proyectos.length} disponible{proyectos.length === 1 ? "" : "s"}
        </Text>
      </View>

      {error ? (
        <View style={styles.alerta} role="alert">
          <Text style={styles.alertaTexto}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={[
          styles.lista,
          { paddingBottom: insets.bottom + S.xl },
        ]}
        data={proyectos}
        keyExtractor={(proyecto) => proyecto.id}
        ListEmptyComponent={
          cargando ? undefined : (
            <View style={styles.vacio}>
              <Text style={styles.vacioTitulo}>Todavía no hay proyectos</Text>
              <Text style={styles.vacioTexto}>
                Creá uno en el editor web y aparecerá acá para verlo en realidad
                aumentada.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/ar", params: { demo: "1" } })}
            style={({ pressed }) => [
              styles.demo,
              pressed && styles.presionado,
            ]}
          >
            <View style={styles.demoIcono}>
              <View style={styles.demoCubo} />
            </View>
            <View style={styles.demoTextos}>
              <Text style={styles.demoTitulo}>Probar el motor</Text>
              <Text style={styles.demoSub}>
                Demo de 1 m · no gasta datos
              </Text>
            </View>
            <Text style={styles.demoFlecha}>›</Text>
          </Pressable>
        }
        refreshControl={
          <RefreshControl
            colors={[C.acento]}
            onRefresh={() => void cargar(sesion)}
            progressBackgroundColor={C.panel}
            refreshing={cargando}
            tintColor={C.acento}
          />
        }
        renderItem={({ item }) => {
          const inicial = item.nombre.trim().charAt(0).toUpperCase() || "?";
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/ar",
                  params: { proyectoId: item.id, nombre: item.nombre },
                })
              }
              style={({ pressed }) => [styles.fila, pressed && styles.presionado]}
            >
              <View style={styles.inicial}>
                <Text style={styles.inicialTexto}>{inicial}</Text>
              </View>

              <View style={styles.filaTexto}>
                <Text numberOfLines={1} style={styles.nombre}>
                  {item.nombre}
                </Text>
                <View style={styles.metaFila}>
                  <View
                    style={[
                      styles.chip,
                      item.miRol === "EDITOR" ? styles.chipEditor : styles.chipCreador,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipTexto,
                        item.miRol === "EDITOR"
                          ? styles.chipTextoEditor
                          : styles.chipTextoCreador,
                      ]}
                    >
                      {item.miRol}
                    </Text>
                  </View>
                  {item.totalColaboradores > 0 ? (
                    <Text style={styles.meta}>
                      {item.totalColaboradores} colaborador
                      {item.totalColaboradores === 1 ? "" : "es"}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.acciones}>
                <Pressable
                  accessibilityLabel={`Ver ${item.nombre} en 3D`}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/plano",
                      params: { proyectoId: item.id, nombre: item.nombre },
                    })
                  }
                  style={({ pressed }) => [
                    styles.vista3d,
                    pressed && styles.presionado,
                  ]}
                >
                  <Text style={styles.vista3dTexto}>3D</Text>
                </Pressable>

                <View style={styles.abrir}>
                  <Text style={styles.abrirTexto}>Abrir</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: C.fondo },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.fondo,
  },

  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
  },
  marcaFila: { flexDirection: "row", alignItems: "center", gap: S.sm, flex: 1 },
  marca: {
    width: 42,
    height: 42,
    borderRadius: R.medio,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.acentoFondo,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.35)",
  },
  marcaTexto: { color: C.acento, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  marcaTextos: { flex: 1 },
  titulo: { color: C.texto, ...T.marca },
  subtitulo: { color: C.textoDebil, ...T.chico, marginTop: 2 },

  salir: {
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borde,
  },
  salirTexto: { color: C.textoSeco, fontSize: 12, fontWeight: "600" },

  seccion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: S.lg,
    paddingBottom: S.sm,
  },
  etiqueta: { color: C.textoDebil, ...T.etiqueta },
  contador: { color: C.textoDebil, ...T.chico },

  alerta: {
    marginHorizontal: S.lg,
    marginBottom: S.sm,
    padding: S.sm,
    borderRadius: R.chico,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: C.errorFondo,
  },
  alertaTexto: { color: C.error, fontSize: 12 },

  lista: { paddingHorizontal: S.md, gap: S.sm },

  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    borderRadius: R.grande,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.panel,
    padding: S.md,
    ...sombra,
  },
  inicial: {
    width: 40,
    height: 40,
    borderRadius: R.medio,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panelAlto,
    borderWidth: 1,
    borderColor: C.borde,
  },
  inicialTexto: { color: C.textoSeco, fontSize: 16, fontWeight: "700" },
  filaTexto: { flex: 1, gap: 6 },
  nombre: { color: C.texto, fontSize: 16, fontWeight: "600" },
  metaFila: { flexDirection: "row", alignItems: "center", gap: S.xs },
  meta: { color: C.textoDebil, fontSize: 11 },

  chip: {
    paddingHorizontal: S.xs,
    paddingVertical: 2,
    borderRadius: R.pill,
    borderWidth: 1,
  },
  chipEditor: {
    backgroundColor: C.acentoFondo,
    borderColor: "rgba(34,211,238,0.35)",
  },
  chipCreador: {
    backgroundColor: "rgba(52,211,153,0.10)",
    borderColor: "rgba(52,211,153,0.30)",
  },
  chipTexto: { fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  chipTextoEditor: { color: C.acento },
  chipTextoCreador: { color: C.ok },

  acciones: { flexDirection: "row", alignItems: "center", gap: S.xs },
  vista3d: {
    paddingHorizontal: S.sm,
    paddingVertical: S.xs + 2,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    backgroundColor: C.panelAlto,
  },
  vista3dTexto: { color: C.textoSeco, fontSize: 12, fontWeight: "700" },

  abrir: {
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 2,
    borderRadius: R.pill,
    backgroundColor: C.acento,
  },
  abrirTexto: { color: C.sobreAcento, fontSize: 12, fontWeight: "700" },

  vacio: {
    alignItems: "center",
    gap: S.xs,
    marginTop: S.xl,
    padding: S.lg,
    borderRadius: R.grande,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.bordeFuerte,
  },
  vacioTitulo: { color: C.textoSeco, fontSize: 14, fontWeight: "600" },
  vacioTexto: {
    color: C.textoDebil,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    marginTop: S.md,
    padding: S.md,
    borderRadius: R.grande,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: "rgba(17,28,46,0.6)",
  },
  demoIcono: {
    width: 36,
    height: 36,
    borderRadius: R.chico,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.acentoFondo,
  },
  demoCubo: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: C.acento,
    transform: [{ rotate: "45deg" }],
  },
  demoTextos: { flex: 1 },
  demoTitulo: { color: C.textoSeco, fontSize: 13, fontWeight: "600" },
  demoSub: { color: C.textoDebil, fontSize: 11, marginTop: 1 },
  demoFlecha: { color: C.textoDebil, fontSize: 22, marginTop: -2 },

  presionado: { opacity: 0.7 },
});
