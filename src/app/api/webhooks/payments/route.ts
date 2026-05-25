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
 *   PAYMENT_CONFIRMED, PAYMENT_RECEIVED → active
 *   PAYMENT_OVERDUE → overdue
 *   SUBSCRIPTION_DELETED → cancelled
 */
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
        // Evento não tratado — aceitar sem ação
        return NextResponse.json({ ok: true, ignored: true })
    }

    // ── 5. Atualizar user_metadata no Supabase ──
    const supabaseAdmin = getSupabaseAdmin()

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(externalReference)

    if (getUserError || !user) {
      console.error('Webhook: user not found', externalReference, getUserError)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(externalReference, {
      user_metadata: {
        ...user.user_metadata,
        subscription_status: newStatus,
      },
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
