import { createClient } from '@supabase/supabase-js'

// Try to get from Vite environment variables first, then fallback to window globals if set
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || window.SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
