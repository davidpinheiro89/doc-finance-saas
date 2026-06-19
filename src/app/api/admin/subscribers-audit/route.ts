import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

/**
 * GET /api/admin/subscribers-audit
 *
 * Lista todos os usuários com indicação de assinatura paga no Supabase.
 * Apenas leitura — não altera nenhum dado.
 * Protegido por Bearer token + validação de admin email.
 */
export async function GET(request: NextRequest) {
  // ── Auth ──
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  )
  const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !caller || caller.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // ── Buscar todos os usuários via Admin API ──
  const supabaseAdmin = getSupabaseAdmin()

  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  })

  if (listError || !users) {
    return NextResponse.json({ error: 'Erro ao listar usuários', details: listError?.message }, { status: 500 })
  }

  // ── Filtrar usuários com indicação de assinatura ──
  const subscribers = users
    .filter((u) => {
      const meta = u.user_metadata ?? {}
      return (
        (meta.subscription_status && meta.subscription_status !== 'free') ||
        meta.subscription_end_date ||
        meta.subscription_plan ||
        meta.asaas_customer_id ||
        meta.asaas_subscription_id
      )
    })
    .map((u) => {
      const meta = u.user_metadata ?? {}
      return {
        user_id: u.id,
        email: u.email,
        full_name: meta.full_name ?? meta.name ?? null,
        subscription_status: meta.subscription_status ?? null,
        subscription_end_date: meta.subscription_end_date ?? null,
        subscription_plan: meta.subscription_plan ?? null,
        asaas_customer_id: meta.asaas_customer_id ?? null,
        asaas_subscription_id: meta.asaas_subscription_id ?? null,
        created_at: u.created_at,
        updated_at: u.updated_at,
        last_sign_in_at: u.last_sign_in_at,
        // Incluir todo o user_metadata para inspeção completa
        raw_metadata: meta,
      }
    })

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      subscribersFound: subscribers.length,
    },
    subscribers,
  })
}
