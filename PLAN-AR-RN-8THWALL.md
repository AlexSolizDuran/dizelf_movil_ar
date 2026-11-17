# Plan de implementación — AR 1:1 en app móvil React Native, sin ARCore

> **Documento de traspaso para un agente de IA implementador.**
> Léelo completo antes de escribir código. Contiene decisiones ya tomadas y verificadas: no las revalides ni las cambies sin justificarlo.
>
> **Proyecto:** dizelf (gestión de proyectos de arquitectura)
> **Fecha:** 2026-11-16
> **Estado:** GATE 1 superado (2026-11-16): `ar3d/` ancla el cubo de 1 m en el Chrome del Redmi. Siguiente etapa: app móvil, ver §14.

---

## 0. Contexto

dizelf es una plataforma de arquitectura con:

- `dizelf_front` — Next.js 16 + React 19 + three.js 0.185 + `@react-three/fiber` + editor de planos `@pascal-app/*`
- `dizelf_back` — NestJS 11 + Prisma + PostgreSQL
- No existe todavía app móvil. Hay que crearla.

El usuario quiere **ver el modelo 3D de una vivienda superpuesto al mundo real, a escala 1:1, desde el celular**, pudiendo:

1. **Moverse alrededor** del modelo (comportamiento AR real, 6DoF).
2. **Mover / rotar / escalar** el modelo con el dedo.
3. Usar la **cámara del teléfono**.
4. **Sin el servicio AR de Google (ARCore)**.
5. **Gratis**.

### Dispositivo objetivo

**Redmi Note 15 Pro** (Android, HyperOS). Está en la lista oficial de dispositivos ARCore, pero **ARCore no funciona en su unidad**. Por eso todo el plan asume **cero dependencia de ARCore**.

### Requisitos NO negociables

| # | Requisito |
|---|---|
| R1 | Debe ser una **app móvil React Native** instalable (APK). No una web. |
| R2 | **No** puede depender de ARCore / Google Play Services for AR. |
| R3 | **No** puede ser de pago. |
| R4 | El modelo 3D debe quedar a **escala 1:1** (1 metro real = 1 metro del modelo). |
| R5 | El usuario debe poder **caminar alrededor** del modelo y que este permanezca anclado. |
| R6 | Debe poder **mover el modelo con el táctil** (arrastrar, pinza para escalar, giro para rotar). |
| R7 | No debe abrir un navegador externo en ningún momento. |

---

## 1. Decisión técnica (ya tomada)

**App React Native (Expo) + una sola pantalla con `<WebView>` que ejecuta 8th Wall XR Engine + three.js.**

### Por qué

| Alternativa | Por qué se descartó |
|---|---|
| ARCore / ViroReact / SceneView | R2 (no funciona en el dispositivo) |
| Homografía de 4 puntos (`expo-camera` + Skia) | No cumple R5: al caminar, el overlay se despega |
| Giroscopio (`react-native-sensors`) | No cumple R5: no hay traslación, deriva en segundos |
| AR.js / MindAR solos | Sin marcador visible no hay pose (sí valen como plan B) |
| AprilTag + VisionCamera | Válido, pero 6DoF solo con tag visible y 2 semanas de trabajo (plan B) |
| ORB_SLAM3 (JNI) | GPL-3.0 + 6 semanas de trabajo |
| Vuforia / EasyAR | Licencia comercial dudosa + módulo nativo |

### Por qué 8th Wall cumple todo

Verificado en la documentación oficial el 2026-11-16:

- **Tiene SLAM propio, independiente de ARCore:**
  > *"Unlike ARKit or ARCore, which can track multiple surfaces, 8th Wall detects and updates one ground plane dynamically."*
  > — `8thwall.org/docs/troubleshooting/world-tracking-issues`
- **Funciona dentro de WebViews de apps Android:**
  > *"Apps using Web Views known to support the features required for WebAR: Twitter, WhatsApp, Slack, Gmail…"*
  > — `8thwall.org/docs/troubleshooting/browser-requirements`
- **Es gratis desde 2026:** `github.com/8thwall/8thwall` es **MIT**. El binario de SLAM (`github.com/8thwall/engine`) se distribuye gratis con licencia propietaria de uso limitado (sin costo).

### Consecuencia importante

Una app RN con `<WebView>` **es una app móvil** (R1 ✅). El WebView es un componente más, como `<Video>`. El usuario no ve navegador (R7 ✅). La UI, navegación, login y llamadas al backend siguen siendo React Native puro.

---

## 2. Arquitectura

```
┌──────────────────── APK React Native (Expo) ────────────────────┐
│                                                                 │
│  expo-router                                                    │
│   ├── (tabs)/proyectos.tsx      ← 100% RN                       │
│   ├── (tabs)/perfil.tsx         ← 100% RN                       │
│   └── ar/[modeloId].tsx         ← RN + 1 WebView                │
│                                                                 │
│  ARScreen                                                       │
│   ├── <WebView>  → http://127.0.0.1:PORT/ar3d/index.html        │
│   │     └── 8th Wall (SLAM) + three.js + GLB + gestos           │
│   └── UI RN superpuesta: botones Recentrar / Bloquear / Reset   │
│                                                                 │
│  Puente: injectJavaScript (RN→web) ⇄ postMessage (web→RN)       │
└─────────────────────────────────────────────────────────────────┘
          │                                   │
          │ REST (auth + 3 endpoints nuevos)                  │ assets empaquetados
          ▼                                   ▼
   dizelf_back (NestJS)            ar3d/ = sitio estático propio
   GET /proyectos/:id/modelo       https://dizelf-ar.pages.dev/?modelo=<id>
```

### Tres modos de entrega (los tres deben funcionar)

| Modo | Cómo | Cuándo |
|---|---|---|
| **Online (navegador)** | `https://dizelf-ar.pages.dev/?modelo=<id>&api=<BACKEND_URL>` → GLB por `GET /proyectos/:id/modelo` | GATE 1 y demos |
| **Online (APK)** | El WebView pide el GLB al backend con el token de la app, lo guarda en `FileSystem` y lo sirve por `http://127.0.0.1` | uso normal, sin CORS |
| **Offline (APK)** | servidor estático local con `ar3d/` empaquetado + modelos ya cacheados | modo avión |

**Publicar un modelo nuevo no redepliega nada:** el sitio `ar3d` se despliega **una sola vez** (Cloudflare Pages, gratuito y sin tarjeta). Cada modelo es un `POST` al backend; la página sigue siendo la misma.

> **Por qué `http://127.0.0.1` sirve:** Chromium considera `localhost` / `127.0.0.1` un **contexto seguro**, así que `getUserMedia` (cámara) funciona sin HTTPS ni internet.

---

## 3. Estructura de archivos

```
ar3d/                              ← sitio estático propio (Cloudflare Pages, sin Next)
├── index.html
├── app.js                          ← entry point, pipeline de 8th Wall
├── escena.js                       ← carga del GLB, luces, escala
├── gestos.js                       ← touch: drag / pinch / rotate
├── puente.js                       ← postMessage ⇄ window.__comando
├── vendor/
│   ├── xr.js                       ← @8thwall/engine-binary/dist/xr.js
│   ├── xr-slam.js                  ← chunk del SLAM (5,3 MB, mismo origen)
│   ├── xrextras.js                 ← solo FullWindowCanvas
│   └── LICENSE                     ← licencia del engine (atribución)
├── three/                          ← three.js + loaders GLTF/Draco (mismo origen)
├── draco/                          ← decoder de Draco
├── _headers                        ← Permissions-Policy: camera=(self) + CSP del sitio
└── modelos/
    └── (sin GLB en el repo)       ← el demo de 1 m se genera por código; los reales salen del backend

apps/movil/                         ← NUEVA app Expo
├── app.json
├── package.json
├── app/
│   ├── _layout.tsx
│   ├── (tabs)/proyectos.tsx
│   └── ar/[modeloId].tsx
├── src/
│   ├── ar/
│   │   ├── ARWebView.tsx
│   │   ├── controles.tsx           ← botones nativos
│   │   └── mensajes.ts             ← tipos del protocolo
│   ├── api/modelos.ts
│   └── servidor/local.ts           ← static server para modo offline
└── assets/ar3d/                    ← copia de ar3d/ para el modo offline
```

> **Decisión (revisada):** la página AR **no** vive en `dizelf_front/public/`. Va en `ar3d/` en la raíz del repo y se despliega como su **propio sitio estático en Cloudflare Pages**. Razones: (1) el `Permissions-Policy: camera=()` y el CSP de `dizelf_front/next.config.ts` bloquean la cámara en todo el sitio; (2) Vercel Hobby no permite uso comercial; (3) Pages es gratis, sin tarjeta, con ancho de banda ilimitado y `_headers` propios; (4) el mismo directorio se copia tal cual al APK para el modo offline.
> Sigue siendo **archivos estáticos, nunca una ruta de Next**: evita SSR/hidratación con `<canvas>` y `XR8` global.

---

## 4. Tareas de implementación

### T1 — App Expo base

```bash
npx create-expo-app@latest apps/movil --template blank-typescript
cd apps/movil
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install react-native-webview
npx expo install @dr.pogodin/react-native-static-server
```

> Decisión P2: el proyecto es **Expo con prebuild**. `react-native-webview` funciona en Expo Go, pero `@dr.pogodin/react-native-static-server` es módulo nativo, así que el build real se hace con `npx expo prebuild --platform android && npx expo run:android`. No hace falta *bare RN*.

`app.json`:

```json
{
  "expo": {
    "name": "dizelf",
    "slug": "dizelf",
    "android": {
      "package": "com.dizelf.app",
      "permissions": ["android.permission.CAMERA"]
    },
    "plugins": ["expo-router"]
  }
}
```

**Criterio de aceptación T1:** `npx expo run:android` genera un APK que abre en el Redmi Note 15 Pro.

---

### T2 — Página AR estática (la pieza central)

**`ar3d/index.html`** (sitio estático independiente)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>dizelf AR</title>
  <style>
    html, body { margin:0; padding:0; overflow:hidden; background:#000; height:100%; }
    #camerafeed { width:100%; height:100%; display:block; touch-action:none; }
  </style>

  <script src="./vendor/xr.js" async crossorigin="anonymous" data-preload-chunks="slam"></script>
  <script src="./vendor/xrextras.js" crossorigin="anonymous"></script>
  <script src="./vendor/landing-page.js" crossorigin="anonymous"></script>
</head>
<body>
  <canvas id="camerafeed"></canvas>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

> Fuente de los vendor: `npm i @8thwall/engine-binary @8thwall/xrextras @8thwall/landing-page` y copiar `dist/` a `vendor/`. **No** usar CDN en producción (rompe el modo offline).

**`ar3d/app.js`**

```js
import { moduloEscena } from './escena.js';
import { activarGestos } from './gestos.js';
import { activarPuente } from './puente.js';

const onxrloaded = () => {
  // ⚠️ CRÍTICO para la escala 1:1: 'absolute' devuelve la cámara en METROS
  XR8.XrController.configure({
    scale: 'absolute',
    enableLighting: true,
  });

  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),      // ← SLAM propio, sin ARCore
    LandingPage.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XRExtras.Loading.pipelineModule(),
    XRExtras.RuntimeError.pipelineModule(),
    moduloEscena(),
  ]);

  activarGestos();
  activarPuente();

  XR8.run({ canvas: document.getElementById('camerafeed') });
};

window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded);
```

**Criterio de aceptación T2:** abrir la página en Chrome del Redmi apuntando a un piso con textura → aparece un cubo de 1 m apoyado en el piso, y al caminar se queda quieto.

---

### T3 — Carga del GLB a escala 1:1

**`ar3d/escena.js`**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export const GRUPO = new THREE.Group();   // el objeto que mueve el dedo

export const moduloEscena = () => ({
  name: 'casa',
  onStart: () => {
    const { scene, camera, renderer } = XR8.Threejs.xrScene();

    camera.near = 0.05;    // 5 cm
    camera.far = 60;

    scene.add(GRUPO);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(4, 10, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    renderer.shadowMap.enabled = true;

    cargarCasa(resolverUrlModelo());
  },
});

/**
 * De dónde sale el GLB. Sin `api` usa el demo empaquetado (mismo origen);
 * con `api` lo pide al backend — así un modelo nuevo NO exige redeploy.
 */
function resolverUrlModelo() {
  const q = new URLSearchParams(location.search);
  const id = q.get('modelo') ?? 'demo';
  const api = q.get('api');
  const token = q.get('token');
  if (!api) return `./modelos/${id}.glb`;
  return `${api.replace(/\/$/, '')}/proyectos/${encodeURIComponent(id)}/modelo` +
    (token ? `?token=${encodeURIComponent(token)}` : '');
}

async function cargarCasa(url) {
  const draco = new DRACOLoader().setDecoderPath('./draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);

  try {
    const gltf = await loader.loadAsync(url);
    const casa = gltf.scene;

    // Pivote al centro del piso y base en Y = 0.
    // 8th Wall exige que TODO el contenido esté por encima de Y = 0.
    const box = new THREE.Box3().setFromObject(casa);
    const centro = box.getCenter(new THREE.Vector3());
    casa.position.set(-centro.x, -box.min.y, -centro.z);

    // ⚠️ UNIDADES: si el GLB viene en milímetros → 0.001. Si viene en metros → 1.
    const unidad = Number(gltf.userData?.unidad ?? 1);
    if (unidad !== 1) casa.scale.setScalar(unidad);

    casa.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) o.material.side = THREE.DoubleSide; // muros sin grosor
      }
    });

    GRUPO.add(casa);
    puenteEnviar({ tipo: 'modelo-listo', escala: GRUPO.scale.x });
  } catch (e) {
    puenteEnviar({ tipo: 'error', motivo: String(e) });
  }
}
```

**Reglas de escala — no inventar:**

El GLB exportado por el editor Pascal viene en **metros** (decisión P1), así que `scale = 1` y la línea `unidad` del bloque anterior queda como salvaguarda para GLB de terceros.

| Unidad del GLB | `scale` |
|---|---|
| metros (caso real, editor Pascal) | `1` |
| milímetros | `0.001` |
| centímetros | `0.01` |
| pies | `0.3048` |

Además, comprobar el bounding box: si la dimensión mayor del modelo no cae entre **1 m y 100 m**, no escalar: enviar `error` por el puente y mostrar las dimensiones en pantalla para detectar un GLB mal exportado.

**Criterio de aceptación T3:** con una cinta métrica, una pared de 3 m del modelo mide 3 m en el piso (±5 cm).

---

### T4 — Gestos táctiles

Regla de oro: **el dedo nunca mueve la cámara**. La cámara la controla el SLAM. El dedo escribe sobre `GRUPO`.

**`ar3d/gestos.js`**

```js
import * as THREE from 'three';
import { GRUPO } from './escena.js';

const planoPiso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const tmp = new THREE.Vector3();

let arrastrando = false;
let offset = new THREE.Vector3();
let inicio = null;
let escalaBase = 1, rotBase = 0;
let bloqueado = false;

const canvas = () => document.getElementById('camerafeed');

function ndc(x, y) {
  const r = canvas().getBoundingClientRect();
  return new THREE.Vector2(
    ((x - r.left) / r.width) * 2 - 1,
    -((y - r.top) / r.height) * 2 + 1
  );
}

function puntoEnPiso(x, y) {
  const { camera } = XR8.Threejs.xrScene();
  raycaster.setFromCamera(ndc(x, y), camera);
  return raycaster.ray.intersectPlane(planoPiso, tmp) ? tmp.clone() : null;
}

export function activarGestos() {
  const c = canvas();
  c.style.touchAction = 'none';
  const dedos = new Map();

  c.addEventListener('pointerdown', (e) => {
    if (bloqueado) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (dedos.size === 1) {
      raycaster.setFromCamera(ndc(e.clientX, e.clientY), XR8.Threejs.xrScene().camera);
      if (raycaster.intersectObject(GRUPO, true).length === 0) return; // solo si tocó el modelo
      const p = puntoEnPiso(e.clientX, e.clientY);
      if (!p) return;
      arrastrando = true;
      offset.set(GRUPO.position.x - p.x, 0, GRUPO.position.z - p.z);
    }

    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()];
      inicio = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        ang: Math.atan2(b.y - a.y, b.x - a.x),
      };
      escalaBase = GRUPO.scale.x;
      rotBase = GRUPO.rotation.y;
    }
  });

  c.addEventListener('pointermove', (e) => {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (dedos.size === 1 && arrastrando) {
      const p = puntoEnPiso(e.clientX, e.clientY);
      if (p) GRUPO.position.set(p.x + offset.x, 0, p.z + offset.z);
    }

    if (dedos.size === 2 && inicio) {
      const [a, b] = [...dedos.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      GRUPO.scale.setScalar(THREE.MathUtils.clamp(escalaBase * (dist / inicio.dist), 0.2, 5));
      GRUPO.rotation.y = rotBase + (ang - inicio.ang);
    }
  });

  const soltar = (e) => {
    dedos.delete(e.pointerId);
    if (dedos.size === 0) { arrastrando = false; inicio = null; }
    if (dedos.size === 1) inicio = null;
  };
  c.addEventListener('pointerup', soltar);
  c.addEventListener('pointercancel', soltar);

  // doble toque → recentrar SLAM
  let ultimoTap = 0;
  c.addEventListener('touchend', () => {
    const ahora = Date.now();
    if (ahora - ultimoTap < 300) XR8.XrController.recenter();
    ultimoTap = ahora;
  });
}

export function setBloqueado(v) { bloqueado = v; }

export function reset() {
  GRUPO.position.set(0, 0, 0);
  GRUPO.rotation.set(0, 0, 0);
  GRUPO.scale.setScalar(1);
}
```

**Criterio de aceptación T4:** arrastrar mueve el modelo sobre el piso; pinza lo escala; giro de dos dedos lo rota; doble toque recentra.

---

### T5 — Puente RN ⇄ WebView

**Protocolo (congelado, no cambiar nombres):**

| Dirección | Mensaje | Payload |
|---|---|---|
| web → RN | `modelo-listo` | `{ escala: number }` |
| web → RN | `tracking` | `{ valor: 'ok' \| 'perdido' }` |
| web → RN | `error` | `{ motivo: string }` |
| RN → web | `recentrar` | — |
| RN → web | `reset` | — |
| RN → web | `bloquear` | `{ valor: boolean }` |
| RN → web | `escala` | `{ valor: number }` |

**`ar3d/puente.js`**

```js
import { reset, setBloqueado } from './gestos.js';
import { GRUPO } from './escena.js';

export function puenteEnviar(msg) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

export function activarPuente() {
  window.__comando = ({ tipo, valor }) => {
    if (tipo === 'recentrar') XR8.XrController.recenter();
    if (tipo === 'reset') reset();
    if (tipo === 'bloquear') setBloqueado(!!valor);
    if (tipo === 'escala') GRUPO.scale.setScalar(Number(valor));
  };
}
```

**`apps/movil/src/ar/ARWebView.tsx`**

```tsx
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = { uri: string; onEstado?: (e: string) => void };

export function ARWebView({ uri, onEstado }: Props) {
  const ref = useRef<WebView>(null);

  const comando = (tipo: string, valor?: unknown) => {
    ref.current?.injectJavaScript(
      `window.__comando(${JSON.stringify({ tipo, valor })}); true;`
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <WebView
        ref={ref}
        source={{ uri }}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.tipo === 'modelo-listo') onEstado?.('listo');
          if (msg.tipo === 'tracking') onEstado?.(msg.valor);
          if (msg.tipo === 'error') onEstado?.('error');
        }}
      />
    </View>
  );
}
```

> **Verificado:** `react-native-webview` ya concede el permiso de cámara. En `RNCWebChromeClient.java` (líneas 143–180) intercepta `PermissionRequest.RESOURCE_VIDEO_CAPTURE`, solicita `Manifest.permission.CAMERA` y llama a `request.grant()`. No hay que parchear nada; solo declarar `CAMERA` en `app.json`.

**Criterio de aceptación T5:** el botón "Recentrar" de RN recentra el SLAM de la web.

---

### T6 — Backend del modelo + modo offline

**T6.0 — `ModeloAr` en Prisma + el GLB en Neon Object Storage (storage gratis, sin cuentas nuevas).**

El binario **no** va en una columna: va en un bucket S3-compatible del propio proyecto Neon (`NEON_DB_URL` ya es Neon), y Postgres solo guarda los metadatos. Motivos: 20 modelos de prueba no deben inflar las copias de seguridad ni cada `SELECT`; y descargar un GLB desde un bucket no cuenta contra el mismo límite que las consultas.

Free de Neon (verificado 2026-11-16): **5 GB de Object Storage y 5 GB de egress por proyecto**, sin tarjeta, y **1 GB de Postgres** por proyecto. Con 20 GLB de 8 MB = 160 MB, el uso es del 3 % del bucket.

```prisma
model ModeloAr {
  proyectoId  String   @id @map("proyecto_id") @db.Uuid   // 1 fila por proyecto
  proyecto    Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  clave       String   @map("clave")                       // objetos/<proyectoId>/v<version>.glb
  version     Int      @default(1)
  bytes       Int
  mime        String   @default("model/gltf-binary")
  actualizado DateTime @updatedAt
  @@map("modelo_ar")
}
```

Requiere `modeloAr ModeloAr?` en `Proyecto` y `npx prisma migrate dev`. El bucket se crea con `neon buckets create modelos-ar` (o desde el panel) y el endpoint S3 con `neon env pull` (`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`); el cliente S3 necesita `forcePathStyle: true`.

> Si el proyecto Neon estuviera en otra región o el bucket se volviera incómodo, **solo cambia el cliente de escritura/lectura del binario**: los tres endpoints y la app quedan igual. Eso era exactamente la promesa de P7 y se mantiene.

**T6.1 — Tres endpoints en `dizelf_back`** (auth en todos, según `dizelf_back/AGENTS.md`):

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/proyectos/:id/modelo` | multipart, dueño/colaborador; valida ≤ 25 MB; upsert y `version + 1` |
| `GET` | `/proyectos/:id/modelo` | `StreamableFile`, `Content-Type: model/gltf-binary`, `Cache-Control: public, max-age=86400`; acepta `?v=<version>` |
| `GET` | `/proyectos/:id/modelo/meta` | `{ version, bytes, actualizado }` para que la app sepa si su caché sigue vigente |

CORS: agregar el origen del sitio AR (`https://dizelf-ar.pages.dev`) a `FRONTEND_URL` (acepta lista con comas). Solo lo necesita el modo navegador; el APK va por `127.0.0.1`. El CSP de `ar3d/_headers` debe permitir ese origen en `connect-src`.

Publicar un modelo nuevo, sin UI y sin redeploy:

```bash
curl -X POST "$BACKEND/proyectos/$ID/modelo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@casa.glb"
```

**T6.2 — Static server en el APK (offline):**

```ts
// apps/movil/src/servidor/local.ts
import StaticServer from '@dr.pogodin/react-native-static-server';

export async function iniciarServidor() {
  const server = new StaticServer({ port: 0, rootDir: 'ar3d', fileDir: 'ar3d' });
  const url = await server.start();   // http://127.0.0.1:<puerto>
  return { url, stop: () => server.stop() };
}
```

- Copiar `ar3d/` (raíz del repo) → `apps/movil/assets/ar3d` en el script de build. Una sola fuente de verdad: lo que se despliega en Pages es lo que se empaqueta en el APK.
- **Flujo:** `GET .../modelo/meta` → si la versión local difiere, descargar a `FileSystem.documentDirectory/modelos/<id>-v<version>.glb`; el static server sirve ese directorio.
- Nunca cargar el GLB por `file://` desde el WebView: rompe el contexto seguro y con él `getUserMedia`. Siempre por `127.0.0.1`.
- El demo de 1 m es **procedural** (cubo + regla 3 m), no un `demo.glb`: no hay binario que mantener ni que versionar para la primera apertura.

**Criterio de aceptación T6:** se sube un modelo con `curl`, se abre desde el celular **sin redeploy y sin reinstalar la app**; y en modo avión, tras la primera carga, la AR sigue funcionando.

---

### T7 — Pantalla y UX

`app/ar/[modeloId].tsx`:

- Header RN: nombre del proyecto + botón atrás.
- `<ARWebView>` a pantalla completa.
- Barra inferior RN flotante con: **Recentrar**, **Bloquear/Desbloquear**, **Reset**, **Ayuda**.
- Overlay de estado: "Buscando el piso…", "Listo", "Tracking perdido".
- Pantalla **Acerca de / Créditos** con el aviso de copyright del binario del engine (`Copyright © 2026 Niantic Spatial, Inc.` + enlace a la licencia), requerido por la licencia de distribución del engine (decisión derivada de P1–P6, ver §10).
- Nunca mostrar un navegador ni barra de URL.

---

## 5. Presupuesto de rendimiento del GLB

| Métrica | Límite | Motivo |
|---|---|---|
| Triángulos | ≤ 150 000 | el SLAM ya consume CPU/GPU |
| Draw calls | ≤ 20 | unificar muros con el mismo material |
| Materiales | 1–3 | cada material = draw call |
| Texturas | KTX2, ≤ 1024 px | memoria GPU móvil |
| Compresión | Draco o meshopt | 5–10× menos peso |
| Sombras | 1024 px o desactivadas | caro en gama media |
| Peso del GLB | ≤ 8 MB | < 3 s en 4G |

Si se excede: `gltf-transform optimize casa.glb casa.opt.glb --compress draco --texture-compress ktx2`.

**Ojo con el peso real del bake:** `exportSceneToGlb()` llama a `GLTFExporter.parse(..., { binary: true, animations })` **sin `maxTextureSize`**, así que las texturas KTX2 del editor se convierten a RGBA y glTF las embebe como **PNG** (un PNG 2048² puede pesar 4–8 MB). Por eso hay dos acciones obligatorias antes de subir modelos:

1. Añadir `maxTextureSize: 1024` al `parse()` de `@pascal-app/editor/src/lib/glb-export.ts` (una línea, baja el peso ~4×).
2. Medir el GLB resultante: si pasa de 25 MB, optimizarlo. Ese es el tope que impone el endpoint de T6.1 y el upload del APK.

---

## 6. Problemas conocidos y su solución (no improvisar)

| Síntoma | Causa | Solución |
|---|---|---|
| El modelo flota o se hunde | pivote del GLB | `Box3` del T3 |
| Se ve al doble de tamaño | GLB en mm con scale 1 | `scale.setScalar(0.001)` |
| Se pega a la cámara al caminar | `scale: 'responsive'` | `scale: 'absolute'` |
| Desaparece al acercarse | `camera.near` grande | `near = 0.05` |
| Tracking inestable en piso liso | SLAM usa contraste en gris | pedir superficie con textura + botón recentrar |
| La cámara no abre en WebView | falta permiso o contexto no seguro | `CAMERA` en `app.json` + HTTPS o `127.0.0.1` |
| El modelo se mueve desde cualquier toque | raycast sin filtrar | `intersectObject(GRUPO)` |
| 15 fps | sombras + muchos materiales | desactivar sombras, unificar materiales |
| Pantalla negra y el HUD sigue en "Cargando motor…" | falta `three.core.js`: three r≥0.16x parte `three.module.js` en dos | copiar `three/three.core.js` junto a `three.module.js` |
| Pantalla negra, HUD en "Buscando el piso…" y **nunca** aparece el aviso de cámara | el session manager del motor aborta si el permiso está en `prompt`: 8th Wall **no pide** la cámara por su cuenta | pedir permiso con un toque del usuario (`getUserMedia`) antes de `XR8.run`; sin ese gesto el motor nunca arranca |
| Texturas negras | assets sin CORS | servir todo desde el mismo origen |
| El modelo aparece "al revés" | ejes `leftHandedAxes` | `XR8.XrController.configure({ leftHandedAxes: true })` |

---

## 7. Criterios de aceptación globales

La implementación se considera terminada cuando, en el **Redmi Note 15 Pro**:

- [ ] Se instala el APK y abre sin errores.
- [ ] La cámara se abre **dentro de la app** (sin navegador, sin diálogo de Chrome).
- [ ] El modelo aparece apoyado en el piso, sin flotar.
- [ ] Una pared de 3 m mide 3 m con cinta métrica (±5 cm).
- [ ] Al caminar 2 m alrededor, el modelo permanece anclado (no se arrastra con la cámara).
- [ ] Arrastrar con un dedo mueve el modelo sobre el piso.
- [ ] Pinza escala; giro de dos dedos rota.
- [ ] "Recentrar" recupera el tracking cuando se pierde.
- [ ] Un modelo nuevo subido por el backend aparece en el celular **sin redeploy del sitio ni reinstalar el APK**.
- [ ] El GLB se sirve desde `127.0.0.1` dentro del APK (nunca `file://`) y desde el backend en el navegador.
- [ ] Con modo avión activo **tras una primera carga**, la AR sigue funcionando (modo offline + caché).
- [ ] El APK muestra los **créditos del engine** con su aviso de copyright.
- [ ] 25–30 fps estables con el modelo real.

---

## 8. Plan B (si algo falla)

| Falla | Plan B | Coste |
|---|---|---|
| 8th Wall no rinde en el WebView | **AprilTag + VisionCamera** (nativo, BSD-2) → 6DoF con marcador visible | ~2 semanas |
| El piso no da textura suficiente | **AR.js NFT** con el plano impreso como target (MIT) | ~3 días |
| Se necesita caminar **dentro** de la casa | **ORB_SLAM3** por JNI (GPL-3.0) o Vuforia | 4–8 semanas |

**Importante:** las tres rutas comparten la misma escena three.js y el mismo GLB. Cambiar de motor solo cambia el contenedor (WebView ↔ módulo nativo), no la app.

---

## 9. Lo que el agente NO debe hacer

1. **No** reintroducir ARCore, ViroReact ni SceneView (R2).
2. **No** usar `scale: 'responsive'` (rompe el 1:1).
3. **No** mover la cámara con el dedo (rompe la ilusión de AR).
4. **No** cargar `xr.js` desde CDN en producción (rompe el offline).
5. **No** convertir la pantalla AR en una ruta de Next.js ni meterla en `dizelf_front/public/`: su CSP y su `Permissions-Policy: camera=()` bloquean la cámara. Es `ar3d/` estático, desplegado aparte en Cloudflare Pages.
6. **No** cambiar los nombres del protocolo de mensajes del T5.
7. **No** asumir unidades del GLB: leerlas o preguntar.
8. **No** añadir dependencias de realidad aumentada adicionales sin actualizar este documento.
9. **No** meter los GLB en el repo ni en `ar3d/modelos/`: se sirven desde el backend para no redeployar por modelo (`ar3d/modelos/` solo se usa para validar un GLB puntual y se borra).
10. **No** usar Cloudflare R2 (exige tarjeta) ni el disco de Render free (efímero) como storage.

---

## 10. Decisiones cerradas (2026-11-16)

Ya no hay preguntas bloqueantes. Estas respuestas son firmes: no reabrirlas sin motivo.

| # | Pregunta | Decisión | Consecuencia en el plan |
|---|---|---|---|
| P1 | Unidad del GLB | **Metros** | `scale = 1` en T3. Añadir solo la comprobación de cordura del bounding box (si mide < 1 m o > 100 m, avisar en vez de escalar a ciegas). Se mantiene la tabla de unidades de T3 como fallback defensivo. |
| P2 | Expo managed o bare | **Expo con prebuild / dev build** | `npx expo prebuild --platform android` antes de `run:android`. Expo Go no sirve: T6 necesita módulo nativo. Sigue valiendo `create-expo-app` + expo-router. |
| P3 | Origen del modelo | **Backend + caché local** | El GLB se pide a `GET /proyectos/:id/modelo`, se guarda en `FileSystem` y se sirve por el static server. Requiere implementar 3 endpoints en `dizelf_back` (hoy no existen). |
| P4 | Hosting del modo online | **Sitio estático propio en Cloudflare Pages** | `ar3d/` en la raíz → `https://dizelf-ar.pages.dev`. Descartado Vercel (el `Permissions-Policy` del front bloquea la cámara y Hobby prohíbe uso comercial) y descartado R2 (exige tarjeta). |
| P5 | Origen del GLB | **Ya existe: exportador del editor Pascal** | El editor expone *Export 3D Model (GLB)* (`@pascal-app/editor/src/lib/glb-export.ts`, `exportSceneToGlb()`). **No** hay que escribir pipeline JSON→GLB. El GLB de la demo de GATE 1 sale del propio prototipo. |
| P6 | Orden de trabajo | **GATE 1 primero** | T2 se construye y se valida en el Chrome del Redmi antes de tocar la app Expo. Si el SLAM no rinde, se salta al Plan B (§8) sin haber gastado T1/T3–T7. |
| P7 | Storage del GLB | **Neon Object Storage (bucket S3) + metadatos en Postgres** | Gratis (5 GB + 5 GB de egress por proyecto), sin tarjeta y sin provider nuevo. Corregido 2026-11-16: antes decía `Bytes` en Postgres; con 1 GB por proyecto entra, pero es peor para copias de seguridad y para el egress. Migrar a Tigris/B2 más adelante solo cambia quién escribe el binario, no los endpoints ni la app. |
| P8 | Publicar modelos | **Sin redeploy: `POST` al backend** | El sitio `ar3d` se despliega una vez. Un modelo nuevo es un `POST` (o un `curl`); la página es la misma y no hay push ni build. |

### Notas derivadas

- **Unidades verificadas:** el editor Pascal guarda longitudes en metros (`measurements.ts`: *"Values are always STORED in the field's own unit (meters…)"*), por lo que el GLB exportado es métrico. `scale = 1`.
- **Licencia del binario:** el engine distribuido (con SLAM) es gratis pero propietario; el cumplimiento exige que el aviso de copyright sea visible **dentro** del APK. Añadirlo a T7 como pantalla *Acerca de / Créditos*.
- **Storage y publicación:** el binario va a Postgres (P7) y entra por `POST` (P8). Prohibido convertir cada modelo en un archivo del deploy: eso era el diseño anterior y obligaba a un push por modelo.
- **CORS y CSP del sitio AR:** `ar3d/_headers` debe permitir `connect-src` al origen del backend, y el backend debe aceptar el origen del sitio AR en `FRONTEND_URL`. Solo aplica al modo navegador.
- **El GLB del editor ya viene optimizado por el propio bake**, pero conviene medirlo con el presupuesto de §5 antes de empaquetarlo.

---

## 11. Orden de ejecución (cerrado, decisión P6)

```
GATE 0  Leer/validar el GLB real del editor Pascal     ─┐
T2 (página AR demo en ar3d/)            ─┼─► GATE 1: Chrome del Redmi
                                                        │   (SLAM + cubo de 1 m + regla de 3 m)
        └─ si falla → Plan B §8, no se escribe la app
T1 (app Expo base + prebuild)     ─┐
T3 (GLB real a escala 1:1)        ─┼─► GATE 2: cámara dentro del WebView
T4 (gestos)                       ─┤             (SLAM + gestos)
T5 (puente RN ⇄ web)              ─┤
T6.0/T6.1 (ModeloAr + endpoints)  ─┤
T6 (offline + caché)              ─┤
T7 (UX + créditos + APK final)    ─┘─► GATE 3: criterios de §7
```

**GATE 1 es obligatorio y va primero:** si el SLAM no corre fluido en Chrome del Redmi, no tiene sentido seguir. Es un HTML estático + GLB exportado del prototipo: no requiere APK ni Expo, y se valida en horas. En ese caso, saltar a Plan B (§8).

**GATE 0 (nuevo, antes de T2):** exportar el GLB desde el prototipo (*Export 3D Model (GLB)*), comprobar su peso/triángulos contra el presupuesto de §5 y confirmar que abre bien en three.js de escritorio. Si el bake excede el presupuesto, optimizarlo antes de meterlo en el teléfono.

### 11.1 Secuencia final (diseño cerrado)

| # | Tarea | Entregable | Coste |
|---|---|---|---|
| 1 | GATE 0 | GLB real exportado y medido; `maxTextureSize: 1024` aplicado si pesa de más | $0 |
| 2 | T2 | `ar3d/` con `index.html`, `app.js`, `escena.js`, `gestos.js`, `puente.js`, `vendor/`, `three/`, `draco/` (demo procedural: cubo de 1 m + regla de 3 m) | $0 |
| 3 | Deploy | Proyecto Cloudflare Pages apuntando a `ar3d/`, con `_headers` (cámara + CSP) | $0, sin tarjeta |
| 4 | **GATE 1** | Esfera de 1 m anclada al piso en el Chrome del Redmi, midiendo 1 m real | $0 |
| 5 | T1 | App Expo con prebuild, WebView y permisos de cámara | $0 |
| 6 | T4 + T3 | Gestos sobre `GRUPO` y carga del GLB real a escala 1:1 | $0 |
| 7 | T5 | Puente RN ⇄ WebView | $0 |
| 8 | T6.0 + T6.1 | `ModeloAr` + 3 endpoints; primer modelo subido por `curl` | $0 |
| 9 | T6.2 | Caché en `FileSystem` + static server `127.0.0.1` → modo avión | $0 |
| 10 | T7 | UX, créditos del engine y APK final | $0 |
| 11 | **GATE 2 / GATE 3** | Cámara dentro del WebView y criterios de §7 | $0 |

**Regla de oro del diseño final:** el sitio `ar3d` se despliega **una vez**. Los modelos entran por `POST`. Si en algún momento una tarea propone "agregar el GLB al repo y hacer push", esa tarea está mal — volver a esta tabla.

---

## 12. Referencias

| Recurso | URL |
|---|---|
| 8th Wall (framework, MIT) | https://github.com/8thwall/8thwall |
| 8th Wall Engine (binario SLAM) | https://github.com/8thwall/engine |
| Ejemplo three.js + World Effects | https://github.com/8thwall/threejs-world-effects-example |
| Docs oficiales | https://8thwall.org/docs |
| Troubleshooting de tracking | https://8thwall.org/docs/troubleshooting/world-tracking-issues |
| Requisitos de navegador | https://8thwall.org/docs/troubleshooting/browser-requirements |
| API `XrController.configure` | https://8thwall.org/docs/api/engine/xrcontroller/configure |
| Static server RN | https://github.com/birdofpreyru/react-native-static-server |
| react-native-webview | https://github.com/react-native-webview/react-native-webview |

---

## 13. Verificaciones ya realizadas (no repetir)

- `REDMI Note 15 Pro` aparece en la lista oficial de ARCore con *Depth API* → el fallo del usuario es de software, no de hardware. Aun así, el plan **no depende** de ARCore.
- `react-native-webview` concede permisos de cámara a `getUserMedia` (`RNCWebChromeClient.java`, líneas 143–180).
- 8th Wall tiene SLAM propio y no usa ARCore (docs, ver §1).
- 8th Wall corre en WebViews de apps Android (docs, ver §1).
- `@dr.pogodin/react-native-static-server` v0.28.1 disponible en npm.
- Versiones npm al 2026-11-16: `react-native-webview@14.0.1`, `react-native-vision-camera@5.2.4`, `@react-three/fiber@9.8.2`, `expo-gl@58.0.4`.

---

---

## 14. App móvil — plan de ejecución (GATE 1 superado el 2026-11-16)

**Estado:** pasos 1–4 de §11.1 hechos. `ar3d/` funciona en el Chrome del Redmi: el cubo de 1 m se ancla al piso y se queda quieto al caminar. Lo que sigue es convertir eso en APK.

### 14.1 Lo aprendido en el GATE 1 que la app hereda (no re-descubrir)

| Hallazgo | Consecuencia en la app |
|---|---|
| 8th Wall **no pide la cámara**: si el permiso está en `prompt`, el session manager aborta con `No valid session manager to handle this session` (pantalla negra, sin aviso) | La puerta de inicio con botón ("Iniciar AR" → `getUserMedia` → `XR8.run`) **se queda** en el APK. Es también el gesto de usuario que Android exige para el permiso. |
| three r185 parte el build en `three.module.js` + `three.core.js` | Si falta, el HUD se congela en "Cargando motor…". Copiar ambos al empaquetar `ar3d/`. |
| `XRExtras.RuntimeError` dibuja los fallos en pantalla | Se mantiene: en el APK no hay consola a la vista. |
| El motor se niega en escritorio (`Reality with camera on non-mobile devices requires disableWorldTracking`) | El APK no tiene este problema; sirve solo para descartar fallos por UA. |
| `?cam=front\|back`, `?debug`, `?auto` | La app los reutiliza: `?auto` cuando el permiso Android ya está concedido, `?debug` en builds de prueba. |

### 14.2 Hitos (cada uno termina en algo instalable y comprobable)

| # | Hito | Entregable | Se valida con |
|---|---|---|---|
| **M1** | **APK mínimo con WebView** | `apps/movil/` Expo + prebuild; permiso `CAMERA`; `<ARWebView>` a pantalla completa con `?auto=1` cargando `https://ar3d-puce.vercel.app/?modelo=demo`; APK debug instalado a mano | Cámara dentro de la app, sin navegador ni barra de URL, cubo de 1 m anclado. **GATE 2** |
| **M2** | **Offline: `ar3d/` dentro del APK** — **BLOQUEADO** | copia de `ar3d/` en `assets/ar3d`; static server en `127.0.0.1`; WebView apunta al loopback | Modo avión tras la primera apertura: la AR sigue abriendo |
| **M3** | **Controles nativos** | barra RN flotante (Recentrar / Bloquear / Reset / Escala) + overlay de estado, sobre el protocolo ya congelado de `puente.js` | Los botones mueven la escena; los mensajes `modelo-listo`/`tracking`/`error` llegan a RN |
| **M4** | **Modelo real desde el backend** | `ModeloAr` (metadatos) + bucket Neon Object Storage + 3 endpoints (T6.1); `GET /proyectos/:id/modelo/meta` para versionar la caché; GLB en `FileSystem` y servido por el static server | Subir un GLB con `curl` y verlo en el teléfono **sin reinstalar** |
| **M5** | **UX + APK de release** | lista de proyectos, pantalla *Acerca de / Créditos* del engine, ícono, `assembleRelease` firmado | Criterios de §7 completos |

> **Regla de secuencia:** M1 no toca backend ni servidor local. Si M1 falla (la cámara no abre dentro del WebView), el plan no avanza y se evalúa §8 — por eso va primero y es el hito más barato.

**Presupuesto de storage (verificado 2026-11-16):** Neon Free = 5 GB de Object Storage + 5 GB de egress por proyecto. 20 modelos de 8 MB = 160 MB (3 % del bucket). El egress es el límite real: cada GLB descargado por un teléfono cuenta una vez, pero el APK lo cachea por `version`, así que solo se descarga al publicar una versión nueva.

### 14.3 Contratos de la app (cerrados)

**`ARWebView` — props obligatorias**

```tsx
<WebView
  source={{ uri }}                      // M1: URL pública · M2+: http://127.0.0.1:<puerto>/...
  javaScriptEnabled
  domStorageEnabled
  mediaPlaybackRequiresUserGesture={false}
  allowsInlineMediaPlayback
  androidLayerType="hardware"
  onMessage={...}                       // protocolo de puente.js
  onPermissionRequest={...}             // RNW ya concede cámara si Android la dio
/>
```

**Antes de montar el WebView**, RN pide el permiso **de Android** (`expo-camera` / `PermissionsAndroid`). Si se deniega, no se monta el WebView: se muestra un botón para reintentar o abrir los ajustes del sistema. El permiso de la web (el toque en "Iniciar AR") sigue siendo obligatorio aparte; son dos capas distintas y ninguna se puede saltar.

**Protocolo web ⇄ RN:** el de `ar3d/puente.js`, sin cambios (prohibido renombrar, §9.6).

**URL de la escena:** `?modelo=<id>` + `?api=<backend>` + `?token=<jwt>`; `?auto=1` solo cuando el permiso Android ya está concedido y se quiere evitar el segundo toque.

### 14.4 Riesgos de esta etapa y su salida

| Riesgo | Señal | Salida |
|---|---|---|
| El WebView no concede la cámara | `getUserMedia` rechaza al instante en M1 | verificar `onPermissionRequest` + permiso Android + `usesCleartextTraffic` para `127.0.0.1` |
| **HTTP claro a loopback bloqueado** | la página no carga en M2 | `expo-build-properties` → `android.usesCleartextTraffic: true` (o network-security-config que permita `127.0.0.1`) |
| Render por software (WebView sin GPU) | 5–10 fps con el mismo GLB que en Chrome iba fluido | `androidLayerType="hardware"`; si persiste, evaluar Plan B §8 |
| Mata el proceso por memoria | cierre al cargar el GLB grande | bajar presupuesto de §5 (`maxTextureSize: 1024`, Draco) |
| Recompilar RN en cada prueba de la web | fricción diaria | la web se prueba en el navegador del teléfono; el APK solo cuando cambie la capa nativa |

### 14.5 Entorno local (verificado hoy)

- Node 24.18 · npm 12.0.1 · `adb` y `java` presentes.
- Android SDK en `~/Android/Sdk`: platforms **35 / 36 / 37**, build-tools 36.0.0–37.0.0.
- JDK del sistema = **25**; hay **JDK 21** instalado. **Corrección del 17-nov:** con Expo SDK 58 el plugin de Gradle de Expo exige un toolchain **JDK 17** y el 21 **no** alcanza (`Cannot find a Java installation ... languageVersion=17`). Se instaló Temurin 17 en `~/.local/jdk17` (sin root, fuera del repo) y se compila con `JAVA_HOME=java-21` + `-Porg.gradle.java.installations.paths=$HOME/.local/jdk17`. En otra máquina: instalar JDK 17 o configurar el resolver de toolchains (Foojay) en `android/settings.gradle`.
- **Sin dispositivo conectado y sin AVD**: el APK se compila aquí (`assembleDebug/Release`) y se instala en el Redmi; el emulador no sirve para AR (cámara falsa, sin SLAM).

### 14.6 Decisiones nuevas (cerradas)

| # | Decisión | Por qué |
|---|---|---|
| P9 | **M1 apunta a la URL desplegada**, no a `file://` | cero empaquetado para el primer GATE 2; `file://` no es contexto seguro fiable para `getUserMedia` |
| P10 | **Doble permiso, ambos explícitos**: Android en RN, cámara web en el toque del botón | son capas distintas; el motor exige el segundo concedido antes de `XR8.run` |
| P11 | **Sin login en M1–M3**: la demo es procedural y no toca backend | el primer APK no debe depender de auth |
| P12 | **Build local (`expo prebuild` + `gradlew`), no EAS** | sin cuentas ni tarjeta; mismo resultado para un APK propio |
| P13 | **Un solo modelo por pantalla**, `?modelo=<id>`; la lista de proyectos llega en M5 | evita construir navegación antes de que la AR esté probada dentro del APK |

### 14.7 Lo que falta decidir (no bloquea M1)

- **Token en M4:** ¿token de prueba embebido en el build o pantalla de login mínima reutilizando `dizelf_back`? Se decide al llegar a M4.
- **Distribución del APK:** instalación por USB/archivo (hoy) vs. release en Play Store más adelante.

### 14.8 Estado real del código para M4 (revisado el 2026-11-17)

Con §15 ya implementada, el camino del GLB está completo **menos una decisión**:

| Pieza | Estado |
|---|---|
| Generar y publicar el GLB desde el editor | **Hecho y verificado** (§15) |
| `GET /proyectos/:id/modelo` → 302 al bucket, `GET .../meta` para la caché | **Hecho y verificado** (preflight + `PUT` real) |
| `ar3d/escena.js` arma la URL `?api=<backend>&modelo=<id>&token=<jwt>` | **Escrito**, pero el `token` **no autentica**: `JwtAuthGuard` solo lee la cookie `tokenAcceso` y el header `Authorization: Bearer`, no la query |
| Descarga del GLB con credencial | **Falta**, y hay dos formas incompatibles de hacerlo |

**La decisión que hay que tomar (P20):**

| Opción | Cómo | Costo | Riesgo |
|---|---|---|---|
| **A. RN descarga con Bearer y sirve el GLB local** (coincide con M2/M4) | La app pide el GLB con `Authorization: Bearer <jwt>`, lo guarda en `FileSystem` y el static server de `127.0.0.1` lo entrega a `ar3d` | medio: hay que escribir la descarga y la caché por `version` | ninguno nuevo; el token no viaja en URLs |
| **B. El backend acepta `?token=` en el guard** | Una línea en `extraerTokenDeRequest` | bajo | el JWT queda en logs de proxy, historial del WebView y `Referer`; no se recomienda |

**Recomendación:** A. Deja el `?token=` de `escena.js` como camino de demo explícito y **sin uso en la app**; si se quiere conservar para probar la web en el teléfono, se resuelve con CORS + un token de corta vida, no con el JWT de sesión.

**Config que falta (no es código):** el origen del `ar3d` (`https://ar3d-puce.vercel.app`) y el del front desplegado tienen que estar en `FRONTEND_URL` (CORS del backend) **y** en la regla CORS del bucket, o el `fetch` del WebView falla en el preflight. Ver §15.9.

### 14.9 Estructura de la app y cambio de auth (decidido el 2026-11-17)

**Ubicación:** `movil/` en la raíz, hermano de `dizelf_front` y `dizelf_back`. No hay monorepo configurado, así que `apps/` no aportaría nada y obligaría a introducir workspaces.

```
movil/
├─ app.json                 # nombre, android.package, permisos, plugins
├─ package.json
├─ App.tsx
└─ src/
   ├─ pantallas/
   │  ├─ proyectos.tsx      # M5: lista + buscador
   │  ├─ ar.tsx             # permiso → WebView → barra nativa
   │  └─ login.tsx          # M4: identificador + contraseña
   ├─ componentes/
   │  ├─ ar-webview.tsx     # WebView y su ciclo de vida
   │  ├─ barra-ar.tsx       # Recentrar / Bloquear / Reset / Escala
   │  ├─ hud-ar.tsx         # tracking, modelo-listo, error (nativo)
   │  └─ puerta-permiso.tsx # cámara denegada: reintentar o ajustes
   ├─ lib/
   │  ├─ puente.ts          # tipos + validación del protocolo congelado
   │  ├─ api.ts             # base URL, fetch tipado, Bearer
   │  ├─ sesion.ts          # token en SecureStore + expiración
   │  ├─ modelo.ts          # descarga con progreso y caché por version
   │  └─ servidor-local.ts  # static server 127.0.0.1 (M2)
   └─ tipos/
```

**Reglas de arquitectura**

1. **La app no dibuja 3D.** El render vive en `ar3d/` dentro del WebView; RN lo enmarca, le pasa parámetros y recibe mensajes.
2. **El contrato es `puente.js`** (`modelo-listo|tracking|error` / `recentrar|reset|bloquear|escala`). `lib/puente.ts` lo espeja tipado y descarta mensajes desconocidos en vez de romper.
3. **Una pantalla de AR a la vez** (P13); la lista llega en M5.
4. **Sin estado global** (Redux/Zustand) ni router hasta M5: hooks + un `useState` de pantalla alcanzan.
5. **Token en `SecureStore`**, nunca en `AsyncStorage` ni en la URL del WebView.

**Cambio de backend: `POST /auth/token`**

El login actual no sirve para un cliente nativo: devuelve `{ usuario, mensaje }` y el JWT viaja **solo** en la cookie httpOnly `tokenAcceso`. Un WebView o RN no pueden leer esa cookie para armar un `Bearer`.

```
POST /auth/token      (público, sin cookie)
body: { identificador, password }        // mismo DTO que /auth/login
200:  { token, expiraEnSegundos, usuario }
```

- Se extrae la validación de credenciales de `login` a `validarCredenciales(dto)` en `auth.service.ts`; `/auth/login` (web, cookie) y `/auth/token` (nativo, cuerpo) la comparten. **No se duplica lógica.**
- No setea cookie. Nada cambia para el front web.
- **No se agregan endpoints de modelo:** los cuatro de §15 ya son lo que la app necesita.

**Decisiones**

| # | Decisión | Por qué |
|---|---|---|
| P20 | La app descarga el GLB con `Bearer` y lo sirve local; el `?token=` de `escena.js` queda solo como demo | el JWT no viaja en URLs (logs, `Referer`, historial del WebView) |
| P21 | `/auth/token` emite **30 días** de validez (`JWT_EXPIRACION_MOVIL`) | un TP no justifica refresh tokens; 1 día obligaría a loguearse siempre |
| P22 | `android.package = com.dizelf.ar` | queda fijo en el APK para siempre; cambiarlo después es otro paquete |
| P23 | El GLB se cachea como `modelos/<proyectoId>/v<version>.glb` y se valida contra `/modelo/meta` | no se re-descarga nada hasta que se publique una versión nueva |

**Pendiente opcional (M5):** incluir `modeloVersion` en `GET /proyectos` para evitar un `/meta` por proyecto en la lista. No se hace hasta medir la lista real.

### 14.10 Implementación del 2026-11-17 (M1, M3, M4 y M5 en código)

**Backend — hecho y verificado**

| Pieza | Archivo |
|---|---|
| `POST /auth/token` (JWT en el cuerpo, 30 días) | `auth.controller.ts`, `auth.service.ts` (`validarCredenciales` compartido) |
| Config de vigencia móvil | `env.config.ts` + `env.validation.ts` (`JWT_EXPIRACION_MOVIL_SEGUNDOS`, 2592000) |
| Pruebas | 3 nuevas en `auth.service.spec.ts` (10/10 en el archivo) |

**App (`movil/`, Expo SDK 58 · RN 0.88 · Expo Router)**

| Archivo | Qué hace |
|---|---|
| `src/app/_layout.tsx` | Stack sin headers |
| `src/app/index.tsx` | Lista de proyectos, refresco al volver, salir, acceso a la demo (M5) |
| `src/app/login.tsx` | Login contra `/auth/token` |
| `src/app/ar.tsx` | Permiso Android → modelo → WebView; HUD y comandos |
| `src/componentes/ar-webview.tsx` | WebView con `mediaCapturePermissionGrantType="grant"`, GPU y puente |
| `src/componentes/barra-ar.tsx` / `hud-ar.tsx` / `puerta-permiso.tsx` | Controles, estado y salida cuando se deniega la cámara |
| `src/lib/api.ts` | Fetch con `Bearer`, timeouts y errores del backend |
| `src/lib/sesion.ts` | Token en SecureStore + expiración con margen |
| `src/lib/modelo.ts` | `/meta`, caché `modelos/<proyecto>/v<N>.glb`, descarga con progreso y URL prefirmada |
| `src/lib/puente.ts` | Espejo tipado del protocolo congelado |

**Cambio en `ar3d`:** `escena.js` acepta `?glb=<url>` (URL prefirmada del bucket). La app descarga con `Bearer` y le pasa esa URL al WebView, así el JWT nunca entra a la página (P20).

**Verificado:** `tsc --noEmit` limpio, `expo-doctor` 20/20, bundle de Android generado con `expo export`, `prebuild` con `CAMERA`, `usesCleartextTraffic` y `com.dizelf.ar`, y **APK debug compilado**: `movil/android/app/build/outputs/apk/debug/app-debug.apk` (237 MB porque incluye las 4 ABIs y el soporte de dev; `aapt2 dump badging` confirma `com.dizelf.ar` y `android.permission.CAMERA`).

**El debug no sirve para instalar a mano:** en este template los variants debuggables **no llevan el bundle JS** (lo pide a Metro), por eso el `app-debug.apk` de 227 MB no abre solo en el teléfono. El artefacto para el Redmi es el **release**:

```bash
cd movil/android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk ANDROID_HOME=$HOME/Android/Sdk
export PATH=$JAVA_HOME/bin:$PATH
./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a \
  -Porg.gradle.java.installations.paths=$HOME/.local/jdk17
```

Sale en `app/build/outputs/apk/release/app-release.apk` (29 MB, firmado con la keystore de debug del template). Verificado con el `.env` real: el bundle incluye `https://sw1-dizelf-back.onrender.com`, el paquete es `com.dizelf.ar`, el label `Dizelf AR`, `CAMERA` y `native-code: arm64-v8a`. Las variables `EXPO_PUBLIC_*` se **inlinean al bundlear**, así que cambiar de backend exige recompilar (o usar Metro en debug).

**Bloqueo de M2:** `react-native-static-server` no se puede instalar (sus peers chocan con RN 0.88) y no hay un servidor estático mantenido para el SDK actual. Salidas posibles, en orden de costo: (a) módulo nativo mínimo en Kotlin servido por `127.0.0.1`; (b) empaquetar `ar3d` como un único HTML con todo inline y cargarlo con `source={{ html }}`; (c) seguir con la URL remota y aceptar que la AR necesita red. **Ninguna se elige sin probar en el Redmi.**

**Riesgos abiertos hasta el GATE 2:** nada de esto se ejecutó en un teléfono. En particular: si el WebView concede la cámara con `grant`, si `?auto=1` evita el toque sin romper el gesto requerido, y si el GLB carga desde el bucket (necesita el origen del `ar3d` en la regla CORS).

---

---

## 15. Front + backend: generar y publicar el GLB del proyecto

**Objetivo:** un botón en el editor del proyecto que **genera el GLB y lo guarda en Neon**, y lo **actualiza con el mismo botón**. Un solo GLB vigente por proyecto. Sin redeploy, sin cuentas nuevas, sin costo.

**Estado al 17-nov-2026:** F2 y F3 implementadas y verificadas (build, lint, 10 pruebas del servicio, rutas montadas con 401 sin sesión, migración `modelo_ar` aplicada). El bucket `modelos-ar` ya existe en la rama `production` del proyecto `gentle-queen-49289216`, con credencial S3 y CORS aplicado; se verificó con un round-trip S3 real (PUT/HEAD/GET/DELETE) y la API arranca sin el aviso de storage sin configurar. Se agregó `npm run storage:preparar`, que hace bucket + credencial + `.env` + CORS en un paso sin imprimir secretos. F1 sigue pendiente: medir el GLB real necesita el navegador con la escena abierta, y esta máquina no tiene Chrome. Falta cargar las cinco variables en Render y sumar el dominio del front a CORS.

### 15.1 Lo que ya existe (no hay que inventarlo)

| Pieza | Dónde | Estado |
|---|---|---|
| Export a GLB de la escena viva | `@pascal-app/editor` → `exportSceneToGlb(sceneGroup, nodes)` (público en el índice del paquete) | **Ya funciona**: es el mismo que usa el panel de Ajustes → *Export GLB* |
| Escena viva | `useScene.getState().nodes` y el grupo `scene-renderer` dentro del canvas R3F | ya en uso por el paquete (`export-manager.tsx`) |
| Guardado de escena / versiones | `POST /proyectos/:id/versiones`, `esquemaJson` en `Proyecto` | ya funciona |
| Auth y permisos | cookie httpOnly `tokenAcceso` + `Bearer`; `@RequiereCapacidad('leer'\|'editar')` con `ProyectoRolGuard` | ya funciona |
| Proxy same-origin del front | `/api/backend` (rewrite a `BACKEND_URL`) | ya funciona |
| Storage | Neon Object Storage (S3), bucket privado, 5 GB free | **por crear** |

> El paquete **no** exporta `prepareSceneForExport` ni `nextFrames`; solo `exportSceneToGlb`. Todo lo demás se resuelve con lo que ya está exportado.

### 15.2 Flujo (el botón hace los 4 pasos)

```
[editor] botón "Publicar AR"
  1. fuerza vista 3D + setExporting(true) + esperar 2 frames
  2. exportSceneToGlb(grupo, nodes)  →  ArrayBuffer (~2-30 MB)
  3. POST /proyectos/:id/modelo/url   →  { url, clave }   (URL prefirmada, 5 min)
  4. PUT a esa url  (directo a Neon, NO pasa por Render ni por Next)
  5. POST /proyectos/:id/modelo { clave, bytes }  →  HEAD + fila + borra el anterior
```

**Por qué prefirmada y no multipart por el backend:** el front vive en Vercel, y las funciones/proxy tienen tope de payload (~4,5 MB); un GLB de 15 MB **no pasa**. Además, con la URL prefirmada los bytes no cruzan Render: se ahorra su egress y su memoria, y el límite de 25 MB del endpoint deja de ser un problema de RAM.

### 15.3 Cambios en el backend (`dizelf_back`)

**a) Prisma** — `prisma/models/modelo_ar.prisma` (nuevo) + `modeloAr ModeloAr?` en `proyecto.prisma`:

```prisma
model ModeloAr {
  proyectoId  String   @id @map("proyecto_id") @db.Uuid
  proyecto    Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  clave       String   @map("clave")                 // modelos/<proyectoId>/<uuid>.glb
  version     Int      @default(0) @map("version")
  bytes       Int      @map("bytes")
  mime        String   @default("model/gltf-binary")
  actualizado DateTime @updatedAt @map("actualizado")
  @@map("modelo_ar")
}
```

`npx prisma migrate dev --name modelo_ar`. Una fila por proyecto (PK = `proyectoId`).

**b) Cliente S3** — `src/common/storage/s3.provider.ts` + `StorageModule`: `S3Client` con `endpoint: AWS_ENDPOINT_URL_S3`, `forcePathStyle: true`, `requestChecksumCalculation: 'WHEN_REQUIRED'` (**obligatorio**: sin eso las URLs prefirmadas rechazan el cuerpo real), y `@aws-sdk/s3-request-presigner`.

Variables nuevas en Render: `MODELOS_BUCKET`, `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (las saca `neon env pull`).

**c) Endpoints** — `controller/modelo-ar.controller.ts` + `service/modelo-ar.service.ts`, en el módulo de proyectos, con `ProyectoRolGuard` en todos:

| Método | Ruta | Capacidad | Qué hace |
|---|---|---|---|
| `POST` | `/proyectos/:id/modelo/url` | `editar` | Valida que el proyecto exista y **no esté en solo lectura**; devuelve `{ url, clave, expira }` para `PutObject` con `ContentType: model/gltf-binary` y clave `modelos/<proyectoId>/<uuid>.glb` (uuid: nunca se pisa un objeto a medio subir) |
| `POST` | `/proyectos/:id/modelo` | `editar` | Body `{ clave, bytes? }`: la clave es obligatoria y `bytes` es informativo (se mide con `HeadObject`, no se confía en el cliente). Verifica existencia, `ContentLength ≤ 25 MB` y prefijo del proyecto; upsert con `version + 1`; **`DeleteObject` de la clave anterior**; devuelve la meta |
| `GET` | `/proyectos/:id/modelo` | `leer` | **302** a una URL prefirmada de `GetObject` (60 s). Los bytes van cliente ⇄ bucket, sin pasar por Render |
| `GET` | `/proyectos/:id/modelo/meta` | `leer` | `{ hay, version, bytes, actualizado }` — es lo que consulta el APK para saber si su caché sigue vigente |

Sin `ModeloAr` → `404` en `GET` y `{ hay: false }` en `meta` (no es error: el proyecto aún no se publicó en AR).

**d) CORS del bucket** — `PutBucketCors` con `AllowedOrigins` = dominio del front + `http://localhost:3000`, `AllowedMethods: [PUT, GET, HEAD]`, `AllowedHeaders: [content-type]`, `ExposeHeaders: [etag]`. Se hace una vez por script (`scripts/config-bucket.mjs`), no a mano.

> **Estado (fase de prueba):** la regla quedó con `AllowedOrigins: ["*"]` porque todavía no hay dominio fijo (se prueba desde previews de Vercel que cambian). El síntoma de un origen que falta es engañoso: el `PUT` del editor falla con *"No se pudo conectar con el almacenamiento del modelo. Revisá tu conexión."* aunque sea un 403 de preflight, no un problema de red. Al fijar el dominio: `FRONTEND_URL=https://<front> npm run storage:setup`. `*` es tolerable acá porque el bucket es privado y cada `PUT`/`GET` exige URL prefirmada, que solo emite el backend autenticado.

**e) Validación de contenido** — `PUT` prefirmado no deja validar bytes. En el paso de confirmación se pide `Range: bytes=0-3` y se comprueba la firma `glTF`; si no coincide, se borra el objeto y se responde `400`. Barato (4 bytes) y evita publicar basura.

### 15.4 Cambios en el front (`dizelf_front`)

**a) `src/lib/ar/glb.ts`** — exporta en el navegador:

```ts
export async function exportarGlbDelProyecto(): Promise<Blob>
```

- Localiza el grupo: primer nodo de `sceneRegistry` (`@pascal-app/core`) y sube por `parent` hasta `name === 'scene-renderer'`. Si no aparece → error legible: *"Abrí la vista 3D antes de publicar"*.
- Si `useEditor` está en `2d`, fuerza `setViewMode('3d')` y espera `requestAnimationFrame` ×2 (la escena 3D no existe hasta que se monta).
- `useViewer.getState().setExporting(true)` → 2 frames → `exportSceneToGlb(grupo, useScene.getState().nodes)` → `Blob` → `setExporting(false)` en `finally`.
- **No** descarga: devuelve el `Blob` para subirlo.

**b) `src/lib/ar/modelo-ar.ts`** — API tipada: `apiPedirUrlModelo(proyectoId)`, `apiConfirmarModelo(proyectoId, {clave, bytes})`, `apiMetaModelo(proyectoId)`. La subida va con `XMLHttpRequest` **directo a la URL prefirmada** (no `apiClient`: es otro host y no lleva cookies) para poder mostrar porcentaje real; petición sin `credentials`, `Content-Type: model/gltf-binary`.

**c) `src/components/editor/boton-modelo-ar.tsx`** — botón "Publicar AR" en `editor-navbar.tsx` (junto a *Guardar versión*) + diálogo con: estado actual (`Publicado v3 · 7,4 MB · 12 nov`), botón **"Generar y publicar"**, barra de progreso (generando / subiendo %), y errores concretos (peso, sesión, red). Deshabilitado en `soloLectura`. Un solo botón crea o actualiza; si `version > 0` pide confirmación antes de reemplazar.
- No se agregó "descargar copia": el panel de Ajustes ya tiene *Export GLB* y duplicarlo sería un segundo camino para el mismo binario.
- Al terminar, refresca la meta y muestra `v(n+1)`.

**d) `src/types/ar.ts`** — `MetaModeloAr`, `UrlSubidaModeloAr`.

**d.1) CSP: `MODELOS_ORIGIN`** — el `PUT` va del navegador directo al bucket, que es otro origen, así que su host tiene que estar en el `connect-src` de `next.config.ts` (`MODELOS_ORIGIN=https://<rama>.storage.<region>.aws.neon.tech`, sin `/` final, variable de BUILD → cambiar exige redeploy). Sin eso el navegador corta el `PUT` antes de enviar bytes y el botón muestra *"No se pudo conectar con el almacenamiento del modelo. Revisá tu conexión."*: una violación de CSP con apariencia de falla de red. Comprobado en producción: el preflight desde `https://sw1-dizelf-front.vercel.app` al bucket responde `200` con `access-control-allow-origin: *` mientras la página bloqueaba la petición.

**e) Tope y mensajes**: `> 25 MB` → no se sube y se sugiere optimizar. `> 8 MB` → aviso amarillo pero se permite (el objetivo de móvil es ≤ 8 MB, §5).

### 15.5 Peso del GLB: medir antes de optimizar

`exportSceneToGlb` llama a `GLTFExporter.parse(..., { binary: true, animations })` **sin `maxTextureSize`**, así que las texturas KTX2 del editor se convierten a RGBA y se embeben como PNG. Un plano con material pintado puede salir de 15–40 MB.

**Orden:** (1) medir el GLB real del prototipo; (2) si supera 8 MB, bajar texturas con `patch-package` sobre `@pascal-app/editor/src/lib/glb-export.ts` añadiendo `maxTextureSize: 1024` al `parse()` (una línea, reproducible con `patch-package` y `postinstall`); (3) si aún así pesa, evaluar `@gltf-transform` en el navegador para redimensionar después del export. **No** activar KTX2 en el GLB: el móvil necesitaría transcoder y complica el ar3d.

### 15.6 Decisiones nuevas

| # | Decisión | Por qué |
|---|---|---|
| P14 | **Subida directa al bucket con URL prefirmada**; los bytes no pasan por Render ni por el proxy de Next | el proxy de Vercel corta ~4,5 MB y Render free no debe cargar 25 MB en RAM |
| P15 | **Un objeto vigente por proyecto**; al confirmar se borra el anterior | "un solo GLB por proyecto"; evita basura y confusión de qué versión ve el móvil |
| P16 | **La versión la sube el backend**, no el cliente (`version + 1` en el confirm) | el cliente no puede inventar versiones ni pisar la de otro |
| P17 | **`GET` responde 302 a URL prefirmada**, no streaming por Nest | ahorra egress de Render y memoria; el móvil cachea por `version` |
| P18 | **Publicar requiere capacidad `editar`** | un colaborador con edición también puede publicar; leer no alcanza |
| P19 | **Sin versiones históricas del GLB** (solo `Version` de la escena) | el historial de escena ya existe y se puede republicar en un clic |

### 15.7 Riesgos y salida

| Riesgo | Señal | Salida |
|---|---|---|
| Escena en 2D o sin montar | export vacío o `scene-renderer` no encontrado | forzar vista 3D + 2 frames antes de exportar; mensaje claro |
| GLB de 30 MB | subida lenta, OOM en el móvil | `maxTextureSize: 1024` (§15.5) y Draco |
| CORS del bucket mal configurado | `PUT` falla por preflight | `PutBucketCors` por script y probar desde `localhost:3000` y el dominio real |
| 403 en el `PUT` pese a URL válida | checksum firmado con cuerpo vacío | `requestChecksumCalculation: 'WHEN_REQUIRED'` en el `S3Client` |
| Navegador sin memoria al exportar | pestaña muere | exportar con la vista 3D y pocos niveles visibles; el export ya clona la escena |
| El APK no puede leer el GLB | 401 al pedir `/modelo` | ver §15.8 |

### 15.8 Lo que hay que decidir antes de M4 (móvil)

`GET /proyectos/:id/modelo` exige sesión. En el APK no hay cookie del front, así que **el móvil tendrá que autenticarse** (login propio) o habrá que añadir un **enlace público firmado** (token de un solo modelo, caducidad larga) para demos y para el modo navegador `ar3d?token=`. Ambas opciones caben sin tocar los endpoints; se decide al llegar a M4.

### 15.9 Verificación (obligatoria al terminar)

- [x] Bucket, credencial S3 y CORS del origen local verificados con un round-trip real (PUT/HEAD/GET/DELETE).
- [x] Preflight `OPTIONS` y `PUT` con cuerpo sobre una URL prefirmada, con `Origin: http://localhost:3000`.
- [ ] Los mismos dos chequeos con el origen del front y del `ar3d` desplegados.

- [ ] `curl -X POST /proyectos/:id/modelo/url` devuelve URL usable (`PUT` con `curl --upload-file casa.glb`).
- [ ] El botón del editor genera el GLB y lo deja en el bucket (visible en el panel de Neon).
- [ ] Segunda pulsación → `version = 2` y el objeto `v1` ya no existe en el bucket.
- [ ] `GET /modelo` responde 302 y el GLB descargado abre en three.js sin errores.
- [ ] `GET /modelo/meta` cambia de versión tras cada publicación.
- [ ] Un usuario sin `editar` recibe 403 en `POST` y 200 en `GET`.
- [ ] Un objeto que no empieza por `glTF` se rechaza con 400 y se borra.
- [ ] El GLB medido entra en el presupuesto de §5 (≤ 8 MB ideal, ≤ 25 MB duro).

### 15.10 Fases

| # | Fase | Entregable |
|---|---|---|
| F1 | Medir | **Pendiente**: GLB real exportado desde el prototipo, peso y triángulos anotados (requiere navegador) |
| F2 | Backend | **Hecho**: cliente S3 con token, `ModeloAr` + migración aplicada, 4 endpoints, CORS por script, 10 pruebas |
| F3 | Front | **Hecho**: `glb.ts`, `modelo-ar.ts`, `BotonModeloAr` en la navbar, subida con progreso |
| F4 | Cierre | **Hecho**: borrado del anterior, meta, avisos de peso, docs de storage en el README del back |

---

*Fin del documento. Si algo aquí resulta incorrecto al implementarlo, actualizar este archivo antes de continuar.*
