import type { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || ''

  return {
    ...config,
    name: config.name ?? 'SOLU',
    slug: config.slug ?? 'solu-app',
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
    plugins: [
      ...(config.plugins ?? []).filter(
        (p) => !(Array.isArray(p) && p[0] === 'react-native-maps'),
      ),
      ['react-native-maps', { googleMapsApiKey }],
    ],
    extra: {
      ...config.extra,
      googleMapsApiKey,
    },
  }
}
