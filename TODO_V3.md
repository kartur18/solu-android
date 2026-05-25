# TODO migración a V3.1 (SoluCoins)

Estado al **2026-05-24** — bump a versión **2.1.0**.

La app móvil pasó de modelo legacy (planes mensuales
profesional/premium/elite + escrow) al modelo V3.1 (SoluCoins prepagos +
pago cliente↔técnico directo) en esta sesión, pero el refactor fue
**quirúrgico**, no completo. Lo que sigue es el trabajo pendiente para
que la app móvil esté 100% alineada con la web.

## ✅ Hecho en v2.0.0

- `src/lib/constants.ts`
  - Tier loyalty `Diamante` → **`Platino`**
  - Nuevo catálogo `COINS_PACKAGES` (6 tiers, espejo de la web)
  - Achievements actualizados (sacar dependencia de `t.plan`)
  - `PLAN_FEATURES` queda como stub deprecado (devuelve "Legacy (modelo viejo)")
- `src/lib/types.ts`
  - `Tecnico.plan` ahora es opcional + acepta `'creditos' | null`
  - Nuevos campos: `coins_balance`, `tier`
- `src/lib/matching.ts`
  - `PLAN_BOOST` reemplazado por **`TIER_BOOST`** (boost por tier real, no plan pagado)
  - `SELECT_COLS` ahora consulta `tier` en vez de `plan`
- `app/pago/[solicitudId].tsx`
  - Eliminado todo el flujo escrow (Culqi/expo-web-browser)
  - Nueva UI: "Coordina el pago con tu técnico" (Yape/Plin/efectivo/tarjeta)
  - Botón abre `/tracking/[solicitudId]` para contacto WhatsApp
- `GOOGLE_PLAY_LISTING.md`
  - Tier Diamante → Platino
  - Sección "Eres técnico" reescrita con paquetes SoluCoins
- Bump version **1.0.2 → 2.0.0** (build/versionCode **2 → 3**)

## ✅ Hecho en v2.1.0 (refactor profundo completado)

### 1. `app/registro.tsx` ✅ reescrito
- Eliminado selector de plan (profesional/premium/elite)
- Banner de bienvenida con "5,000 SoluCoins gratis"
- Topes generosos sin gates por plan (5 oficios, 10 zonas en registro)
- Submit ya no envía `plan` al backend
- Mensaje final: "¡Bienvenido a SOLU! Recibes 5,000 SoluCoins gratis"

### 2. `app/(tabs)/cuenta.tsx` ✅ refactoreado
- Header: badge "Plan X" → "Tier {Bronce/Plata/Oro/Platino}"
- StatCard "días restantes" → "SoluCoins"
- Banner "Plan vencido" → Banner "Saldo bajo de SoluCoins" (<500)
- Tab "Plan" reescrito como tab **Wallet**:
  * Hero con saldo grande de SoluCoins + tier badge
  * Botón "Comprar SoluCoins" → router.push('/comprar-coins')
  * Card "¿Cómo funcionan los SoluCoins?" (4 puntos didácticos)
- Eliminada función `handleSubscribe` (Flow-subscribe deprecado)
- `getMaxPhotos()` ahora devuelve 20 para todos (sin gate por plan)
- Stats avanzadas, tendencia mensual y servicios más solicitados
  disponibles para todos los técnicos verificados (sin gate por plan)
- daysLeft/isExpired quedaron como literales = 0/false para no romper refs

### 3. `app/comprar-coins.tsx` ✅ nuevo
- Catálogo de 6 paquetes (espejo de COINS_PACKAGES)
- Badge "MÁS ELEGIDO" en el destacado
- Botón "Comprar paquete" abre `https://solu.pe/planes?paquete=SLUG`
  con expo-web-browser (web maneja Culqi PCI-DSS + 3DS, no reimplementamos)
- Card educativa: "El pago se procesa de forma segura en solu.pe..."

## 🟢 Pendientes menores

### Listings de servicios
- Web tiene **10 categorías** principales (verificadas en smoke test mobile)
- App listing menciona "18 categorías" (mantenido por ahora, mencionan oficios específicos no categorías)
- Sincronizar opcional, no bloquea release

### Smoke test en dispositivo real
- Antes de submit a stores: instalar el APK/IPA en un dispositivo físico
  y verificar:
  * Registro nuevo → recibe 5000 coins
  * Login → header muestra saldo correcto
  * Tab Wallet → cards de paquetes se ven bien
  * "Comprar paquete" abre el browser correctamente
  * Volver del browser → saldo se actualiza (verificar refetch)

## 🟢 Plan de release

1. ✅ **v2.0.0** (2026-05-24): cambios mecánicos (Diamante→Platino,
   COINS_PACKAGES, types.ts, matching.ts, pago/[solicitudId].tsx).
2. ✅ **v2.1.0** (2026-05-24): refactor profundo de `cuenta.tsx` +
   `registro.tsx` + nueva pantalla `/comprar-coins`. **Lista para
   submit a stores tras smoke test en dispositivo real.**
3. **v2.2.0 (post-launch)**: feedback de los primeros técnicos reales
   que usen la app + bugfixes.

## Comandos útiles

```bash
# Verificar typecheck
cd solu-android && npx tsc --noEmit

# Dev local en Android
cd solu-android && npm run android

# Build production (requiere EAS account)
cd solu-android && eas build --platform all --profile production

# Submit a Play Store + App Store
cd solu-android && eas submit --platform all
```
