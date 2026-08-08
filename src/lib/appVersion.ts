import Constants from 'expo-constants'

// Fuente única de la versión de la app. Antes convivían cuatro números a mano
// ("v2.2" en el Home, "v1.0.0" en Mi Cuenta, el fallback de useAppUpdate y el
// de package.json) y derivaban entre sí: cualquier release actualizaba unos y
// olvidaba otros. Ahora todo sale de app.json (expo.version) vía Constants, el
// mismo dato que compara el force-update.
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0'

// Etiqueta lista para mostrar en pie de página ("v2.3.0").
export const APP_VERSION_LABEL = `v${APP_VERSION}`
