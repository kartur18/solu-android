# TODO migración a V3.1 (SoluCoins)

Estado al **2026-05-24** — bump a versión 2.0.0.

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

## 🟡 Pendiente — refactor profundo de pantallas

### 1. `app/(tabs)/cuenta.tsx` (~1700 líneas)

Tiene lógica masiva basada en `t.plan === 'profesional'|'premium'|'elite'`:
- Selector de plan en wizard registro (líneas ~259-280)
- Cupos de promoción según plan (líneas 315-318)
- Banner "Plan vence en X días" — N/A en V3.1 (Coins no vencen)
- Tabs de "Plan vigente" — debe pasar a "Mi billetera de SoluCoins"
- Lógica de `tech.fecha_vencimiento` — N/A en V3.1

**Migración:**
- Reemplazar `tech.plan` por `tech.tier`/`tech.coins_balance`
- Mostrar saldo de SoluCoins en el header (igual que en `/mi-cuenta` web)
- Pantalla "Comprar paquete" debe abrir webview a `solu.pe/planes` o
  implementar Culqi mobile SDK (más complejo)
- Eliminar todos los condicionales por plan

### 2. `app/registro.tsx`

Tiene selector de plan (líneas 36, 47-48, 259-280):
- `selectedPlan: 'profesional' | 'premium' | 'elite'`
- Lógica de `maxOficios` / `maxDistritos` según plan

**Migración:**
- Quitar selector de plan (en V3.1 todos los técnicos arrancan igual con 5,000 SoluCoins de bienvenida)
- Permitir cualquier cantidad de oficios/zonas (sin gate por plan)
- Después del registro, redirigir a pantalla de wallet (no a "elegir plan")

### 3. Listings de servicios (`app/(tabs)/index.tsx` u otro)

- Web tiene **10 categorías** principales (verificadas en smoke test mobile)
- App listing dice "18 categorías" (legacy de cuando había más oficios)
- Sincronizar con `src/lib/constants.ts` SERVICIOS de la web

## 🟢 Plan de release

1. **v2.0.0 (hoy)**: cambios mínimos para que la app no muestre planes
   mensuales falsos. Las pantallas core siguen funcionando aunque
   muestran "Legacy (modelo viejo)" en lugar de Starter/PRO/Elite.
   **NO PUBLICAR todavía en Play Store** — solo es preparación.
2. **v2.1.0 (próxima iteración, ~2 sem)**: refactor profundo de
   `cuenta.tsx` + `registro.tsx`. Una vez completo, build con
   `eas build --platform all --profile production` y submit a stores.
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
