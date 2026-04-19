import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra || {}

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(
      `Missing required config '${name}'. Set it in app.config.ts via process.env or in app.json 'extra'.`,
    )
  }
  return value
}

export const ENV = {
  SUPABASE_URL: required('supabaseUrl', extra.supabaseUrl),
  SUPABASE_ANON_KEY: required('supabaseAnonKey', extra.supabaseAnonKey),
  API_BASE_URL: extra.apiBaseUrl || 'https://solu.pe/api',
  CLOUDINARY_CLOUD_NAME: extra.cloudinaryCloudName || 'dcwwvvb1e',
  YAPE_NUMBER: extra.yapeNumber || '983835904',
  EXPO_PROJECT_ID: extra.eas?.projectId || 'e5c70e83-de40-40e4-8e2f-fb8d79c5d62b',
  SENTRY_DSN: extra.sentryDsn || '',
  GOOGLE_MAPS_API_KEY: extra.googleMapsApiKey || '',
}

/** Fetch con timeout automático (default 10s) */
export async function fetchWithTimeout(url: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options || {}
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}
