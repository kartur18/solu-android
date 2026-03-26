import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra || {}

export const ENV = {
  SUPABASE_URL: extra.supabaseUrl || 'https://umcisdghupovaaksbmix.supabase.co',
  SUPABASE_ANON_KEY: extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2lzZGdodXBvdmFha3NibWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDc4NjksImV4cCI6MjA4OTY4Mzg2OX0.rMG0nimeeT15W22l9KltaFoj41qDxZS6BmnNwQVjz7o',
  API_BASE_URL: extra.apiBaseUrl || 'https://solu.pe/api',
  CLOUDINARY_CLOUD_NAME: extra.cloudinaryCloudName || 'dcwwvvb1e',
  YAPE_NUMBER: extra.yapeNumber || '904518343',
  EXPO_PROJECT_ID: extra.eas?.projectId || 'e5c70e83-de40-40e4-8e2f-fb8d79c5d62b',
  SENTRY_DSN: extra.sentryDsn || '',
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
