# Dizelf AR (app móvil)

Visor de realidad aumentada de Dizelf: un WebView con `ar3d/` (8th Wall + three.js),
enmarcado por controles nativos. Funciona **sin ARCore**.

## Requisitos

- Node 20+ y el proyecto instalado (`npm install`).
- JDK **17** (lo exige el plugin de Gradle de Expo SDK 58; el 21 o el 25 solos no
  alcanzan) y Android SDK con platform 35+.
- Sin emulador: la AR necesita cámara real; el APK se instala a mano en el teléfono.

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk   # o el JDK 17 que tengas
export ANDROID_HOME=$HOME/Android/Sdk
```

## Variables

`.env`:

```
EXPO_PUBLIC_API_URL=https://tu-backend      # backend en Render, sin barra final
EXPO_PUBLIC_AR3D_URL=https://ar3d-puce.vercel.app/
```

Si `EXPO_PUBLIC_API_URL` queda vacía, la app abre igual y solo la lista y el
modelo fallan con un mensaje claro; la demo del motor sigue funcionando.

## Comandos

```bash
npm start              # Metro
npx expo run:android   # compila e instala (con el teléfono conectado)
npx expo prebuild -p android --no-install
cd android && ./gradlew assembleDebug      # solo con Metro: no lleva el JS dentro
./gradlew assembleRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a    # instalable a mano
```

El APK instalable queda en `android/app/build/outputs/apk/release/app-release.apk`
(firmado con la keystore de debug del template). El de `debug/` no sirve para
instalar suelto: ese variant pide el JS a Metro.

`EXPO_PUBLIC_*` se inlinea al bundlear: si cambiás la URL del backend hay que
volver a compilar el release (en debug basta reiniciar Metro con `-c`).

## Estructura

```
src/app/               rutas (Expo Router): index (proyectos), login, ar
src/componentes/       WebView, barra de controles, HUD, puerta de permiso
src/lib/               api, sesión (SecureStore), modelo (caché), puente
src/tipos/             espejo de los DTO del backend
```

## Cómo llega el modelo a la escena

1. La app pide `GET /proyectos/:id/modelo/meta` y compara la `version` con la caché
   local (`modelos/<proyectoId>/v<N>.glb`).
2. Si cambió, descarga con `Authorization: Bearer` (progreso incluido).
3. Pide la URL prefirmada del bucket y abre `ar3d` con `?glb=<url>`.

El token de sesión **nunca** entra a la URL del WebView.

## Pendiente

- **M2 (offline)**: no hay servidor estático compatible con RN 0.88; ver plan §14.10.
  Hoy el visor se carga desde Vercel y la AR necesita red.
- Probar en el Redmi: permiso dentro del WebView, `?auto=1` y carga del GLB desde el
  bucket (requiere el origen del `ar3d` en la regla CORS del bucket).
