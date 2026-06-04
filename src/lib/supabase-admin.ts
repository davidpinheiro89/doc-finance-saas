import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com Service Role Key — apenas para uso em API routes
 * server-side. Nunca expor este client ao browser.
 * Inicializado sob demanda para evitar crash no build.
 */
let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _admin
}
