import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * Config nativa que depende del perfil de build.
 *
 * `app.json` sigue siendo la base; esto solo ajusta lo que no puede ser igual
 * en desarrollo y producción:
 *
 *  - `usesCleartextTraffic`: el backend local es http, pero un APK de producción
 *    que acepta tráfico sin TLS permite que cualquiera en la misma red lea el
 *    token. Antes estaba en `true` para todos los builds.
 *  - `expo-notifications`: agrega el servicio nativo de push.
 *  - `googleServicesFile`: FCM para Android. Sin este archivo el token de Expo
 *    no se puede emitir en un build propio.
 *
 * `APP_VARIANT` lo define `eas.json` por perfil; si falta, se asume producción
 * (el default seguro).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const esDesarrollo = process.env.APP_VARIANT === "development";

  const plugins = (config.plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") {
      return plugin;
    }

    const opciones = (plugin[1] ?? {}) as {
      android?: Record<string, unknown>;
    };

    return [
      plugin[0],
      {
        ...opciones,
        android: {
          ...(opciones.android ?? {}),
          usesCleartextTraffic: esDesarrollo,
        },
      },
    ];
  });

  return {
    ...config,
    // `ConfigContext` tipa name/slug como opcionales aunque app.json los tenga.
    name: config.name ?? "Dizelf AR",
    slug: config.slug ?? "dizelf-ar",
    android: {
      ...config.android,
      googleServicesFile: "./google-services.json",
    },
    plugins: [...plugins, "expo-notifications"] as ExpoConfig["plugins"],
  };
};
