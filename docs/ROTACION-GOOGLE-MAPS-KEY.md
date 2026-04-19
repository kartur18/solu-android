# Rotación de la Google Maps API Key

La key previa quedó expuesta en el repo (commits históricos) y debe rotarse antes del próximo build de producción. Este documento describe los 3 pasos que debe ejecutar el owner.

---

## Paso 1 — Crear el secret `GOOGLE_MAPS_API_KEY` en EAS

La app ahora lee la key desde `process.env.GOOGLE_MAPS_API_KEY` en [app.config.ts](../app.config.ts). Para que EAS Build la inyecte, hay que registrar el secret:

```bash
eas secret:create \
  --scope project \
  --name GOOGLE_MAPS_API_KEY \
  --value "<NUEVA_KEY_AQUI>" \
  --type string
```

Verificación:

```bash
eas secret:list
# Debe aparecer GOOGLE_MAPS_API_KEY
```

Para desarrollo local (`expo start`) hay que crear un archivo `.env` en la raíz del proyecto (ya está en `.gitignore`):

```
GOOGLE_MAPS_API_KEY=<NUEVA_KEY_AQUI>
```

---

## Paso 2 — Rotar la key en Google Cloud Console

La key vieja (`AIzaSyA3WHoPEfjZHdrYpH6auE4aab-7AJFZSFM`) ya no debe aceptar tráfico.

1. Abrir https://console.cloud.google.com/apis/credentials del proyecto correspondiente.
2. **Crear una key nueva** (botón "+ CREATE CREDENTIALS" → "API key").
3. Copiar el valor generado — este es el que va al EAS Secret (Paso 1).
4. **Revocar / borrar la key vieja** (`AIzaSyA3WHoPEfjZHdrYpH6auE4aab-7AJFZSFM`).
   - Importante: hacer esto **después** de verificar con un build de prueba que la key nueva funciona, para no romper usuarios actuales que ya tienen la app instalada.
   - Si el build de prueba usa la key nueva correctamente, proceder con el borrado.

---

## Paso 3 — Restringir la key nueva por aplicación

Una vez creada la key nueva, restringirla para que solo funcione desde esta app (así aunque se filtre en un futuro, nadie más puede consumir el quota):

1. En la página de Credentials, abrir la key nueva.
2. **Application restrictions:**
   - Agregar restricción **Android apps**:
     - Package name: `pe.solu.app`
     - SHA-1 certificate fingerprint: obtener con
       ```bash
       eas credentials
       ```
       (o desde Google Play Console → Setup → App integrity → App signing key certificate → SHA-1).
   - Agregar restricción **iOS apps**:
     - Bundle ID: `pe.solu.app`
3. **API restrictions:**
   - Seleccionar "Restrict key"
   - Habilitar solo las APIs que usa la app:
     - Maps SDK for Android
     - Maps SDK for iOS
     - (Geocoding API solo si la usás — actualmente se usa `expo-location` que no requiere la key de Google)
4. Guardar.

---

## Verificación final

Antes de considerar completada la rotación:

- [ ] `eas secret:list` muestra `GOOGLE_MAPS_API_KEY`
- [ ] Build de prueba (`eas build --profile preview --platform android`) muestra el mapa correctamente
- [ ] La key vieja está revocada en Google Cloud Console
- [ ] La key nueva tiene restricciones Android + iOS + API
- [ ] `.env.example` en el repo sigue vacío (nunca commitear valores reales)
