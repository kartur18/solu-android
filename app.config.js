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
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    sentryDsn: process.env.SENTRY_DSN || config.extra?.sentryDsn || '',
  },
})
