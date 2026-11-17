/**
 * Tema visual de la app.
 *
 * Un solo lugar para colores, radios y espaciado: las pantallas no inventan
 * valores sueltos, así el login, la lista y la AR se ven como la misma app.
 * Paleta oscura porque la app es un visor: el contenido (la escena 3D) manda y
 * la interfaz tiene que retroceder, no competir.
 */

export const C = {
  /** Fondo de la app. */
  fondo: "#070d18",
  /** Fondo de las tarjetas. */
  panel: "#111c2e",
  /** Panel un escalón más alto (inputs, chips). */
  panelAlto: "#182538",
  borde: "rgba(148,163,184,0.16)",
  bordeFuerte: "rgba(148,163,184,0.30)",

  texto: "#f2f7fd",
  textoSeco: "#a9b8cd",
  textoDebil: "#7286a0",

  acento: "#22d3ee",
  acentoFondo: "rgba(34,211,238,0.12)",
  sobreAcento: "#04212a",

  ok: "#34d399",
  aviso: "#fbbf24",
  error: "#f87171",
  errorFondo: "rgba(248,113,113,0.12)",
} as const;

/** Radios de esquina. */
export const R = {
  chico: 10,
  medio: 16,
  grande: 22,
  pill: 999,
} as const;

/** Escala de espaciado (múltiplos de 4). */
export const S = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

/** Tipografía: tamaños y pesos usados en toda la app. */
export const T = {
  marca: { fontSize: 28, fontWeight: "700" } as const,
  titulo: { fontSize: 19, fontWeight: "700" } as const,
  cuerpo: { fontSize: 14, fontWeight: "500" } as const,
  chico: { fontSize: 12, fontWeight: "500" } as const,
  etiqueta: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 } as const,
} as const;

/**
 * Sombra/elevación de panel.
 *
 * Android usa `elevation`; `shadow*` es lo que lee iOS. Sin esto las tarjetas
 * se ven planas sobre el fondo oscuro.
 */
export const sombra = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 6,
} as const;
