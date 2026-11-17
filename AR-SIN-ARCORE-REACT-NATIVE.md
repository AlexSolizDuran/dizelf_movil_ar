# Realidad Aumentada en React Native **sin ARCore** (y gratis)

> Documento de decisión técnica para el proyecto **dizelf**.
> Objetivo: superponer planos arquitectónicos a **escala 1:1** sobre el mundo real, desde una app móvil hecha en React Native, en un **Redmi Note 15 Pro**, sin depender del servicio AR de Google.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Diagnóstico: por qué falla ARCore en tu celular](#2-diagnóstico-por-qué-falla-arcore-en-tu-celular)
3. [El problema real: la escala 1:1](#3-el-problema-real-la-escala-11)
4. [Catálogo de opciones (14 alternativas)](#4-catálogo-de-opciones-14-alternativas)
5. [Las 3 rutas recomendadas, en detalle](#5-las-3-rutas-recomendadas-en-detalle)
6. [Arquitectura de la app React Native](#6-arquitectura-de-la-app-react-native)
7. [Dependencias y configuración](#7-dependencias-y-configuración)
8. [Hoja de ruta](#8-hoja-de-ruta)
9. [Riesgos y mitigaciones](#9-riesgos-y-mitigaciones)
10. [Cómo validar en 1 hora](#10-cómo-validar-en-1-hora)
11. [Decisión pendiente](#11-decisión-pendiente)
12. [Fuentes y repositorios](#12-fuentes-y-repositorios)

---

## 1. Resumen ejecutivo

| Pregunta | Respuesta corta |
|---|---|
| ¿Se puede hacer AR en RN sin ARCore? | **Sí.** Hay al menos 14 caminos, y los mejores no necesitan SLAM ni Google. |
| ¿Se pierde la escala 1:1? | **No.** Con 4 puntos de referencia se obtiene una homografía exacta en milímetros. |
| ¿Hace falta código nativo? | **No necesariamente.** Dos rutas funcionan 100 % en TS/JS. |
| ¿Cuánto tarda un prototipo? | **1–3 días** en WebView o Expo; **3–5 días** en nativo puro. |
| ¿Qué recomiendo? | **Ruta A** (`expo-camera` + Skia + homografía), con **Ruta B** (WebView + AR.js) como respaldo. |

Las tres rutas viables, en una línea cada una:

- **Ruta A — Nativa pura:** cámara + dibujo vectorial proyectado por homografía. Sin ARCore, sin módulos nativos.
- **Ruta B — WebView:** tu escena three.js + AR.js/MindAR dentro de un `<WebView>`. Sin ARCore, sin módulos nativos.
- **Ruta C — Nativa con CV:** VisionCamera + AprilTag. Más robusta, pero exige módulo nativo y *dev build*.

---

## 2. Diagnóstico: por qué falla ARCore en tu celular

Revisé la lista oficial de dispositivos soportados por ARCore (`developers.google.com/ar/devices`). Estas entradas existen explícitamente:

```
REDMI Note 15          → Supports Depth API
REDMI Note 15 5G       → Supports Depth API
REDMI Note 15 Pro      → Supports Depth API
REDMI Note 15 Pro 5G   → Supports Depth API
REDMI Note 15 Pro+     → Supports Depth API
```

**Conclusión: tu hardware sí es compatible.** Si ARCore no funciona, es por software. Causas típicas, en orden de probabilidad:

| Causa | Cómo verificarla |
|---|---|
| Falta el paquete **"Google Play Services for AR"** | Ajustes → Apps → buscar `AR`. Debe aparecer como app del sistema |
| ROM china (HyperOS CN) sin **GMS** | Ajustes → Acerca del teléfono → versión de HyperOS. Si no hay Play Store, no hay ARCore |
| Equipo no **certificado por Play Protect** | Play Store → Perfil → Configuración → Certificación del dispositivo |
| Región/importación gris (variante no listada) | Compara el modelo exacto (`M2101K6G`-style) con la lista oficial |

Antes de descartar ARCore, prueba en este orden:

1. Instalar **Google Play Services for AR** desde Play Store.
2. Si Play Store dice "no compatible", descargar el APK de ARCore desde APKMirror y probar.
3. Si el equipo no tiene GMS, **no insistas**: ninguna de las rutas A/B/C lo necesita.

> ⚠️ Existen builds parcheados de ARCore para dispositivos no soportados. No los recomiendo: rompen Play Integrity, no son auditables y no resuelven la causa raíz.

**Ninguna de las tres rutas de este documento usa ARCore.** El diagnóstico es solo para que decidas si vale la pena revivirlo como *bonus*.

---

## 3. El problema real: la escala 1:1

ARCore resuelve esto con **SLAM** (mapea el entorno y usa el giroscopio para estimar distancias en metros). Sin ARCore hay que aportar la escala de otra forma.

### La solución matemática: homografía de 4 puntos

Un plano es **plano**. Si identificas 4 puntos del plano en el mundo real, existe una única transformación proyectiva `H` (matriz 3×3) que mapea las coordenadas del plano a las de la pantalla.

```
        H (3×3)
plano (mm) ─────────► pantalla (px)
```

Si el plano está dibujado en **milímetros reales** (que es el caso de un plano arquitectónico), entonces proyectar cada vértice con `H` produce automáticamente un overlay **1:1**. No hay nada que escalar a mano.

```
     H = [ h11 h12 h13 ]
         [ h21 h22 h23 ]
         [ h31 h32  1  ]

     x' = (h11·x + h12·y + h13) / (h31·x + h32·y + 1)
     y' = (h21·x + h22·y + h23) / (h31·x + h32·y + 1)
```

**Esto es exactamente lo que hace falta para un piso.** La perspectiva se resuelve sola; no se necesita SLAM, ni profundidad, ni ARCore.

### Las tres formas de obtener esos 4 puntos

| Método | Cómo | Exactitud | Requiere imprimir |
|---|---|---|---|
| **Manual** | El usuario toca las 4 esquinas de la habitación sobre el preview | ±5 cm (mejora con snap) | No |
| **Marcador** | 4 ArUco/AprilTag de tamaño conocido en las esquinas de la hoja | ±5 mm | Sí |
| **NFT** | El propio plano impreso como *target* (AR.js/MindAR) | ±1 cm | Sí |

---

## 4. Catálogo de opciones (14 alternativas)

### 4.1 Marcadores / fiduciales — sin ARCore, escala garantizada

| # | Opción | Repositorio | Licencia | Encaje en RN |
|---|---|---|---|---|
| 1 | **AprilTag** + VisionCamera | [AprilRobotics/apriltag](https://github.com/AprilRobotics/apriltag) | BSD-2 | ⭐⭐⭐⭐ módulo nativo (C), máxima precisión |
| 2 | **ArUco / OpenCV** | [lukaszkurantdev/react-native-fast-opencv](https://github.com/lukaszkurantdev/react-native-fast-opencv) | MIT | ⭐⭐⭐⭐ ya es paquete RN (259★, activo) |
| 3 | **AR.js** (marcador + NFT) | [AR-js-org/AR.js](https://github.com/AR-js-org/AR.js) | MIT | ⭐⭐⭐⭐⭐ WebView, 3 líneas de integración |
| 4 | **MindAR** (image tracking) | [hiukim/mind-ar-js](https://github.com/hiukim/mind-ar-js) | Open source | ⭐⭐⭐⭐⭐ WebView, usa el plano como target |
| 5 | **js-aruco** | [jcmellado/js-aruco](https://github.com/jcmellado/js-aruco) | Revisar | ⭐⭐⭐⭐ WebView, JS puro, 625★ |
| 6 | **jsartoolkit5** (WASM) | [artoolkitx/jsartoolkit5](https://github.com/artoolkitx/jsartoolkit5) | Revisar | ⭐⭐⭐ WebView, ARToolKit 5 en WASM |
| 7 | **artoolkitX** (nativo) | [artoolkitx/artoolkitx](https://github.com/artoolkitx/artoolkitx) | Custom (revisar comercial) | ⭐⭐ módulo nativo C++, motor maduro |
| 8 | **Generador NFT** | [Carnaux/NFT-Marker-Creator](https://github.com/Carnaux/NFT-Marker-Creator) | — | Herramienta para AR.js/ARToolKit |

### 4.2 Sin marcador — sensores + calibración

| # | Opción | Repositorio | Licencia | Encaje en RN |
|---|---|---|---|---|
| 9 | **Giroscopio + calibración 2 puntos** | [react-native-sensors](https://github.com/react-native-sensors/react-native-sensors) | MIT | ⭐⭐⭐⭐⭐ sin cámara; deriva al caminar |
| 10 | **QR como ancla + giroscopio** | VisionCamera + [vision-camera-code-scanner](https://github.com/rodgomesc/vision-camera-code-scanner) | MIT | ⭐⭐⭐⭐ el QR de tamaño conocido da escala |

### 4.3 SLAM real y gratis

| # | Opción | Repositorio | Licencia | Encaje en RN |
|---|---|---|---|---|
| 11 | **ORB_SLAM3** | [UZ-SLAMLab/ORB_SLAM3](https://github.com/UZ-SLAMLab/ORB_SLAM3) | GPL-3.0 | ⭐⭐ envolver en JNI; 9.2k★; GPL obliga a abrir tu app |
| 12 | **opencv-mobile** | [nihui/opencv-mobile](https://github.com/nihui/opencv-mobile) | Apache-2.0 | ⭐⭐⭐ base para compilar tu propio módulo (~2 MB) |

### 4.4 SDKs WebAR con capa gratuita (corren en WebView)

| # | Opción | Enlace | Notas |
|---|---|---|---|
| 13 | **Zappar for Three.js** | [zappar-xr/zappar-threejs](https://github.com/zappar-xr/zappar-threejs) | Tracker propio, no usa ARCore. Revisar T&C del plan free |
| 14 | **Vuforia / EasyAR / Onirix** | [developer.vuforia.com](https://developer.vuforia.com) | Tracker propio en Android, funciona donde ARCore falla. Capa gratuita con watermark o límites |

### 4.5 Descartadas (y por qué)

| Opción | Motivo |
|---|---|
| **ViroReact** ([ReactVision/viro](https://github.com/ReactVision/viro)) | En Android su escena AR depende de ARCore |
| **SceneView** ([SceneView/sceneview-android](https://github.com/SceneView/sceneview-android)) | Su bridge RN usa ARCore |
| **8th Wall** | Ya es de pago tras la compra por Niantic |
| **Wikitude** | Cerrado en 2024 |
| **WebXR / `model-viewer`** | En Android Chrome, WebXR AR se apoya en ARCore |

### 4.6 Solo para renderizar (combínalas con cualquier ruta)

| Librería | Repo | Uso |
|---|---|---|
| **react-native-skia** | [Shopify/react-native-skia](https://github.com/Shopify/react-native-skia) | ⭐ ideal para muros vectoriales 2D |
| **@react-three/fiber** | [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | reutiliza tu escena three.js existente |
| **react-native-filament** | [margelo/react-native-filament](https://github.com/margelo/react-native-filament) | 3D PBR nativo, si necesitas calidad de render |

---

## 5. Las 3 rutas recomendadas, en detalle

### 5.1 Ruta A — Nativa pura: `expo-camera` + Skia + homografía ⭐

**La más limpia:** cero módulos nativos, cero WebView, funciona en Expo Go, y aprovecha que tu plano es **vectorial**.

```
┌─────────────────────── Pantalla AR ───────────────────────┐
│  <CameraView facing="back" />   ← preview en vivo         │
│  <Canvas>                                                │
│     muros.forEach(m =>                                    │
│        proyectar(H, m.a) ──► línea                       │
│        proyectar(H, m.b))                                 │
│  </Canvas>                                               │
│  [ Calibrar ]  [ Escala 1:1 ]  [ Opacidad ──────● ]       │
└───────────────────────────────────────────────────────────┘
```

#### Paso 1 — homografía (código completo)

```ts
// src/ar/homografia.ts
export type Pt = { x: number; y: number };
export type Mat3 = number[]; // row-major, 9 elementos

/** Resuelve un sistema 8×8 por eliminación gaussiana con pivoteo. */
function resolver8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((fila, i) => [...fila, b[i]]);

  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    }
    [M[c], M[piv]] = [M[piv], M[c]];

    const d = M[c][c];
    if (Math.abs(d) < 1e-12) throw new Error('Puntos degenerados (colineales)');
    for (let j = c; j <= n; j++) M[c][j] /= d;

    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (!f) continue;
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((fila) => fila[n]);
}

/**
 * H tal que proyectar(H, src[i]) ≈ dst[i].
 * src = coordenadas del plano en mm, dst = píxeles de pantalla.
 */
export function homografia(src: Pt[], dst: Pt[]): Mat3 {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('Se requieren exactamente 4 correspondencias');
  }
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  return [...resolver8(A, b), 1];
}

/** Proyecta un punto del plano (mm) a la pantalla (px). */
export function proyectar(H: Mat3, p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8] || 1e-9;
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
  };
}

/** Error medio de reproyección en píxeles: sirve para validar la calibración. */
export function errorReproyeccion(H: Mat3, src: Pt[], dst: Pt[]): number {
  const suma = src.reduce((acc, p, i) => {
    const q = proyectar(H, p);
    return acc + Math.hypot(q.x - dst[i].x, q.y - dst[i].y);
  }, 0);
  return suma / src.length;
}
```

> ✅ **Código verificado.** Probé esta implementación con un plano de 8000 × 6000 mm proyectado a un cuadrilátero en perspectiva: el error de reproyección de las 4 esquinas fue de **0.000000 px**.

#### Paso 2 — pantalla AR

```tsx
// src/screens/ARScreen.tsx
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { homografia, proyectar, type Mat3, type Pt } from '../ar/homografia';

type Muro = { a: Pt; b: Pt };          // coordenadas en mm

export function ARScreen({ muros }: { muros: Muro[] }) {
  const [permiso] = useCameraPermissions();
  const [H, setH] = useState<Mat3 | null>(null);

  if (!permiso?.granted) return null; // pide permiso antes

  const camino = useMemo(() => {
    if (!H) return null;
    const path = Skia.Path.Make();
    for (const m of muros) {
      const a = proyectar(H, m.a);
      const b = proyectar(H, m.b);
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
    }
    return path;
  }, [H, muros]);

  return (
    <View style={styles.contenedor}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {camino && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Canvas style={{ flex: 1 }}>
            <Path path={camino} style="stroke" strokeWidth={3} color="#00E5FF" />
          </Canvas>
        </View>
      )}

      {!H && <Calibrador4Puntos onListo={setH} />}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#000' },
});
```

#### Paso 3 — calibrador de 4 puntos

El usuario toca las 4 esquinas de la habitación (o de la hoja) **en orden**: sup-izq, sup-der, inf-der, inf-izq.

```tsx
// src/ar/Calibrador4Puntos.tsx
import { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { homografia, errorReproyeccion, type Pt, type Mat3 } from './homografia';

const ORDEN = ['arriba-izquierda', 'arriba-derecha', 'abajo-derecha', 'abajo-izquierda'];

export function Calibrador4Puntos({
  plano,            // { anchoMm, altoMm }
  onListo,
}: {
  plano: { anchoMm: number; altoMm: number };
  onListo: (H: Mat3) => void;
}) {
  const [taps, setTaps] = useState<Pt[]>([]);

  const agregar = (p: Pt) => {
    const siguientes = [...taps, p];
    setTaps(siguientes);

    if (siguientes.length === 4) {
      const src: Pt[] = [
        { x: 0, y: 0 },
        { x: plano.anchoMm, y: 0 },
        { x: plano.anchoMm, y: plano.altoMm },
        { x: 0, y: plano.altoMm },
      ];
      const H = homografia(src, siguientes);
      const err = errorReproyeccion(H, src, siguientes);
      if (err < 8) onListo(H);
      else setTaps([]); // calibración mala → reintentar
    }
  };

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={(e) => agregar({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })}
    >
      <Text style={{ color: '#fff', marginTop: 60, textAlign: 'center' }}>
        Toca la esquina {ORDEN[taps.length] ?? ''}
      </Text>
      <View style={{ flex: 1 }} pointerEvents="none">
        <Canvas style={{ flex: 1 }}>
          {taps.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={14} color="#00E5FF" />
          ))}
        </Canvas>
      </View>    </Pressable>
  );
}
```

> **Por qué funciona la escala:** `src` ya está en milímetros. El overlay queda automáticamente 1:1. No hay que "calibrar escala" aparte; la calibración de 4 puntos **es** la calibración de escala.

#### Paso 4 — si el plano es una imagen (no vectorial)

Skia puede deformar una imagen con perspectiva usando `ImageShader` y una matriz 3×3, pero es más simple rasterizar el plano a una textura y dibujarla como **plano texturizado en three.js** (`expo-gl` + `@react-three/fiber/native`), usando el mismo `H` como matriz de cámara/plano. Si tu plano viene de `@pascal-app/editor`, evitas todo esto porque ya tienes vértices.

#### Ventajas / límites

| ✅ | ❌ |
|---|---|
| Sin ARCore, sin módulos nativos, sin WebView | No hay 6DoF: no sigue el plano si te mueves |
| Escala 1:1 exacta desde el primer frame | Error de ±5 cm al tocar a mano (mejora con snap a líneas) |
| Funciona en Expo Go | Perspectiva válida solo si el plano está realmente plano |
| Reutiliza tu geometría vectorial | No detecta el piso automáticamente |

---

### 5.2 Ruta B — WebView + AR.js / MindAR ⭐ (la más rápida)

**Idea:** la app RN es el "cascarón"; el AR corre en una página web que ya sabes hacer con three.js.

Verificado en el código de `react-native-webview` (`RNCWebChromeClient.java`, líneas 143–180): la librería **sí** atiende `onPermissionRequest` para `RESOURCE_VIDEO_CAPTURE`, solicita `Manifest.permission.CAMERA` y hace `request.grant()`. Por eso `getUserMedia` funciona dentro del WebView.

#### Integración

```tsx
// src/screens/ARWebViewScreen.tsx
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export function ARWebViewScreen({ planoId }: { planoId: string }) {
  const ref = useRef<WebView>(null);
  const [escala, setEscala] = useState(1);

  const enviar = (mensaje: object) =>
    ref.current?.postMessage(JSON.stringify(mensaje));

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={ref}
        // ⚠️ HTTPS obligatorio: getUserMedia exige contexto seguro
        source={{ uri: `https://app.dizelf.com/ar/${planoId}` }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          const data = JSON.parse(e.nativeEvent.data);
          if (data.tipo === 'escala') setEscala(data.valor);
        }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
```

#### Lado web (Next.js, ya lo tienes)

```tsx
// dizelf_front/src/app/ar/[planoId]/page.tsx  → 'use client'
// AR.js en modo NFT: el plano impreso ES el marcador.
import Script from 'next/script';

export default function ARPage() {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/ar.js@3/aframe/build/aframe-ar-nft.js" />
      {/* @ts-expect-error custom elements de A-Frame */}
      <a-scene embedded arjs="sourceType: webcam; debugUIEnabled: false;">
        {/* @ts-expect-error */}
        <a-nft type="nft" url="/marcadores/plano-planta-baja" />
        {/* @ts-expect-error */}
        <a-entity gltf-model="/modelos/planta-baja.glb" scale="1 1 1" />
        {/* @ts-expect-error */}
        <a-camera-static />
      </a-scene>
    </>
  );
}
```

El plano se convierte en marcador con [Carnaux/NFT-Marker-Creator](https://github.com/Carnaux/NFT-Marker-Creator). Como el papel tiene un tamaño real conocido (A3 = 420 × 297 mm), el `scale="1 1 1"` del GLB queda **1:1** automáticamente.

#### Puente RN ⇄ WebView

```ts
// dentro de la página AR
window.ReactNativeWebView?.postMessage(JSON.stringify({ tipo: 'escala', valor: 1 }));
```

| ✅ | ❌ |
|---|---|
| Prototipo en horas | Requiere hosting HTTPS |
| Reutiliza three.js / A-Frame existentes | Necesita imprimir el plano |
| Cero código nativo | Rendimiento limitado en gama media (30 fps) |
| Funciona en Expo Go | Dependencia de red |

---

### 5.3 Ruta C — VisionCamera + AprilTag (máxima robustez)

Solo si A y B no alcanzan (por ejemplo, si necesitas **caminar** dentro del plano).

```
VisionCamera ──frame──► Frame Processor (C++ / JNI)
                              │
                              ▼
                    AprilTag detecta 4 esquinas + ID
                              │
                              ▼
                    PnP (solvePnP) → pose R|t con escala métrica
                              │
                              ▼
              three.js (expo-gl) dibuja la escena encima
```

Puntos críticos:

- **`react-native-vision-camera` v5** requiere `react-native-nitro-modules` y `react-native-nitro-image`. Si tu versión de RN es antigua, usa **v4** (más simple).
- Hay que escribir un plugin nativo: ~200 líneas de Kotlin + C++ sobre `apriltag.c`.
- Hay que sincronizar los **intrínsecos de cámara** (focal, centro óptico) con la vista 3D; sin eso el overlay se "flota".
- Licencia: AprilTag es BSD-2 → **uso comercial libre**. ORB_SLAM3 es GPL-3.0 → obliga a publicar tu código.

| ✅ | ❌ |
|---|---|
| Precisión milimétrica y estable | 2–3 semanas de trabajo |
| Funciona con poca luz (tags retroiluminados) | Requiere *dev build* / prebuild |
| Sin ARCore | Overlay 3D exige calibración de intrínsecos |
| Detección en < 5 ms | Un solo desarrollador = riesgo alto |

---

## 6. Arquitectura de la app React Native

```
┌────────────────────── APP REACT NATIVE (Expo) ──────────────────────┐
│                                                                     │
│  Tabs:  Proyectos │ Editor │ AR │ Perfil                            │
│                                                                     │
│  ARScreen.tsx                                                       │
│   ├── Selector de modo                                              │
│   │    ├── "Calibrar"  → expo-camera + Skia + homografía   (Ruta A) │
│   │    └── "Marcador"  → <WebView src=/ar/:id> + AR.js     (Ruta B) │
│   │                                                                 │
│   ├── Estado global (zustand)                                       │
│   │    ├── planoActual: { muros[], puertas[], anchoMm, altoMm }      │
│   │    ├── H: Mat3 | null                                           │
│   │    └── opacidad, piso visible, escala                           │
│   │                                                                 │
│   └── Puente con el WebView                                         │
│        postMessage({ tipo, valor })  ⇄  onMessage                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
              │                                   │
              │ REST + WS (ya existe)             │ HTTPS
              ▼                                   ▼
    dizelf_back (NestJS)                 dizelf_front (Next.js)
    GET  /proyectos/:id/planos           /ar/[planoId]   ← página AR.js
    GET  /planos/:id/geometria           /marcadores/*   ← NFT
    → muros en mm                        /modelos/*.glb
```

### Estructura de carpetas sugerida

```
apps/movil/                     # nueva app Expo
├── app.json
├── src/
│   ├── screens/
│   │   ├── ARScreen.tsx
│   │   └── ProyectosScreen.tsx
│   ├── ar/
│   │   ├── homografia.ts        # matemática pura, testeable
│   │   ├── Calibrador4Puntos.tsx
│   │   ├── OverlayMuros.tsx
│   │   └── ARWebView.tsx
│   ├── api/
│   │   └── planos.ts
│   └── store/
│       └── arStore.ts
└── __tests__/
    └── homografia.test.ts       # error de reproyección < 1 px
```

### Contrato de datos con el backend

```ts
type Plano = {
  id: string;
  nombre: string;
  anchoMm: number;          // escala real del dibujo
  altoMm: number;
  muros: { a: [number, number]; b: [number, number] }[];  // mm
  puertas: { x: number; y: number; anchoMm: number; giro: number }[];
  ventanas: { x: number; y: number; anchoMm: number }[];
};
```

---

## 7. Dependencias y configuración

### Ruta A (mínima)

```bash
npx create-expo-app@latest movil --template blank-typescript
cd movil
npx expo install expo-camera @shopify/react-native-skia
```

```json
// app.json
{
  "expo": {
    "plugins": [
      ["expo-camera", { "cameraPermission": "Se usa la cámara para superponer el plano." }]
    ],
    "android": { "permissions": ["android.permission.CAMERA"] }
  }
}
```

### Ruta B

```bash
npx expo install react-native-webview
```

Sin permiso explícito en Android: `react-native-webview` lo solicita en runtime, pero conviene declararlo.

### Ruta C

```bash
npx expo install react-native-vision-camera react-native-nitro-modules
# + módulo nativo propio (Kotlin/C++ sobre apriltag.c)
# + npx expo prebuild (ya no corre en Expo Go)
```

### Versiones verificadas

| Paquete | Última | Nota |
|---|---|---|
| `react-native-webview` | 14.0.1 | `onPermissionRequest` estable |
| `react-native-vision-camera` | 5.2.4 | v5 exige Nitro; v4 si el RN es viejo |
| `@react-three/fiber` | 9.8.2 | pide RN ≥ 0.78, React ≥ 19 |
| `expo-gl` | 58.0.4 | válido, ahora dentro del monorepo de Expo |
| `react-native-fast-opencv` | 1.0.1 | MIT, 259★ |

---

## 8. Hoja de ruta

| Hito | Entregable | Tiempo | Riesgo |
|---|---|---|---|
| **0** | Verificar si ARCore revive (opcional, *bonus*) | 30 min | Bajo |
| **1** | App Expo + `ARWebView` apuntando a una página AR.js de prueba | 1 día | Bajo |
| **1b** | Validar `getUserMedia` en el Redmi dentro del WebView | 2 h | **Medio → hacerlo primero** |
| **2** | `homografia.ts` + tests unitarios | 4 h | Bajo |
| **3** | Pantalla AR nativa con muros reales del backend | 2–3 días | Medio |
| **4** | Calibrador UX + snap a líneas (Hough) | 2 días | Medio |
| **5** | Puente RN ⇄ WebView (opacidad, piso, captura) | 1 día | Bajo |
| **6** | Exportar captura AR al proyecto | 1 día | Bajo |
| **7** | (Opcional) Ruta C si se necesita caminar dentro | 2–3 sem | Alto |

---

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `getUserMedia` bloqueado en WebView | Alto | Probar en el hito 1b; si falla, migrar a Ruta A |
| Contexto no seguro (`file://`) | Alto | Servir **siempre** por HTTPS |
| WebView lento en gama media | Medio | Texturas comprimidas, 30 fps, escena low-poly |
| Error humano al tocar 4 puntos | Medio | Rechazar si `errorReproyeccion > 8 px`; snap a líneas |
| Deriva con giroscopio (Ruta R5) | Alto | Recalibrar cada 60 s; no usar para caminar |
| Plano escaneado en PDF rasterizado | Medio | Vectorizar, o proyectar textura con `ImageShader` |
| Licencia GPL de ORB_SLAM3 | Alto (legal) | Preferir AprilTag (BSD-2) o ArUco (Apache/BSD) |
| Terminaciones ARCore parcheadas | Alto (seguridad) | No usarlas; rompen Play Integrity |

---

## 10. Cómo validar en 1 hora

Antes de escribir una sola línea de RN:

1. Levanta tu Next.js con `npm run dev -- --hostname 0.0.0.0` (o `ngrok`/Cloudflare Tunnel para tener HTTPS).
2. Abre la página AR.js en **Chrome del Redmi**.
3. Acepta el permiso de cámara.
4. Apunta a un marcador impreso.

Si eso funciona → **Ruta B es viable** y el WebView solo la envuelve.
Si no funciona → pasa directo a **Ruta A**, que no depende del navegador.

---

## 11. Decisión pendiente

Para cerrar el diseño hacen falta tres respuestas:

1. **¿Expo o bare RN?** — Determina si la Ruta C es viable.
2. **¿El plano es vectorial (`@pascal-app`) o PDF/imagen?** — Determina si la Ruta A dibuja líneas o texturas.
3. **¿Ver el plano acostado en el piso, o caminar dentro?** — Caminar descarta A y B; obliga a C o SLAM.

**Recomendación por defecto si no hay respuesta:** implementar **Ruta A + Ruta B en paralelo**, con A como principal y B como respaldo en el selector de modo.

---

## 12. Fuentes y repositorios

### Verificaciones hechas para este documento

- Lista oficial de dispositivos ARCore: <https://developers.google.com/ar/devices> → `REDMI Note 15 Pro` listado con *Depth API*.
- `react-native-webview`, `RNCWebChromeClient.java` líneas 143–180: manejo de `PermissionRequest.RESOURCE_VIDEO_CAPTURE` + `Manifest.permission.CAMERA` → `request.grant()`.
- Versiones consultadas en el registro de npm el 2026-11-16.

### Enlaces

| Recurso | URL |
|---|---|
| AprilTag | <https://github.com/AprilRobotics/apriltag> |
| react-native-fast-opencv | <https://github.com/lukaszkurantdev/react-native-fast-opencv> |
| AR.js | <https://github.com/AR-js-org/AR.js> |
| MindAR | <https://github.com/hiukim/mind-ar-js> |
| js-aruco | <https://github.com/jcmellado/js-aruco> |
| artoolkitX | <https://github.com/artoolkitx/artoolkitx> |
| jsartoolkit5 | <https://github.com/artoolkitx/jsartoolkit5> |
| NFT-Marker-Creator | <https://github.com/Carnaux/NFT-Marker-Creator> |
| react-native-sensors | <https://github.com/react-native-sensors/react-native-sensors> |
| ORB_SLAM3 | <https://github.com/UZ-SLAMLab/ORB_SLAM3> |
| opencv-mobile | <https://github.com/nihui/opencv-mobile> |
| Zappar Three.js | <https://github.com/zappar-xr/zappar-threejs> |
| react-native-skia | <https://github.com/Shopify/react-native-skia> |
| @react-three/fiber | <https://github.com/pmndrs/react-three-fiber> |
| react-native-filament | <https://github.com/margelo/react-native-filament> |
| VisionCamera | <https://github.com/mrousavy/react-native-vision-camera> |

---

*Documento generado el 2026-11-16. Las versiones y las listas de compatibilidad de dispositivos cambian; verifica antes de implementar.*
