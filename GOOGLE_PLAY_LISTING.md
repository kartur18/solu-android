# SOLU — Ficha de Google Play (material listo para copiar/pegar)

**Estado:** listo para cargar en Play Console. Última revisión: 8-ago-2026.
**Paquete:** `pe.solu.app` · **versionName:** 2.3.1 · **versionCode:** 37

> Regla que costó dos rechazos de Apple: **todas las URLs van con `www`**.
> `https://solu.pe/...` responde **301** a `https://www.solu.pe/...` y los
> verificadores (Apple, Google y el verificador de App Links de Android) **no
> siguen redirects**. Verificado el 8-ago-2026 con `curl`:
> `www.solu.pe/privacidad` → 200 · `solu.pe/privacidad` → 301.

---

## 1. Textos de la ficha

### Título (máx. 30 caracteres)

```
SOLU: técnicos para tu hogar
```

*28 caracteres.* Alternativas ya medidas por si Carlos prefiere otro enfoque:

| Opción | Chars | Cuándo usarla |
|---|---|---|
| `SOLU: técnicos para tu hogar` | 28 | **Recomendada.** Marca + categoría + beneficio. |
| `SOLU: gasfiteros y técnicos` | 27 | Más ASO: "gasfitero" es la búsqueda real hoy. |
| `SOLU: encuentra tu técnico` | 26 | Más corta, menos keyword. |

### Descripción corta (máx. 80 caracteres)

```
Gasfiteros y electricistas verificados por DNI. Buscar y contactar es gratis.
```

*77 caracteres.* No lleva cifras porque hoy no hay ninguna cifra de volumen
que sea honesta publicar.

### Descripción larga (máx. 4000 caracteres)

```
SOLU conecta a quien necesita un servicio en casa con especialistas verificados por DNI. Buscar y contactar es gratis para el cliente: tú eliges a quién le escribes y le pagas directo al especialista lo que acuerden.

SI NECESITAS UN SERVICIO
• Busca gasfitero, electricista, pintor, cerrajero, carpintero, técnico en refrigeración, personal de limpieza y más de 200 servicios repartidos en 10 categorías.
• Filtra por distrito, oficio, calificación y disponibilidad.
• Mira el perfil completo antes de escribir: oficios, zonas donde trabaja, fotos de trabajos y reseñas de clientes que ya lo contrataron.
• Escríbele por el chat de la app o por WhatsApp. Contactar no te cuesta nada.
• Sube una foto del problema y el asistente te dice qué especialista te conviene buscar.
• Sigue tu servicio con un código de seguimiento y recibe avisos cuando cambia de estado.
• Acuerda el precio directo con el especialista y págale a él (Yape, Plin, efectivo o tarjeta). SOLU no cobra comisión sobre el trabajo.
• Califica al final: tu reseña queda pública y le sirve al siguiente vecino.

SI ERES ESPECIALISTA
• Registrarte es gratis. Verificamos tu DNI contra RENIEC para que el cliente sepa que eres quien dices ser.
• Recibes 8,000 SoluCoins de bienvenida para responder tus primeros contactos. Vencen a los 30 días.
• Pagas solo cuando decides responder un contacto, nunca por estar en la app. Ves el costo exacto ANTES de aceptar: un contacto de hogar típico cuesta 1,000 SoluCoins (S/5) y el rango va de 160 a 4,000 SoluCoins según el distrito y la urgencia.
• Sin suscripción mensual y sin comisión sobre lo que cobras. El cliente te paga a ti, directo.
• Paquetes prepagos desde S/30 (6,000 SoluCoins) hasta S/1,200 (360,000 SoluCoins), con boleta electrónica por cada compra.
• Niveles Bronce, Plata, Oro y Platino: mientras más trabajos cierras y mejor te califican, mayor tu descuento en los paquetes (8%, 15% y 25%).
• Te devolvemos 100 SoluCoins por cada cierre confirmado.
• Defines tus oficios, tus zonas de trabajo y tu disponibilidad desde el celular.
• Panel con tus contactos, tu agenda del día, tus reseñas, tus ingresos y el detalle de cada movimiento de SoluCoins.
• Aviso al toque en tu celular cuando entra un contacto en tu zona.

VECINOS SOLU
Arma un grupo con tu edificio o condominio y comparte el código con tus vecinos para encontrar especialistas que ellos ya probaron.

DÓNDE FUNCIONA
Los 43 distritos de Lima Metropolitana y los 7 del Callao, más Arequipa, Trujillo, Chiclayo, Piura, Cusco, Huancayo, Iquitos y otras ciudades del Perú. Estamos empezando: la cantidad de especialistas disponibles varía según la zona y el oficio, y te lo decimos de frente antes de que pierdas el tiempo.

TUS DATOS
La foto de tu DNI se guarda en almacenamiento privado: solo la usa el equipo de SOLU para verificarte y nunca aparece en tu perfil ni se le muestra a ningún cliente. Puedes borrar tu cuenta desde la misma app, en cualquier momento, sin escribirle a nadie.

Operado por CITYLAND GROUP E.I.R.L. (RUC 20614914239)
Soporte: WhatsApp 983835904 · contacto@solu.pe
Web: https://www.solu.pe
Privacidad: https://www.solu.pe/privacidad
Términos: https://www.solu.pe/terminos
```

**Por qué dice lo que dice (no cambiar sin revisar esto):**

- Cero cifras de volumen ("+500 especialistas", "miles de clientes"). Hoy hay
  5 especialistas registrados: cualquier número de ese tipo sería falso y ya se
  retiró antes de la web.
- "más de 200 servicios en 10 categorías" y "43 distritos de Lima + 7 del
  Callao" **sí** son verificables abriendo la app (`src/lib/constants.ts`:
  `SERVICIOS` = 223, `CATEGORIAS` = 10, `DISTRITOS` cubre los 43 + 7).
- **No dice "la foto del DNI se elimina a los 30 días".** Esa frase estaba acá
  y se sacó: **hoy no existe el código que la borre.** No hay cron de purga
  (`vercel.json` tiene 40 crons y ninguno toca storage), no hay un solo
  `storage.from(...).remove(...)` en el repo web, y `anonimizar.ts` solo pone
  `dni_frente_url = null` en la fila cuando el técnico borra su cuenta — el
  objeto sigue en el bucket. Lo que sí es cierto y quedó escrito es que el
  bucket es privado y que la foto no se muestra en el perfil. **Ver el
  bloqueante #0 de §6: la promesa de los 30 días sigue publicada en
  `www.solu.pe/privacidad` y en `app/privacidad.tsx`, y Play te hace
  responsable de la política que enlazas.**
- No promete garantías que impliquen trabajo gratis del especialista.
- No nombra a ningún competidor.
- Tuteo peruano en todo ("tú eliges", "puedes", "recibes"). Nada de voseo.
- "Estamos empezando" es a propósito: fija expectativa real y además es lo que
  Google pide (la descripción tiene que describir la app tal como es).

### Otros campos de la ficha

| Campo | Valor |
|---|---|
| Categoría | Casa y hogar (House & Home) |
| Etiquetas | Servicios locales · Hogar · Reparaciones |
| Email de contacto | contacto@solu.pe |
| Teléfono de contacto | +51 983835904 |
| Sitio web | https://www.solu.pe |
| Política de privacidad | https://www.solu.pe/privacidad |
| Eliminación de cuenta (URL) | https://www.solu.pe/eliminar-cuenta |
| Eliminación de cuenta (en la app) | Mi Cuenta → Legal → "Eliminar mi cuenta" |
| Contiene anuncios | No |
| Compras en la app (Play Billing) | No — ver §5 |
| Público objetivo | 18 años en adelante |

---

## 2. Gráficos que hay que subir

| Recurso | Especificación de Play | Estado |
|---|---|---|
| Ícono | 512×512 PNG 32-bit, ≤1 MB, sin transparencia útil | **Listo:** `assets/icon.png` (512×512, 96.7% opaco) |
| Gráfico de función | 1024×500 PNG/JPG, sin texto pegado a los bordes | **FALTA — bloquea la publicación** |
| Capturas de teléfono | Mín. 2, máx. 8. Lado corto ≥320 px, largo ≤3840 px. Usar 1080×1920 | **FALTAN las 8** |
| Capturas de tablet | Opcionales | No hacen falta (la app es solo teléfono, `supportsTablet: false`) |
| Video promocional | Opcional, link de YouTube | No hace falta para lanzar |

### Gráfico de función (1024×500)

Fondo `#1E3A5F` (el navy del splash), logo SOLU centrado en blanco, claim
"Lo que necesites, hoy" y un acento `#F26B21`. **Sin cifras, sin fotos de stock
de gente con casco** (Google rechaza gráficos que parezcan un anuncio con
llamada a la acción tipo "¡DESCARGA YA!" o que muestren premios/rankings).

### Las 8 capturas: qué pantalla y por qué esa

El orden importa: Play muestra las 2 primeras en el listado de búsqueda.
Como el objetivo del lanzamiento es **captar especialistas**, la 1 y la 2
tienen que hablarle al cliente (es lo que hace creíble la app) y de la 3 en
adelante al especialista (es a quien queremos convertir).

| # | Pantalla | Ruta en el código | Por qué esa |
|---|---|---|---|
| 1 | Inicio: buscador + categorías | `app/(tabs)/index.tsx` | Primera impresión. En 1 segundo se entiende qué es la app. |
| 2 | Buscar: lista de especialistas con calificación, oficio y zona | `app/(tabs)/buscar.tsx` | Demuestra que hay catálogo real y filtros. Es la pantalla que Google usa para juzgar si la descripción es honesta. |
| 3 | Perfil del especialista: fotos de trabajos, reseñas, botón de contacto | `app/tecnico/[id].tsx` | Le muestra al especialista cómo lo va a ver el cliente. Es el mejor argumento de registro. |
| 4 | Panel del especialista: contactos pendientes del día | `src/components/tecnico/panel/PanelDashboard.tsx` | El gancho: "esto es lo que vas a recibir". |
| 5 | Hoja de costo del contacto ("responder cuesta X SoluCoins") | `src/components/tecnico/HojaCostoLead.tsx` | **La más importante para el revisor.** Prueba que el cobro es transparente y previo, y evita que confundan el modelo con una suscripción oculta. |
| 6 | Billetera: saldo, bono de bienvenida y movimientos | `src/components/tecnico/panel/PanelBilletera.tsx` | Transparencia del prepago; sostiene lo que dice la descripción larga. |
| 7 | Chat cliente ↔ especialista | `src/components/LiveChat.tsx` | Google valora ver la función principal en uso, no solo listas. |
| 8 | Seguimiento del servicio con estados | `app/tracking/[code].tsx` | Cierra el ciclo y justifica el permiso de notificaciones. |

**Cómo tomarlas:** emulador o celular real a 1080×1920, con datos reales de la
cuenta demo (§4) — nunca con "Lorem ipsum" ni perfiles inventados con 5★ que no
existan. Texto sobrepuesto opcional: máximo 5 palabras, arriba, alto contraste.

---

## 3. Formulario "Seguridad de los datos" (Data safety)

Esto es lo que **realmente** recolecta la app, leído del código, no supuesto.
Declarar de más o de menos es causa típica de rechazo o de suspensión posterior.

**Respuestas a las 3 preguntas globales:**

- ¿Los datos se cifran en tránsito? **Sí** (todo va por HTTPS a
  `https://www.solu.pe/api` y a Supabase; no hay ni un endpoint `http://` en el
  código — verificado por grep).
- ¿El usuario puede pedir que se borren sus datos? **Sí**, y hay borrado
  in-app inmediato (`app/eliminar-cuenta.tsx` → `POST /api/tecnico/eliminar-cuenta`
  o `/api/usuario/eliminar-cuenta`) más la URL pública.
- ¿La app sigue las Políticas para Familias? **No aplica** (público 18+).

### Tabla a transcribir en Play Console

Convención de la columna "Compartido": Google entiende "compartido" como
transferido a un tercero. Que un dato se muestre a otro usuario **dentro** de
la app cuenta como compartido.

| Categoría Play | Tipo de dato | ¿Se recolecta? | ¿Se comparte? | ¿Obligatorio? | Propósito a marcar | Dónde ocurre en el código |
|---|---|---|---|---|---|---|
| Info personal | Nombre | Sí | Sí (se le muestra a la otra parte del servicio) | Obligatorio | Funcionalidad de la app | `app/registro.tsx`, `app/registro-cliente.tsx`, `app/solicitar.tsx` |
| Info personal | Número de teléfono (WhatsApp) | Sí | Sí (al especialista/cliente ya emparejado) | Obligatorio | Funcionalidad, Comunicación | mismos archivos |
| Info personal | Dirección de correo | Sí | No | Opcional (solo especialistas) | Funcionalidad, Gestión de la cuenta | `app/registro.tsx` |
| Info personal | Otros identificadores (DNI) | Sí | Sí (a RENIEC, para verificar) | Obligatorio para especialistas | Verificación de identidad, Prevención de fraude | `app/registro.tsx` → `verifyDNI()` |
| Fotos y videos | Fotos (DNI frente y reverso) | Sí | No | Obligatorio para especialistas | Verificación de identidad | `app/subir-dni.tsx`, `app/registro.tsx` |
| Fotos y videos | Fotos (perfil, galería de trabajos) | Sí | Sí (públicas en el perfil) | Opcional | Funcionalidad de la app | `app/(tabs)/cuenta.tsx`, `PanelPerfil.tsx` |
| Fotos y videos | Fotos (del problema y del trabajo terminado) | Sí | Sí (a la otra parte del servicio) | Opcional | Funcionalidad de la app | `app/solicitar.tsx`, `app/cotizar-foto.tsx`, `app/calificar/[code].tsx` |
| Ubicación | Ubicación aproximada | Sí | Sí (el distrito se muestra) | Opcional | Funcionalidad de la app | `src/lib/useLocation.ts` |
| Ubicación | Ubicación precisa | Sí | Sí (posición en vivo durante un servicio activo) | Opcional | Funcionalidad de la app | `src/lib/liveTracking.ts`, `ZonaTrabajoCard.tsx` |
| Mensajes | Otros mensajes en la app | Sí | Sí (a la otra parte del chat) | Opcional | Funcionalidad de la app | `src/components/LiveChat.tsx`, `src/lib/chat-api.ts` |
| Contenido del usuario | Otro contenido (reseñas, calificaciones, descripción del problema) | Sí | Sí (las reseñas son públicas) | Opcional | Funcionalidad de la app | `app/calificar/[code].tsx`, `app/solicitar.tsx` |
| Actividad en la app | Interacciones con la app | Sí | No | Opcional | Analítica | `src/lib/integrations.ts` |
| ID del dispositivo | ID del dispositivo (token push de Expo/FCM) | Sí | Sí (Google FCM lo entrega) | Opcional | Funcionalidad de la app | `src/lib/notifications.ts` |
| Info y rendimiento | Registros de fallos y diagnósticos | Sí | Sí (Sentry) | Opcional | Analítica | `app/_layout.tsx` (Sentry, `enabled: !__DEV__`) |

### Lo que hay que declarar como NO recolectado (y el porqué, por si preguntan)

- **Información financiera / de pago.** La app **no** procesa pagos. El botón
  "Comprar paquete" (`app/comprar-coins.tsx`) abre `https://www.solu.pe/planes`
  en el navegador del sistema y ahí paga con Culqi. La tarjeta nunca toca la app.
- **Contactos, calendario, SMS, llamadas, archivos, salud, ubicación en
  segundo plano.** Nada de eso se pide. La ubicación es **solo en primer plano**
  (`requestForegroundPermissionsAsync`, nunca `requestBackgroundPermissionsAsync`).
- **Audio / grabaciones de voz.** La grabación está desactivada: `expo-av` no
  está instalado y el permiso de micrófono quedó bloqueado en `app.json`
  (ver §5). El botón de micrófono ni se renderiza.

### Permisos que declara el APK y cómo justificarlos

| Permiso | ¿Se usa? | Justificación |
|---|---|---|
| `INTERNET` | Sí | Toda la app. |
| `CAMERA` | Sí | Tomar la foto del problema a cotizar (`app/cotizar-foto.tsx`). |
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | Sí, solo Android ≤12 | Elegir fotos de DNI/perfil/trabajo. En Android 13+ se usa el selector de fotos del sistema, que **no** necesita permiso. |
| `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | Sí | Detectar el distrito y mostrar en el mapa al especialista en camino. Solo primer plano. |
| `POST_NOTIFICATIONS` | Sí | Avisar al especialista que entró un contacto y al cliente el estado de su servicio. |
| `RECORD_AUDIO` | **No** | **Bloqueado** en `app.json` → `android.blockedPermissions`. |

> **Ojo:** la app **no** declara `READ_MEDIA_IMAGES`, así que **no** hay que
> llenar la declaración de "Permisos de fotos y videos" de Play. Si alguna vez
> se agrega, ese formulario pasa a ser obligatorio.

---

## 4. Cuenta de prueba para el revisor (Play Console → "Acceso a la app")

La app **exige iniciar sesión** para ver el lado del especialista, que es
justamente donde vive el modelo de negocio. Sin credenciales el revisor ve
media app y rechaza. Apple ya rechazó una vez por exactamente esto.

### La cuenta existe

Hay un especialista **id 185, "Demo Revisor"** en producción. Está deliberadamente
oculto de la búsqueda pública (`src/lib/demo-tecnicos.ts` en el repo web lo excluye
por id, para que no le robe contactos reales a los especialistas de verdad), pero
**sí** puede iniciar sesión con normalidad.

> Esto sale del código del repo web (`demo-tecnicos.ts` y su test), no de una
> consulta en vivo: la key anon ya no puede leer `tecnicos` (lockdown de RLS) y
> acá no hay service role. **Carlos tiene que confirmar en el panel admin que la
> fila 185 sigue viva, activa y verificada antes de enviar la ficha.**

Carlos tiene que **fijarle una contraseña conocida antes de enviar la ficha** y
pegar exactamente esto en Play Console → Contenido de la app → **Acceso a la app**
→ "Se requieren credenciales":

```
Nombre de usuario: [el email o el WhatsApp de la cuenta 185 — completar]
Contraseña:        [la que Carlos fije — completar]

Instrucciones (pegar en el campo "Instrucciones"):

1. Abre la app y ve a la pestaña "Mi Cuenta" (última del menú inferior).
2. Elige "Soy especialista" e inicia sesión con el usuario y contraseña de arriba.
3. Esta cuenta ya está verificada y tiene saldo de SoluCoins de prueba, así que
   NO necesitas pagar nada ni subir un documento de identidad para revisar la app.
4. En "Contactos" verás pedidos de prueba. Al tocar uno, la app te muestra el
   costo exacto en SoluCoins ANTES de que aceptes: ese es el único cobro del
   modelo. Aceptar descuenta del saldo de prueba, no de dinero real.
5. La compra de paquetes (botón "Comprar paquete") abre www.solu.pe en el
   navegador. No la completes: no es necesaria para revisar la app.
6. Para ver el lado del cliente no hace falta cuenta: la pestaña "Buscar"
   funciona sin iniciar sesión.
```

### Lo que Carlos tiene que hacer para dejarla lista

1. Fijar la contraseña de la cuenta 185. Se puede hacer desde la propia app con
   "¿Olvidaste tu contraseña?" (`app/recuperar.tsx`) si el WhatsApp de esa cuenta
   es alcanzable, o desde el panel admin de la web.
2. Confirmar que la cuenta tiene **saldo de SoluCoins suficiente** (mínimo
   ~5,000) para que el revisor pueda aceptar 2-3 contactos sin quedarse en cero.
3. Dejarle **2 o 3 contactos de prueba pendientes** en su bandeja, para que la
   pantalla no le aparezca vacía. Una bandeja vacía se lee como "app rota".
4. Probar el login **desde el APK/AAB real** (no desde Expo Go) antes de enviar.
5. Verificar que el login no esté bloqueado por rate limit: `/api/login-tech`
   limita intentos por IP y el revisor de Google sale por IPs compartidas.
   Si falla, es un rechazo garantizado.

> El script `scripts/create-culqi-demo-user.ts` del repo web crea/actualiza un
> demo por email (`culqi-review@solu.pe`) y es idempotente, pero **asigna 150
> coins**, número del modelo viejo — con eso el revisor no alcanza a aceptar ni
> un contacto (uno típico cuesta 1,000). Si se usa ese camino, hay que recargarle
> saldo después.

---

## 5. Riesgos de política que hay que decidir ANTES de enviar

### 5.1 Pago fuera de Play (el más serio)

`app/comprar-coins.tsx` abre el navegador hacia `www.solu.pe/planes` para
comprar SoluCoins. La política de Pagos de Google exige Play Billing para
contenido digital consumido dentro de la app, y los SoluCoins **se consumen
dentro de la app** (destrabar un contacto).

- **Argumento a favor de que está exento:** los SoluCoins no son contenido de
  entretenimiento, son acceso a un lead de un trabajo del mundo real, comprado
  por un profesional para su negocio. Es una compra B2B de servicio, no un
  bien digital de consumo.
- **Riesgo real:** que el revisor no compre el argumento. Es la causa de
  rechazo más probable de esta ficha.
- **Palanca ya existente si Google objeta:** el endpoint
  `GET /api/creditos/paquetes` devuelve `compra_habilitada`, y la pantalla ya
  respeta ese kill-switch (si viene `false`, **no** se pinta ningún botón de
  compra). O sea que Carlos puede apagar el botón desde el servidor, sin
  compilar ni subir un build nuevo, y responder la apelación en minutos.
- **Recomendación:** enviar tal cual. Si rechazan, apagar `compra_habilitada`,
  responder la apelación explicando el modelo B2B, y reactivarlo al aprobar.

### 5.2 Contenido generado por usuarios

Hay chat, reseñas y fotos subidas por usuarios. En el cuestionario de
clasificación de contenido hay que marcar **"Los usuarios pueden interactuar"**
y **"Los usuarios pueden compartir su ubicación"**, y debe existir un mecanismo
para reportar y bloquear. El backend ya lo tiene (`docs/REPORTS-AND-BANS.md` en
el repo web); si Google pide evidencia, apuntar ahí.

### 5.3 Funciones de IA generativa

`app/asistente.tsx` y `app/cotizar-foto.tsx` usan IA para recomendar y estimar.
La política de IA generativa exige un canal de reporte de salidas ofensivas.
Hoy ese canal es el soporte por WhatsApp (983835904) dentro de la app; si el
revisor lo cuestiona, hay que agregar un botón "reportar respuesta" en el chat.

### 5.4 Huella SHA-256 de Play App Signing

`https://www.solu.pe/.well-known/assetlinks.json` hoy declara la huella
`60:AF:13:...:50:C1`, que es la del keystore actual de EAS. Cuando Google
active Play App Signing va a **re-firmar el AAB con SU propio certificado**, y
esa huella dejará de coincidir: los deep links de `www.solu.pe` van a dejar de
abrir la app. Después de la primera subida hay que **agregar** (no reemplazar)
la huella que aparece en Play Console → Configuración → Integridad de la app.

---

## 6. Estado técnico verificado el 8-ago-2026

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| Endpoints `http://` en el código | 0 |
| `localhost` / IPs de desarrollo hardcodeadas | 0 |
| `console.log` fuera de `src/lib/logger.ts` | 0 (y el logger solo escribe con `__DEV__`) |
| `www.solu.pe/privacidad` | 200 |
| `www.solu.pe/eliminar-cuenta` | 200 |
| `www.solu.pe/terminos` | 200 |
| `www.solu.pe/api/health` | 200 |
| `solu.pe/privacidad` (sin www) | **301** — por eso nada usa el apex |
| Pantalla de privacidad dentro de la app | Sí, `app/privacidad.tsx`, alcanzable desde Mi Cuenta → Legal |
| Borrado de cuenta dentro de la app | Sí, `app/eliminar-cuenta.tsx` |
| Ícono 512×512 | Sí, `assets/icon.png` |
| Ícono de notificación monocromo | Sí, `assets/android-icon-monochrome.png` (89% transparente, silueta correcta) |

### Cambios de configuración hechos en esta pasada

- `android.versionCode` 36 → **37** y `version` 2.3.0 → **2.3.1**
  (`package.json` decía 2.2.0: quedó alineado). Cambió el manifiesto, así que
  el binario tiene que ser nuevo.
- **`RECORD_AUDIO` eliminado.** El config plugin de `expo-image-picker` lo
  agregaba solo; se le pasó `microphonePermission: false` y además se sumó
  `android.blockedPermissions`. La app no puede grabar audio (`expo-av` está
  desinstalado, ver `src/lib/audioChat.ts`), y un permiso de micrófono sin uso
  es rechazo directo.
- **App Links arreglados.** El filtro `autoVerify` incluía `solu.pe` (apex), que
  responde 301 en `/.well-known/assetlinks.json`. El verificador de Android no
  sigue redirects y, si **un** host del filtro falla, falla el filtro completo:
  los deep links no habrían funcionado ni con `www`. Ahora hay un filtro
  `autoVerify` solo con `www.solu.pe` y otro sin verificar para el apex.
- **`associatedDomains` de iOS corregido.** Mismo problema del apex: el
  `apple-app-site-association` de `solu.pe` da 301 y Apple tampoco sigue
  redirects, así que `applinks:solu.pe` y `webcredentials:solu.pe` nunca
  llegaron a asociarse. Quedó `applinks:www.solu.pe` y se agregó
  `webcredentials:www.solu.pe`, que faltaba (el autofill de contraseñas
  apuntaba solo al apex roto).
- **Ubicación "Always" de iOS eliminada.** La app nunca pide ubicación en
  segundo plano; declararla es una pregunta gratis del revisor. Se pasó `false`
  explícito al plugin (omitir la clave hace que Expo inyecte el texto default
  en inglés en vez de borrarla).
- **Ícono de notificación.** `expo-notifications` solo tenía `color`; sin
  `icon`, Android pinta un cuadrado blanco. Ahora usa el monocromo.
- **`autoIncrement` sacado de `eas.json`.** Con `app.config.js` (config
  dinámica) + `appVersionSource: "local"`, EAS CLI no puede reescribir la
  versión y el build falla o la ignora. El versionado se hace a mano en
  `app.json`, que es lo que ya venía pasando en los commits de release.
- **Perfil de submit `closed-testing`** (`track: "alpha"` = prueba cerrada).
  El perfil `production` apuntaba a producción, que **no** sirve para cumplir
  los 12 testers / 14 días.
- **`google-service-account.json` agregado a `.gitignore` y `.easignore`.** Es
  una clave privada que autoriza publicar en la ficha de SOLU y no estaba
  cubierta por ningún patrón.

### Pendientes que no son código y necesitan decisión de Carlos

0. **BLOQUEANTE — la política de privacidad promete un borrado que no existe.**
   `www.solu.pe/privacidad` ("Las fotos de DNI se eliminan 30 días después de
   la verificación exitosa") y `app/privacidad.tsx` línea 119 dicen lo mismo, y
   **no hay código que lo haga**: ningún cron de `vercel.json` toca storage, no
   existe ningún `storage.from(...).remove(...)` en el repo web, y
   `src/lib/anonimizar.ts` solo anula la columna `dni_frente_url` al borrar la
   cuenta (el archivo queda en el bucket). Play te toma la política enlazada
   como declaración vinculante y la contrasta con el formulario de Seguridad de
   los datos; una denuncia posterior es motivo de suspensión de la ficha.
   Hay que elegir **antes de enviar**, no después:
   - **(a)** implementar la purga: un cron diario que liste el bucket de DNI y
     borre los objetos de técnicos con `verificado = true` y más de 30 días
     desde la verificación; o
   - **(b)** corregir las dos políticas para que digan lo que hoy es verdad
     (bucket privado, acceso solo del equipo, borrado al eliminar la cuenta).

   La ficha ya **no** repite la frase, así que el envío no la agrega — pero el
   texto sigue publicado en la web y dentro de la app.

1. **Clave de Google Maps expuesta.** `AIzaSyA3WHoPEfjZHdrYpH6auE4aab-7AJFZSFM`
   está en `app.json`, que sí está commiteado (la línea que lo ignoraba está
   comentada), y además viaja dentro del APK: es extraíble siempre. Lo correcto
   no es esconderla sino **restringirla** en Google Cloud Console a la app
   Android (`pe.solu.app` + huella SHA-1 de firma) y a las APIs que realmente
   usa (Maps SDK for Android / iOS). Sin eso, cualquiera puede consumir la
   cuota y generar factura.
2. **`google-service-account.json` no existe** en el repo local. `eas.json` lo
   referencia para `eas submit`. Hay que generarlo en Google Cloud y vincularlo
   en Play Console (paso 6 del §7).
3. **Sin `SENTRY_DSN`.** `app.json` lo tiene vacío y `app.config.js` lo lee de
   `process.env`. Si no se crea el secret de EAS, el primer build de producción
   sale **sin reporte de crashes** — justo en el lanzamiento, que es cuando más
   se necesita.
4. **`ENV.GOOGLE_MAPS_API_KEY` es código muerto:** lee `extra.googleMapsApiKey`,
   que no existe (la clave vive en `ios.config` y `android.config`). Siempre
   devuelve `''`. No rompe nada porque nadie la consume; conviene borrarla en
   una limpieza posterior para que nadie la use creyendo que funciona.
5. **`userInterfaceStyle: "light"` no se aplica en Android.** `expo config`
   avisa: hace falta `expo-system-ui` para forzarlo. Sin eso, en un celular con
   tema oscuro los controles nativos (inputs, diálogos, teclado) salen oscuros
   sobre la UI clara de SOLU. No bloquea la publicación, pero conviene
   revisarlo **antes de tomar las capturas**, o las capturas van a salir con
   ese mestizaje. Instalar `expo-system-ui` toca el lockfile, así que queda a
   decisión de Carlos.
6. **Etiqueta del launcher larga.** `expo.name` es "SOLU — Lo que necesites,
   hoy" (28 chars) y Android la corta en el ícono del escritorio. Es decisión
   de marca, no un bloqueo: si se quiere ver solo "SOLU", hay que cambiar ese
   campo.

---

## 7. Orden de trabajo en Play Console

Ver el paso a paso completo, con tiempos de espera, en el reporte de la tarea.
Resumen del camino crítico: crear la app → completar Contenido de la app
(privacidad, acceso, seguridad de los datos, clasificación) → subir el AAB a
**Prueba cerrada** → sumar 12 testers → esperar **14 días corridos** con los
testers opt-in → recién ahí habilitar "Producción".

El reloj de los 14 días arranca el día que la prueba cerrada tiene sus 12
testers, **no** el día que se sube el AAB. Cada tester que falte reinicia la
cuenta regresiva.
