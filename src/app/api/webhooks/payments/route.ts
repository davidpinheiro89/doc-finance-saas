import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/payments
 *
 * Webhook do Asaas para atualizar subscription_status no Supabase.
 *
 * Autenticação:
 *   O Asaas envia o token fixo (configurado no painel) no header "asaas-access-token".
 *   Comparamos com a env ASAAS_WEBHOOK_SECRET usando timingSafeEqual.
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED, PAYMENT_RECEIVED → active + subscription_end_date
 *   PAYMENT_OVERDUE → overdue
 *   SUBSCRIPTION_DELETED → cancelled
 *
 * Eventos não tratados retornam 200 para evitar retries desnecessários.
 */

function calcEndDate(plan: string): string {
  const date = new Date()
  if (plan === 'anual') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setDate(date.getDate() + 30)
  }
  return date.toISOString()
}

/** Comparação segura contra timing attack */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.ASAAS_WEBHOOK_SECRET ?? ''

    // ── 1. Validar token de autenticação do Asaas ──
    const accessToken = request.headers.get('asaas-access-token') ?? ''

    if (!secret || !accessToken) {
      console.error('Webhook auth: token ou secret ausente', { hasSecret: !!secret, hasToken: !!accessToken })
      return NextResponse.json({ error: 'Token de autenticação ausente' }, { status: 401 })
    }

    if (!safeCompare(accessToken, secret)) {
      console.error('Webhook auth: token inválido')
      return NextResponse.json({ error: 'Token de autenticação inválido' }, { status: 401 })
    }

    // ── 2. Parsear payload ──
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody)
    const event: string = payload.event ?? ''
    const payment = payload.payment ?? payload.subscription ?? {}
    const externalReference: string | undefined =
      payment.externalReference ?? payload.externalReference

    if (!externalReference) {
      // Log para diagnóstico mas retorna 200 para não gerar retries no Asaas
      console.error('Webhook: externalReference ausente', { event, payloadKeys: Object.keys(payload) })
      return NextResponse.json({ ok: true, warning: 'externalReference ausente — evento ignorado' })
    }

    // ── 3. Determinar novo status ──
    let newStatus: string | null = null

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        newStatus = 'active'
        break
      case 'PAYMENT_OVERDUE':
        newStatus = 'overdue'
        break
      case 'SUBSCRIPTION_DELETED':
        newStatus = 'cancelled'
        break
      default:
        // Evento não mapeado — retorna 200 para evitar retries
        return NextResponse.json({ ok: true, ignored: true, event })
    }

    // ── 4. Buscar usuário ──
    const supabaseAdmin = getSupabaseAdmin()

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(externalReference)

    if (getUserError || !user) {
      console.error('Webhook: user not found', { externalReference, error: getUserError?.message })
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // ── 5. Montar metadata atualizado ──
    const currentPlan: string = user.user_metadata?.subscription_plan ?? 'mensal'

    const updatedMetadata: Record<string, unknown> = {
      ...user.user_metadata,
      subscription_status: newStatus,
    }

    // Gravar subscription_end_date apenas em pagamento confirmado
    if (newStatus === 'active') {
      updatedMetadata.subscription_end_date = calcEndDate(currentPlan)
      console.log(`Webhook: end_date set to ${updatedMetadata.subscription_end_date} (plan: ${currentPlan})`)
    }

    // Limpar end_date se cancelado
    if (newStatus === 'cancelled') {
      updatedMetadata.subscription_end_date = null
    }

    // ── 6. Atualizar Supabase ──
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(externalReference, {
      user_metadata: updatedMetadata,
    })

    if (updateError) {
      console.error('Webhook: update error', { externalReference, error: updateError.message })
      return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
    }

    console.log(`Webhook: OK — user=${user.email} event=${event} status=${newStatus}`)
    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}