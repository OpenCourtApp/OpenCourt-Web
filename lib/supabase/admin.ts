import { createClient } from '@supabase/supabase-js'

// Service-role client. Bypasses RLS — only ever import from 'use server' files.
// Factory (not a singleton) so a missing key fails at call time with a
// friendly error instead of crashing the module graph at import.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export function hasAdminKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
