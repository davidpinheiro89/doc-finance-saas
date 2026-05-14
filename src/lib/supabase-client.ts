import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase do BEM Plantonista.
 *
 * Conexão única (singleton) usada em todo o app para acessar o banco
 * de dados Postgres + Auth + Storage do Supabase.
 *
 * Variáveis de ambiente necessárias (definidas em .env.local):
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    'Variável de ambiente NEXT_PUBLIC_SUPABASE_URL não definida. ' +
      'Configure-a em .env.local antes de iniciar a aplicação.'
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    'Variável de ambiente NEXT_PUBLIC_SUPABASE_ANON_KEY não definida. ' +
      'Configure-a em .env.local antes de iniciar a aplicação.'
  )
}

// Reutiliza a instância entre hot-reloads do Next.js em desenvolvimento.
declare global {
  // eslint-disable-next-line no-var
  var __bemPlantonistaSupabase: SupabaseClient | undefined
}

export const supabaseClient: SupabaseClient =
  globalThis.__bemPlantonistaSupabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'bem-plantonista-auth',
    },
    global: {
      headers: {
        'x-application-name': 'bem-plantonista',
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__bemPlantonistaSupabase = supabaseClient
}

export default supabaseClient
