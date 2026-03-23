import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://umcisdghupovaaksbmix.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2lzZGdodXBvdmFha3NibWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDc4NjksImV4cCI6MjA4OTY4Mzg2OX0.rMG0nimeeT15W22l9KltaFoj41qDxZS6BmnNwQVjz7o'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
