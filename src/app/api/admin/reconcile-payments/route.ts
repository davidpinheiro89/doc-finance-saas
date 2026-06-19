import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

/**
 * GET /api/admin/reconcile-payments?days=30
 *
 * Relatório de divergências entre pagamentos confirmados no Asaas
 * e subscription_end_date no Supabase.
 *
 * Protegido por Bearer token + validação de admin email.
 * Não altera nenhum dado — apenas lista divergências.
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

  // Log temporário de diagnóstico — remover após confirmar funcionamento
  console.log('[reconcile] auth check:', {
    callerEmail: caller?.email ?? 'NULL',
    adminEmail: ADMIN_EMAIL,
    match: caller?.email === ADMIN_EMAIL,
    authError: authError?.message ?? null,
  })

  if (authError || !caller || caller.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // ── Parâmetros ──
  const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY_V2 ?? process.env.ASAAS_API_KEY ?? ''

  if (!ASAAS_API_KEY) {
    return NextResponse.json({
      error: 'ASAAS_API_KEY não configurada',
      debug: {
        ASAAS_API_KEY_V2_present: !!process.env.ASAAS_API_KEY_V2,
        ASAAS_API_KEY_present: !!process.env.ASAAS_API_KEY,
        allAsaasEnvs: Object.keys(process.env).filter(k => k.includes('ASAAS')),
      },
    }, { status: 500 })
  }

  const days = parseInt(request.nextUrl.searchParams.get('days') ?? '30', 10)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0] // YYYY-MM-DD

  // ── Buscar pagamentos confirmados no Asaas ──
  const confirmedPayments: any[] = []
  let offset = 0
  const limit = 100

  for (let page = 0; page < 10; page++) { // máximo 1000 pagamentos
    const url = new URL(`${ASAAS_BASE_URL}/payments`)
    url.searchParams.set('status', 'CONFIRMED')
    url.searchParams.set('dateCreated[ge]', sinceStr)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url.toString(), {
      headers: { access_token: ASAAS_API_KEY },
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Erro ao consultar Asaas', status: res.status, details: errText }, { status: 502 })
    }

    const data = await res.json()
    const payments = data.data ?? []
    confirmedPayments.push(...payments)

    if (!data.hasMore) break
    offset += limit
  }

  // Também buscar RECEIVED
  offset = 0
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${ASAAS_BASE_URL}/payments`)
    url.searchParams.set('status', 'RECEIVED')
    url.searchParams.set('dateCreated[ge]', sinceStr)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url.toString(), {
      headers: { access_token: ASAAS_API_KEY },
    })

    if (!res.ok) break

    const data = await res.json()
    const payments = data.data ?? []
    confirmedPayments.push(...payments)

    if (!data.hasMore) break
    offset += limit
  }

  // ── Comparar com Supabase ──
  const supabaseAdmin = getSupabaseAdmin()
  const divergences: any[] = []
  const processed = new Set<string>()

  for (const payment of confirmedPayments) {
    const externalRef: string | undefined = payment.externalReference
    if (!externalRef || processed.has(externalRef)) continue
    processed.add(externalRef)

    // Buscar user no Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(externalRef)

    if (error || !user) {
      divergences.push({
        type: 'USER_NOT_FOUND',
        externalReference: externalRef,
        asaasCustomer: payment.customer,
        asaasPaymentId: payment.id,
        asaasPaymentDate: payment.paymentDate ?? payment.confirmedDate ?? payment.dateCreated,
        asaasValue: payment.value,
      })
      continue
    }

    const meta = user.user_metadata ?? {}
    const currentStatus = meta.subscription_status
    const currentEndDate = meta.subscription_end_date

    // Verificar se o status está desatualizado
    const isActive = currentStatus === 'active'
    const paymentDate = new Date(payment.paymentDate ?? payment.confirmedDate ?? payment.dateCreated)

    // Calcular end_date esperado (30 dias após pagamento para mensal, 365 para anual)
    const plan = meta.subscription_plan ?? 'mensal'
    const expectedEnd = new Date(paymentDate)
    if (plan === 'anual') {
      expectedEnd.setFullYear(expectedEnd.getFullYear() + 1)
    } else {
      expectedEnd.setDate(expectedEnd.getDate() + 30)
    }

    // Considerar divergente se:
    // 1. Status não é 'active'
    // 2. end_date ausente
    // 3. end_date é anterior ao esperado pelo pagamento mais recente
    const currentEndMs = currentEndDate ? new Date(currentEndDate).getTime() : 0
    const expectedEndMs = expectedEnd.getTime()

    const isDivergent =
      !isActive ||
      !currentEndDate ||
      currentEndMs < expectedEndMs - (24 * 60 * 60 * 1000) // tolerância de 1 dia

    if (isDivergent) {
      divergences.push({
        type: 'SUBSCRIPTION_DESYNC',
        userId: user.id,
        email: user.email,
        name: meta.full_name ?? meta.name ?? '—',
        plan,
        currentStatus,
        currentEndDate: currentEndDate ?? null,
        expectedEndDate: expectedEnd.toISOString(),
        asaasPaymentId: payment.id,
        asaasPaymentDate: payment.paymentDate ?? payment.confirmedDate,
        asaasValue: payment.value,
        asaasCustomer: payment.customer,
      })
    }
  }

  return NextResponse.json({
    summary: {
      totalPaymentsChecked: confirmedPayments.length,
      uniqueUsersChecked: processed.size,
      divergencesFound: divergences.length,
      periodDays: days,
      since: sinceStr,
    },
    divergences,
  })
}
