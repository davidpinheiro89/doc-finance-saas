import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com Service Role Key — apenas para uso em API routes
 * server-side. Nunca expor este client ao browser.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
