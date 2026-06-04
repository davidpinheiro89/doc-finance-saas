import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/payments
 *
 * Webhook do Asaas para atualizar subscription_status no Supabase.
 *
 * Headers esperados:
 *   asaas-signature: HMAC-SHA256 do body com ASAAS_WEBHOOK_SECRET
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED, PAYMENT_RECEIVED → active + subscription_end_date
 *   PAYMENT_OVERDUE → overdue
 *   SUBSCRIPTION_DELETED → cancelled
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

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.ASAAS_WEBHOOK_SECRET ?? ''

    // ── 1. Ler body como texto para validar assinatura ──
    const rawBody = await request.text()

    // ── 2. Validar HMAC-SHA256 ──
    const signature = request.headers.get('asaas-signature') ?? ''

    if (!secret || !signature) {
      return NextResponse.json({ error: 'Assinatura ausente' }, { status: 401 })
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    // ── 3. Parsear payload ──
    const payload = JSON.parse(rawBody)
    const event: string = payload.event
    const payment = payload.payment ?? payload.subscription ?? {}
    const externalReference: string | undefined =
      payment.externalReference ?? payload.externalReference

    if (!externalReference) {
      return NextResponse.json({ error: 'externalReference ausente' }, { status: 400 })
    }

    // ── 4. Determinar novo status ──
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
        return NextResponse.json({ ok: true, ignored: true })
    }

    // ── 5. Buscar usuário ──
    const supabaseAdmin = getSupabaseAdmin()

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(externalReference)

    if (getUserError || !user) {
      console.error('Webhook: user not found', externalReference, getUserError)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // ── 6. Montar metadata atualizado ──
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

    // ── 7. Atualizar Supabase ──
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(externalReference, {
      user_metadata: updatedMetadata,
    })

    if (updateError) {
      console.error('Webhook: update error', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}