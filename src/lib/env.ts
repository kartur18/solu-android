import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra || {}

export const ENV = {
  SUPABASE_URL: extra.supabaseUrl || 'https://umcisdghupovaaksbmix.supabase.co',
  SUPABASE_ANON_KEY: extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2lzZGdodXBvdmFha3NibWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzOTU2MTYsImV4cCI6MjA2Mzk3MTYxNn0.7MBf6c4BfnqGBTqwFTHKFvh4rlvjSdFCBarm_N0H_I0',
  API_BASE_URL: extra.apiBaseUrl || 'https://solu.pe/api',
  CLOUDINARY_CLOUD_NAME: extra.cloudinaryCloudName || 'dcwwvvb1e',
  YAPE_NUMBER: extra.yapeNumber || '904518343',
  EXPO_PROJECT_ID: extra.eas?.projectId || 'e5c70e83-de40-40e4-8e2f-fb8d79c5d62b',
}
