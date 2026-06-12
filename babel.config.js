module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin DEBE ser el último plugin. Lo requiere
    // react-native-reanimated 4.x para compilar las worklets de animación.
    // Sin esto la app crashea al ejecutar cualquier animación de reanimated.
    plugins: ['react-native-worklets/plugin'],
  }
}
