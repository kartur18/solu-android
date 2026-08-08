// Config dinámica de Expo. `app.json` sigue siendo la fuente de verdad de
// todo lo demás: acá solo inyectamos los valores que NO queremos commitear.
//
// Existe porque `src/lib/env.ts` lee `extra.sentryDsn` y app.json no puede
// leer variables de entorno, así que el DSN solo se podía dejar hardcodeado.
// Con esto se setea como secret y no viaja al repo:
//   eas secret:create --scope project --name SENTRY_DSN --value "https://...@...ingest.sentry.io/..."
//
// Si la variable no está, cae al valor de app.json (vacío) y Sentry
// simplemente no se inicializa — la app funciona igual, sin reporte de crashes.
//
// PERMISOS ANDROID (ago-2026, previo a Google Play) — el porqué de app.json,
// que al ser JSON no admite comentarios:
// - `microphonePermission: false` en expo-image-picker: su config plugin agrega
//   RECORD_AUDIO por su cuenta aunque nunca se grabe. expo-av está desinstalado
//   (ver src/lib/audioChat.ts) así que la app NO puede grabar audio: un permiso
//   de micrófono sin uso es causa directa de rechazo en Play.
// - `blockedPermissions` repite RECORD_AUDIO y suma MODIFY_AUDIO_SETTINGS por si
//   otra dependencia los reintroduce en un futuro upgrade.
// - Ubicación solo en primer plano: nunca se llama requestBackgroundPermissions,
//   por eso los strings "Always" de iOS van en false (si se omiten, el plugin
//   inyecta el texto default en inglés en vez de borrarlos).
// - App Links: la verificación de Android NO sigue redirects y solu.pe hace 301
//   a www.solu.pe, así que el apex rompía la verificación de TODO el filtro.
//   Queda un filtro autoVerify solo con www.solu.pe y otro sin verificar para el
//   apex. Tras publicar hay que sumar a assetlinks.json la huella SHA-256 de
//   Play App Signing, o los deep links no abren la app.
// - Mismo motivo en iOS: apple-app-site-association del apex también da 301 y
//   Apple tampoco sigue redirects, así que `associatedDomains` quedó solo con
//   www.solu.pe. Se agregó webcredentials:www.solu.pe, que faltaba: el autofill
//   de contraseñas apuntaba únicamente al apex roto.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    sentryDsn: process.env.SENTRY_DSN || config.extra?.sentryDsn || '',
  },
})
