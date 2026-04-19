# INVENTARIO SOLU MOBILE — Modo solo lectura

**Fecha de auditoría:** 2026-04-19
**Auditor:** Claude (sin modificar archivos)
**Repo:** `solu-android` — rama `master`, 4 commits locales sin push, 7 archivos modificados sin commit.
**Build objetivo:** 24 abril 2026

---

## 📊 Resumen ejecutivo

App React Native / Expo SDK 55 / TypeScript. Arquitectura limpia (≈56 archivos fuente) con `expo-router` file-based routing. Backend principal: Supabase (datos + auth + realtime + storage) más API REST de solu.pe para integraciones sensibles (pagos Flow, RENIEC, Resend, NubeFact, IA Claude). Mobile consume >10 endpoints del backend web.

### Top 5 cosas que el owner necesita saber

1. **🔴 Claves en app.json commiteadas:** Google Maps API key aparece 3 veces en [app.json](app.json) y Supabase URL+anon key están como fallback hardcodeado en [src/lib/env.ts](src/lib/env.ts#L6-L7). El propio `.gitignore` tiene un comentario que dice "Use app.config.ts + EAS Secrets for sensitive values" pero eso nunca se hizo. Mixpanel token `f066dc22ac56e6bea53703c76239504c` también hardcodeado en [src/lib/analytics.ts:3](src/lib/analytics.ts#L3) y [src/lib/integrations.ts:122](src/lib/integrations.ts#L122).
2. **🟠 Sentry configurado pero inerte:** `SENTRY_DSN` está vacío (`extra.sentryDsn || ''`) en [env.ts:12](src/lib/env.ts#L12). El SDK se inicializa pero no reporta a ningún lado. O se configura o se saca el código.
3. **🟠 `useNetworkStatus` pingea `/api/admin-auth`:** El hook de detección offline hace GET cada 15s a `https://solu.pe/api/admin-auth` ([useNetworkStatus.ts:19](src/lib/useNetworkStatus.ts#L19)). Parece un endpoint de admin — probable typo, debería ser `/health` o similar.
4. **🟢 Estado general saludable:** TypeScript strict, `logger` wrapper que solo logea en DEV, `ErrorBoundary` en root, reconexión de Realtime con backoff en tracking, onboarding con AsyncStorage, offline cache y queue de acciones pendientes. Es código cuidado.
5. **🟠 Dos archivos grandes y frágiles:** [app/(tabs)/cuenta.tsx](app/(tabs)/cuenta.tsx) tiene ≈2000 líneas (dashboard completo del técnico) y [app/solicitar.tsx](app/solicitar.tsx) ≈670. No es deuda crítica pero cualquier cambio ahí requiere mucho cuidado antes del build del 24.

### Top 3 riesgos para el build del 24 abril

1. **4 commits locales sin push y 7 archivos sin commit.** Si EAS Build usa el repo remoto (o la versión local) hay que decidir explícitamente qué entra. Ver `git status` en §9.
2. **Versión estancada:** `package.json` y `app.json` están en 1.0.2, iOS `buildNumber: "2"`, Android `versionCode: 2`. `eas.json production` tiene `autoIncrement: true`, así que EAS debería bumpear build number en remoto, pero la **versión semántica** (1.0.2 → 1.0.3) probablemente deba bumpearse a mano antes del build.
3. **Android — [app.json](app.json) duplica `adaptiveIcon` dos veces** (líneas 38-42 y 90-95). La segunda define `backgroundColor: "#F26B21"` que la primera no tiene. Expo usa la última, pero es confuso y propenso a error.

### ¿El build del 24 va a salir limpio?

**Probable sí, con 3 acciones previas:**
(a) decidir qué commits entran al build y hacer push intencional,
(b) bumpear versión semántica si aplica,
(c) revisar 🔴 y 🟠 de arriba. El código parece build-ready; el riesgo real son los secretos expuestos (que no bloquean el build pero sí la App Store si Apple los audita).

---

## 1. Stack tecnológico detectado

- **Framework:** Expo SDK `~55.0.15` (muy nuevo) sobre React Native `0.83.4` y React `19.2.0`.
- **Router:** `expo-router ~55.0.12` (file-based routing).
- **Lenguaje:** TypeScript `~5.9.2` en modo `strict`, extendiendo `expo/tsconfig.base`.
- **Gestor de paquetes:** npm (`package-lock.json` presente, 366 KB).
- **Build config:** `eas.json` versión `>=18.4.0`, `appVersionSource: remote`, 4 perfiles (`development`, `preview`, `apk-prod`, `production`).
- **Plataformas declaradas:** iOS, Android, Web (con `react-native-web`).
- **Node version:** No hay campo `engines` en `package.json` → no hay enforcement.
- **Dependencias clave:**
  - `@supabase/supabase-js ^2.100.0`
  - `@sentry/react-native ~7.11.0`
  - `react-native-maps 1.27.2`
  - `expo-notifications ~55.0.19`, `expo-location ~55.1.8`, `expo-image-picker ~55.0.18`
  - `mixpanel-react-native ^3.3.0`
  - `@react-native-async-storage/async-storage ^2.2.0`
  - `@expo/vector-icons ^15.0.2`
- **No hay** eslint, prettier, jest, husky ni dependencias de testing.

---

## 2. Estructura del proyecto

```
solu-android/
├── app/                       # expo-router (pantallas)
│   ├── _layout.tsx
│   ├── (tabs)/                # barra inferior
│   │   ├── _layout.tsx
│   │   ├── index.tsx          # Home
│   │   ├── buscar.tsx         # Búsqueda
│   │   ├── micuenta.tsx       # Router cliente/técnico
│   │   ├── cuenta.tsx         # Dashboard técnico (≈2000 líneas)
│   │   ├── servicios.tsx      # Historial cliente
│   │   ├── vecinos.tsx        # Grupos vecinos
│   │   └── urgencias-tab.tsx  # Redirige a /soporte
│   ├── tecnico/[id].tsx       # Perfil público
│   ├── tracking/[code].tsx    # Seguimiento en vivo
│   ├── calificar/[code].tsx   # Reseña + fotos
│   ├── chat/[id].tsx          # Chat v1 (mensajes)
│   ├── chat-pedido/[code].tsx # Chat v2 (LiveChat realtime)
│   ├── agendar/[id].tsx       # Agendar cita
│   ├── solicitar.tsx          # Formulario solicitud (≈670 líneas)
│   ├── urgencias.tsx          # Emergencias
│   ├── registro.tsx           # Registro técnico (3 steps)
│   ├── registro-cliente.tsx   # Registro cliente
│   ├── recuperar.tsx          # Password reset
│   ├── soporte.tsx            # AI chat soporte
│   ├── fidelidad.tsx          # Programa puntos
│   ├── eliminar-cuenta.tsx    # GDPR-style
│   ├── privacidad.tsx
│   └── terminos.tsx
├── src/
│   ├── components/            # 12 componentes reutilizables
│   │   ├── TechCard, TechMapView, LiveTechMap, LiveChat,
│   │   │ ChatBot, NotificationCenter, AvailabilityPicker,
│   │   │ RatingBreakdown, SkeletonLoader, OfflineBanner,
│   │   │ OnboardingModal, ErrorBoundary
│   └── lib/                   # 17 módulos de lógica
│       ├── supabase.ts, env.ts, integrations.ts, notifications.ts,
│       ├── analytics.ts, logger.ts, matching.ts, smartIntent.ts,
│       ├── liveTracking.ts, offlineCache.ts, useAppUpdate.ts,
│       ├── useClientProfile.ts, useFavorites.ts, useLocation.ts,
│       ├── useNetworkStatus.ts, cloudinary.ts, imageCompress.ts,
│       └── constants.ts, types.ts
├── assets/                    # icons + splash
├── app.json                   # ⚠ contiene keys
├── eas.json
├── google-services.json       # gitignored pero presente localmente
└── package.json
```

**Convenciones detectadas:**
- 100% TypeScript (no hay `.js`/`.jsx` en `app/` o `src/`).
- Pantallas modales via `presentation: 'modal'` en `_layout.tsx`.
- Colores centralizados en `COLORS` (constants.ts).
- Hooks custom con prefijo `use*`.
- Sin tests. Sin Storybook. Sin CI detectable.

---

## 3. Integraciones externas detectadas

| Integración | Estado | Dónde | Notas |
|---|---|---|---|
| **Supabase** | ✅ Activa | [src/lib/supabase.ts](src/lib/supabase.ts) | URL + anon key en `ENV`. Usa `auth.getUser`, `.from()`, Storage (`fotos` bucket), Realtime (`channel` + `postgres_changes`). |
| **Flow.cl (pagos)** | ✅ Activa (vía backend) | [app/(tabs)/cuenta.tsx:81](app/(tabs)/cuenta.tsx#L81) | POST `/api/flow-subscribe`, abre `redirectUrl` con `Linking.openURL`. |
| **Culqi** | ❌ No aparece | — | Sin referencias. |
| **Yape / Plin** | ⚠ Legacy / solo texto | [app/agendar/[id].tsx:57,100](app/agendar/[id].tsx#L57) | Aparecen como etiquetas "Yape, Plin o efectivo" en UI de pago al técnico. No hay SDK/API. Commit `9d9be26` indica "remove Yape/Plin" — consistente. |
| **WhatsApp** | ✅ Activa (deep link + API backend) | [constants.ts:waLink](src/lib/constants.ts#L364), [integrations.ts:sendWhatsApp](src/lib/integrations.ts#L97) | Móvil usa solo `https://wa.me/…`. Envío de mensajes vía Cloud API lo hace el backend (`/api/notifications`). |
| **Google Maps** | ✅ Activa | [app.json:20,45,123](app.json#L20), [react-native-maps](src/components/LiveTechMap.tsx), [TechMapView](src/components/TechMapView.tsx) | Misma API key 3 veces. Detección de distrito con `expo-location` reverse geocoding. |
| **Google Places** | ❌ No detectado | — | Solo reverse geocoding nativo. |
| **Expo Push Notifications** | ✅ Activa | [src/lib/notifications.ts](src/lib/notifications.ts), llamadas directas a `https://exp.host/--/api/v2/push/send` en [solicitar.tsx:660](app/solicitar.tsx#L660) y [cuenta.tsx:1919](app/(tabs)/cuenta.tsx#L1919) | ⚠ 2 lugares envían push desde el cliente móvil (no desde backend). |
| **Firebase (FCM)** | ⚠ Parcial | `google-services.json` presente, **no tracked en git** | Sin SDK de Firebase en `package.json`. Expo usa FCM internamente para Android; `google-services.json` existe pero está gitignored. EAS Build lo sube por otro canal. |
| **Sentry** | ⚠ Configurado pero DSN vacío | [app/_layout.tsx:15](app/_layout.tsx#L15) | `Sentry.init({ dsn: '', enabled: !__DEV__, tracesSampleRate: 0.2 })`. No reporta nada en prod. |
| **Mixpanel** | ✅ Activa | [src/lib/analytics.ts](src/lib/analytics.ts), [integrations.ts:116](src/lib/integrations.ts#L116) | Token hardcodeado. Duplicado: init client-side + POST a `api.mixpanel.com/track` server-side. |
| **Anthropic / Claude** | ✅ Activa (vía backend) | [src/components/ChatBot.tsx:14](src/components/ChatBot.tsx#L14), [app/soporte.tsx:39](app/soporte.tsx#L39), [app/(tabs)/index.tsx:137](app/(tabs)/index.tsx#L137) | POST `/api/ai-chat` con `{type: 'support' | 'recommend', messages}`. No hay API key de Anthropic en el cliente (bien). |
| **RENIEC (Decolecta)** | ✅ Activa (vía backend) | [integrations.ts:verifyDNI](src/lib/integrations.ts#L8) | POST `/api/verify-dni`. |
| **NubeFact** | ⚠ Declarada pero no invocada desde mobile | [integrations.ts:emitBoleta](src/lib/integrations.ts#L76) | Función existe, no veo caller en `app/`. Puede que el backend lo dispare. |
| **Resend (email)** | ✅ Activa (vía backend) | [integrations.ts:sendEmail](src/lib/integrations.ts#L44) | POST `/api/send-email`. |
| **Cloudinary** | ✅ Activa | [src/lib/cloudinary.ts](src/lib/cloudinary.ts) | Solo transforma URLs (`res.cloudinary.com/{cloud}/image/fetch/…`). Sin upload directo. |
| **OneSignal** | ❌ No | — | — |

---

## 4. Features y pantallas identificadas

### Cliente
- ✅ **Home** ([tabs/index.tsx](app/(tabs)/index.tsx)): top técnicos, búsqueda smart con sugerencias, chatbot IA, stats.
- ✅ **Buscar** ([tabs/buscar.tsx](app/(tabs)/buscar.tsx)): lista + mapa, filtros por distrito/servicio, offline cache de resultados.
- ✅ **Mi Cuenta** ([tabs/micuenta.tsx](app/(tabs)/micuenta.tsx)): selector cliente/técnico.
- ✅ **Mis servicios** ([tabs/servicios.tsx](app/(tabs)/servicios.tsx)): login + historial.
- ✅ **Vecinos** ([tabs/vecinos.tsx](app/(tabs)/vecinos.tsx)): unirse/crear grupo con descuento 10%.
- ✅ **Solicitar técnico** ([solicitar.tsx](app/solicitar.tsx)): matching con `findBestTech` + push al técnico asignado.
- ✅ **Urgencias** ([urgencias.tsx](app/urgencias.tsx)): 6 emergencias preset.
- ✅ **Tracking en vivo** ([tracking/[code].tsx](app/tracking/[code].tsx)): 6 estados, mapa GPS en vivo, reconexión con backoff.
- ✅ **Perfil de técnico** ([tecnico/[id].tsx](app/tecnico/[id].tsx)): galería, reseñas, share.
- ✅ **Agendar cita** ([agendar/[id].tsx](app/agendar/[id].tsx)): disponibilidad + confirmación, pago al técnico.
- ✅ **Calificar** ([calificar/[code].tsx](app/calificar/[code].tsx)): rating 1-5 + hasta 2 fotos.
- ✅ **Chat** v1 ([chat/[id].tsx](app/chat/[id].tsx)) y v2 ([chat-pedido/[code].tsx](app/chat-pedido/[code].tsx)): ⚠ dos implementaciones (ver §10).
- ✅ **Fidelidad** ([fidelidad.tsx](app/fidelidad.tsx)): puntos → canje por WhatsApp.
- ✅ **Soporte IA** ([soporte.tsx](app/soporte.tsx)): Claude vía `/api/ai-chat`.

### Técnico
- ✅ **Dashboard** ([tabs/cuenta.tsx](app/(tabs)/cuenta.tsx)): 7 tabs (inicio, servicios, reseñas, cotizaciones, ingresos, plan, perfil), login con `/api/login-tech`, cambio de estado con streaming GPS, upload de documentos (DNI, antecedentes, certificados) vía `/api/upload-doc`.
- ✅ **Registro** ([registro.tsx](app/registro.tsx)): 3 pasos, verificación RENIEC obligatoria.
- ✅ **Suscripción Flow** ([tabs/cuenta.tsx:77-100](app/(tabs)/cuenta.tsx#L77)).

### Auth / cuenta
- ✅ **Login cliente** (`/api/login-client`), **login técnico** (`/api/login-tech`).
- ✅ **Registro cliente** (`/api/register-client`).
- ✅ **Password reset** ([recuperar.tsx](app/recuperar.tsx)): intenta WhatsApp → email → mostrar código en app como último recurso.
- ✅ **Eliminar cuenta** ([eliminar-cuenta.tsx](app/eliminar-cuenta.tsx)): anonimiza en Supabase.
- ✅ **Onboarding** ([OnboardingModal](src/components/OnboardingModal.tsx)): 3 slides, flag en AsyncStorage.
- ✅ **Privacidad** y **Términos**: documentos legales.

Ningún stub. Todas las pantallas tienen implementación real.

---

## 5. Conexión con el backend web (solu.pe)

Base URL: `https://solu.pe/api` (config en [env.ts:8](src/lib/env.ts#L8)).

| Endpoint | Método | Usado desde |
|---|---|---|
| `/ai-chat` | POST | [index.tsx](app/(tabs)/index.tsx#L137), [soporte.tsx](app/soporte.tsx#L39), [ChatBot.tsx](src/components/ChatBot.tsx#L14) |
| `/app-version` | GET | [useAppUpdate.ts](src/lib/useAppUpdate.ts#L32) — force update si < minVersion |
| `/appointments` | GET/POST | [AvailabilityPicker](src/components/AvailabilityPicker.tsx#L54), [agendar/[id].tsx](app/agendar/[id].tsx#L42) |
| `/calendar-sync` | (redirect) | [cuenta.tsx:832](app/(tabs)/cuenta.tsx#L832) — Google Calendar OAuth |
| `/certificado` | (redirect) | [cuenta.tsx:1309](app/(tabs)/cuenta.tsx#L1309) — genera PDF certificado |
| `/emit-boleta` | POST | [integrations.ts](src/lib/integrations.ts#L82) — NubeFact |
| `/flow-subscribe` | POST | [cuenta.tsx:81](app/(tabs)/cuenta.tsx#L81) — suscripción Flow |
| `/login-client` | POST | [servicios.tsx:75](app/(tabs)/servicios.tsx#L75) |
| `/login-tech` | POST | [cuenta.tsx:179](app/(tabs)/cuenta.tsx#L179) |
| `/notifications` | POST | [integrations.ts:sendWhatsApp](src/lib/integrations.ts#L99) |
| `/notify-tech` | POST | [integrations.ts:notifyTech](src/lib/integrations.ts#L62) |
| `/password-reset` | POST | [recuperar.tsx](app/recuperar.tsx#L34) |
| `/process-payment` | POST | [integrations.ts](src/lib/integrations.ts#L139) |
| `/register-client` | POST | [registro-cliente.tsx](app/registro-cliente.tsx#L31) |
| `/register-tech` | POST | [registro.tsx:143](app/registro.tsx#L143) |
| `/send-email` | POST | [integrations.ts](src/lib/integrations.ts#L46) — Resend |
| `/solicitudes/:id/accept` | POST | [cuenta.tsx:997](app/(tabs)/cuenta.tsx#L997) |
| `/upload-doc` | POST | [cuenta.tsx:459,1677](app/(tabs)/cuenta.tsx#L459) |
| `/verify-dni` | POST | [integrations.ts:verifyDNI](src/lib/integrations.ts#L18) |
| `/admin-auth` | GET | ⚠ [useNetworkStatus.ts:19](src/lib/useNetworkStatus.ts#L19) — usado como health-check (probable typo) |

**Además del backend propio:**
- `https://exp.host/--/api/v2/push/send` — Expo Push API (llamadas directas desde cliente).
- `https://api.mixpanel.com/track` — track server-side.
- `https://res.cloudinary.com/…` — transformación de imágenes.
- Supabase directo (`*.supabase.co`).

El acoplamiento web↔mobile es fuerte. Una migración del dominio `solu.pe` rompe casi todo.

---

## 6. Permisos del sistema (iOS + Android)

### iOS ([app.json:27-33](app.json#L27))
| Permiso | Mensaje |
|---|---|
| `NSPhotoLibraryUsageDescription` | "SOLU necesita acceso a tus fotos para subir tu foto de perfil y DNI." |
| `NSCameraUsageDescription` | "SOLU necesita acceso a tu cámara para tomar fotos de tu DNI y perfil." |
| `NSLocationWhenInUseUsageDescription` | "SOLU necesita tu ubicación para mostrar técnicos cerca de ti." |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | "SOLU necesita tu ubicación para encontrar técnicos disponibles en tu zona." |
| `ITSAppUsesNonExemptEncryption` | `false` |

⚠ **Faltan:** `NSMicrophoneUsageDescription` (pese a que Android declara `RECORD_AUDIO`) y `NSUserTrackingUsageDescription` (si Mixpanel usa IDFA, Apple puede rechazar).

### Android ([app.json:96-102](app.json#L96))
- `android.permission.CAMERA`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.RECORD_AUDIO`

⚠ `RECORD_AUDIO` declarado pero no encontré uso en el código (voice keyboard hint del commit `91ce6cc` no activa el mic programáticamente). Google Play puede pedir justificación.

### Deep links (Android)
6 path prefixes sobre `solu.pe`: `/tracking`, `/tecnico`, `/calificar`, `/chat`, `/solicitar`, `/fidelidad`.
iOS: `associatedDomains` a `solu.pe` y `www.solu.pe`.

---

## 7. Variables de entorno usadas

El cliente **no usa `process.env` en ningún lado**. Todo pasa por `Constants.expoConfig.extra.*` leído en [src/lib/env.ts](src/lib/env.ts):

| Campo `extra` | Usado como | Fallback hardcodeado |
|---|---|---|
| `supabaseUrl` | `ENV.SUPABASE_URL` | ✅ sí (pública) |
| `supabaseAnonKey` | `ENV.SUPABASE_ANON_KEY` | ✅ sí (asumida pública, protegida por RLS) |
| `apiBaseUrl` | `ENV.API_BASE_URL` | ✅ `https://solu.pe/api` |
| `cloudinaryCloudName` | `ENV.CLOUDINARY_CLOUD_NAME` | ✅ `dcwwvvb1e` |
| `yapeNumber` | `ENV.YAPE_NUMBER` | ✅ `983835904` — hardcoded y ya no debería usarse (Yape/Plin removidos) |
| `eas.projectId` | `ENV.EXPO_PROJECT_ID` | ✅ hardcoded |
| `sentryDsn` | `ENV.SENTRY_DSN` | ⚠ vacío por defecto |

**Secrets de EAS:** `eas.json` no define `env` ni `secrets` apart de `SENTRY_DISABLE_AUTO_UPLOAD`. Todo lo sensible vive en el cliente.

---

## 8. Código sospechoso / potencial deuda técnica

### Imports/librerías instaladas pero poco usadas
- `expo-clipboard` — en `package.json` pero no encontré imports en `app/` o `src/`.
- `expo-font` — declarado como plugin, sin carga de fuentes custom detectada.

### TODO/FIXME/HACK
- **Ninguno.** Grep a `TODO|FIXME|HACK|XXX` devolvió 0 matches.

### `console.*` fuera de `logger`
- [calificar/[code].tsx:47](app/calificar/[code].tsx#L47): `console.error('Error uploading foto:', err)`.
- [chat/[id].tsx:60,143,179,187](app/chat/[id].tsx#L60): 4 `console.warn` en producción.
- [tracking/[code].tsx:85](app/tracking/[code].tsx#L85): gated por `__DEV__` (ok).

Son pocos y no críticos, pero rompen el patrón `logger.*` que oculta logs en prod.

### URLs hardcodeadas
- `https://solu.pe/*` en 3 lugares fuera de `ENV.API_BASE_URL`:
  - [cuenta.tsx:832](app/(tabs)/cuenta.tsx#L832): `https://solu.pe/api/calendar-sync`
  - [cuenta.tsx:1309](app/(tabs)/cuenta.tsx#L1309): `https://solu.pe/api/certificado`
  - [useNetworkStatus.ts:19](src/lib/useNetworkStatus.ts#L19): `https://solu.pe/api/admin-auth`
  - [tecnico/[id].tsx:48](app/tecnico/[id].tsx#L48): `https://solu.pe/tecnico/${tech.id}` (share URL — ok).
- `https://exp.host/…` en 2 lugares (Expo Push).
- `https://api.mixpanel.com/track` en [integrations.ts:116](src/lib/integrations.ts#L116).

### Keys/tokens en texto plano ⚠
Ver §11.

### Código duplicado
- **Dos implementaciones de chat:** [app/chat/[id].tsx](app/chat/[id].tsx) (usa tabla `mensajes` vía select+insert, no realtime) y [app/chat-pedido/[code].tsx](app/chat-pedido/[code].tsx) → [LiveChat.tsx](src/components/LiveChat.tsx) (usa tabla `chat_mensajes` con realtime). El commit `91ce6cc` introdujo el segundo. Probable que el primero sea legacy.
- **Dos funciones `sendPushNotification` inline** en [solicitar.tsx:659](app/solicitar.tsx#L659) y [cuenta.tsx:1919](app/(tabs)/cuenta.tsx#L1919).

### Archivos grandes
- [app/(tabs)/cuenta.tsx](app/(tabs)/cuenta.tsx): ≈2000 líneas.
- [app/solicitar.tsx](app/solicitar.tsx): ≈670 líneas.
- [app/registro.tsx](app/registro.tsx): 24 KB.

### `adaptiveIcon` duplicado en [app.json](app.json)
Líneas 38-42 y 90-95 definen `adaptiveIcon` dos veces dentro de `android`. JSON válido (la segunda gana) pero confuso.

### `expo-image-manipulator` removido
[src/lib/imageCompress.ts](src/lib/imageCompress.ts) es un passthrough: comenta que expo-image-manipulator "has compatibility issues with SDK 55 EAS builds". OK como workaround, pero la calidad de las fotos DNI depende solo de `quality: 0.7` en ImagePicker.

### `dist/` commiteable
`dist/` está en `.gitignore` pero existe el folder. Verificar que no se subió accidentalmente.

---

## 9. Diagnóstico técnico (solo comandos de lectura)

### `git status`
```
On branch master
Your branch is ahead of 'origin/master' by 4 commits.

Modified (not staged):
  GOOGLE_PLAY_LISTING.md
  app/privacidad.tsx
  app/tecnico/[id].tsx
  app/terminos.tsx
  eas.json
  src/components/TechCard.tsx
  src/lib/env.ts
```

### `git log --oneline -20` (últimos 20 commits)
```
91ce6cc feat: live GPS tracking + internal chat + voice keyboard hint
866c308 feat: AI fallback search + waitlist flow + client push on state changes
9d9be26 fix: post-audit fixes — TS errors, SDK 55 packages, RENIEC, remove Yape/Plin
ff87b5f feat: UX improvements + bump to 1.0.2 + adaptive icon config
ce6584e feat: upload de antecedentes y certificados en app móvil
d6ab0fa feat: 10 categorías + 200 servicios + lenguaje neutro
43e31f3 feat: app multi-categoría — 7 categorías, 138 servicios
c366c1a rebrand: SOLU — Lo que necesites, hoy
4522892 feat: modo offline + Google Calendar sync en app móvil
75da6f0 feat: 8 nuevas funcionalidades para panel del técnico
3f1807a feat: 8 mejoras del panel del técnico
ab8ec67 feat: agregar cambio de foto de perfil para técnicos
236abf1 fix: SearchBar como botón + distritos buscables en toda la app
b737a82 fix: SearchBar Home convertida a botón navegable
1c1117b fix: 5 bugs adicionales encontrados en auditoría final
a5d07ab fix: pago de membresía no abría link de Flow
b54237c fix: 3 bugs críticos en app Android
3bfb49a fix: corregir SearchBar, stats y búsqueda en Android
91c42a6 chore: bump version to 1.0.1 for App Store resubmission
5e7425a fix: resolver 3 rechazos de Apple App Store
```

### Inventario de archivos
- Total archivos fuente (`.ts` / `.tsx`, excluyendo node_modules/.expo/dist): **56**.
- `app/` screens: **25** archivos.
- `src/lib/`: **17** módulos.
- `src/components/`: **12** componentes.

### Contenido clave de `package.json`
Expo ~55.0.15, React 19.2.0, RN 0.83.4, Sentry ~7.11.0, Supabase ^2.100.0, Mixpanel ^3.3.0, expo-router ~55.0.12. Ver §1 para la lista completa.

---

## 10. ❓ Preguntas para el owner

### 🔴 Críticas (bloquean o riesgan el build del 24)

1. **Claves en `app.json`:** ¿Querés rotar la Google Maps API key y moverla a EAS Secrets + `app.config.ts` antes del build? Alternativa mínima: restringir la key en Google Cloud Console a `pe.solu.app` (Android) y al bundle ID de iOS. Si no hacés nada, la key sigue expuesta pero el build sale igual.

2. **Versión semántica vs build number:** ¿Bumpeamos `1.0.2 → 1.0.3` antes del build del 24? Hay 2 features grandes sin release (live GPS tracking + chat interno). `eas.json production` autoincrementa build number, pero no la versión.

3. **4 commits locales sin push + 7 archivos sin commit:** ¿Qué entra al build? En particular los unstaged `src/lib/env.ts`, `eas.json`, `src/components/TechCard.tsx`, `app/privacidad.tsx`, `app/tecnico/[id].tsx`, `app/terminos.tsx` están modificados localmente.

4. **Dos implementaciones de chat coexistiendo:** ¿[app/chat/[id].tsx](app/chat/[id].tsx) es legacy y podemos borrarlo, o sigue en uso por alguna ruta? No encontré linker directo desde las tabs.

### 🟠 Importantes (no bloquean)

5. **Sentry sin DSN:** ¿Configuramos Sentry real o eliminamos la dependencia? La librería pesa y no hace nada con DSN vacío.

6. **`useNetworkStatus` pegando a `/api/admin-auth`:** ¿Es intencional? Se pegan 4 GET/min por cliente a un endpoint que suena a admin. Probable debería ser `/api/health`.

7. **Permiso `RECORD_AUDIO` en Android sin uso aparente:** ¿Hay feature de voz planeada? Si no, Google Play puede pedir justificación o rechazar.

8. **iOS falta `NSMicrophoneUsageDescription` y `NSUserTrackingUsageDescription`:** Apple rechazó esta app 3 veces antes (commits `5e7425a`, `91c42a6`). Con Mixpanel activo, ATT puede volver a ser issue.

9. **`adaptiveIcon` duplicado en [app.json](app.json):** ¿Cuál es el correcto, con o sin `backgroundColor: "#F26B21"`? Cuando el `foregroundImage` ya incluye el fondo naranja, agregar `backgroundColor` puede verse raro.

10. **`google-services.json` presente localmente pero gitignored:** ¿EAS Build lo recibe por un secret config? Si no está subido ni en git ni en EAS, el build Android sin Firebase podría romper push notifications.

### 🟡 Menor

11. **NubeFact `emitBoleta` no tiene callers:** ¿Se invoca desde el backend o está muerta en el cliente?

12. **`imageCompress.ts` es passthrough:** ¿Mantener comentario "future upgrade path" o borrar?

13. **Mixpanel duplicado (client + server-side track):** ¿Intencional para redundancia o se puede consolidar?

14. **Dependencias sin uso:** `expo-clipboard`, `expo-font` parecen no usarse. ¿Borrarlas?

---

## 11. 🚨 Hallazgos críticos

### 🔴 SEV-HIGH — Secretos en repositorio

1. **Google Maps API key** — hardcoded 3 veces en [app.json](app.json) (líneas 20, 45, 123): `AIzaSyA3WHoPEfjZHdrYpH6auE4aab-7AJFZSFM`.
   - **Impacto:** si no está restringida por bundle ID + huella de firma, cualquiera la usa y consume tu quota.
   - **Mitigación inmediata:** Google Cloud Console → APIs y servicios → Credenciales → restringir por app Android/iOS.

2. **Mixpanel project token** — hardcoded en [src/lib/analytics.ts:3](src/lib/analytics.ts#L3) y [src/lib/integrations.ts:122](src/lib/integrations.ts#L122): `f066dc22ac56e6bea53703c76239504c`.
   - **Impacto:** relativamente bajo (los project tokens de Mixpanel están diseñados para exponerse en clientes), pero no debería duplicarse.

3. **Supabase URL + anon key** — fallback hardcoded en [src/lib/env.ts:6-7](src/lib/env.ts#L6) y también en `app.json`.
   - **Impacto:** anon keys están diseñadas para exponerse; el riesgo real depende de las RLS policies. Revisar que todas las tablas sensibles tengan RLS activo.

4. **Google API key en `google-services.json`** (`AIzaSyBJw4ScsZdY4czQLsj3UXtHilZy8aVBfo0`).
   - **Estado:** el archivo está gitignored y `git ls-files` confirma que no está trackeado. ✅ OK.

### 🟠 SEV-MEDIUM

5. **Push directo desde cliente a `exp.host`:** [solicitar.tsx:660](app/solicitar.tsx#L660) y [cuenta.tsx:1919](app/(tabs)/cuenta.tsx#L1919) envían push sin pasar por backend. Cualquier usuario con el push_token de otro puede enviar notificaciones falsas. Debería centralizarse en un endpoint del backend que valide permisos.

6. **`app/eliminar-cuenta.tsx` "borra" via UPDATE a la misma fila** (no DELETE). El usuario eliminado queda como `nombre: 'ELIMINADO', whatsapp: ''`. GDPR/Ley de Protección de Datos peruana normalmente exige borrado real después de N días. Documentar política.

7. **Login del técnico expone login/password por HTTPS directo al cliente** ([cuenta.tsx:179](app/(tabs)/cuenta.tsx#L179)). Asumo que el backend hace bcrypt (consistente con memoria `project_solu`). Verificar rate-limiting en `/api/login-tech` para prevenir brute-force.

8. **Sin certificate pinning ni detección de root/jailbreak.** Aceptable para app cliente estándar, pero si hay flujos de pago más adelante, evaluar.

### 🟢 SEV-LOW (no crítico pero notable)

9. **`console.*` en 4 archivos** no gated por `__DEV__`, ver §8.
10. **Fallback de password reset imprime el código en pantalla** ([recuperar.tsx:71](app/recuperar.tsx#L71)) cuando WA y email fallan. Razonable como UX pero considerar si dispara alertas de seguridad.

---

## 12. Notas finales

- **Carpeta `.git/`, `node_modules/`, `dist/`, `.expo/` no fueron leídas.**
- **No se ejecutó** `npm install`, `expo-doctor`, `eas build`, ni ningún comando de escritura o red que modifique estado.
- **Todas las lecturas fueron locales** sobre archivos ya checked-out.
- **Este archivo es el único creado;** no se modificó ningún otro archivo del proyecto.
