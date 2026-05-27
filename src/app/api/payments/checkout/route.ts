import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/checkout
 *
 * Body esperado:
 *   { cpfCnpj: string, plan?: 'monthly' | 'annual' }
 *
 * Fluxo:
 *   1. Autentica via Supabase JWT (cookie de sessão)
 *   2. Cria (ou reutiliza) cliente no Asaas
 *   3. Cria assinatura recorrente (mensal R$29,90 ou anual R$299,00)
 *   4. Salva asaas_customer_id + subscription_status='pending' no user_metadata
 *   5. Retorna invoiceUrl do Asaas para o médico inserir dados do cartão
 */
async function safeJson(res: Response, label: string) {
  const text = await res.text()
  if (!text) {
    console.error(`${label}: empty response (status ${res.status})`)
    return { _empty: true }
  }
  try {
    return JSON.parse(text)
  } catch {
    console.error(`${label}: invalid JSON (status ${res.status}):`, text.slice(0, 500))
    return { _parseError: true, _raw: text.slice(0, 500) }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? ''

    console.log('[checkout] ASAAS_BASE_URL:', ASAAS_BASE_URL)
    console.log('[checkout] ASAAS_API_KEY exists:', !!ASAAS_API_KEY, 'length:', ASAAS_API_KEY.length)

    // ── 1. Autenticação via Bearer token ──
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { cpfCnpj, plan = 'monthly' } = await request.json()

    const isAnnual = plan === 'annual'

    if (!cpfCnpj || typeof cpfCnpj !== 'string' || cpfCnpj.replace(/\D/g, '').length < 11) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '')
    const fullName = user.user_metadata?.full_name || 'Médico BEM Plantonista'

    // ── 2. Criar (ou buscar) cliente no Asaas ──
    let customerId = user.user_metadata?.asaas_customer_id as string | undefined

    if (!customerId) {
      console.log('[checkout] Creating Asaas customer for:', user.email)
      const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: ASAAS_API_KEY,
        },
        body: JSON.stringify({
          name: fullName,
          email: user.email,
          cpfCnpj: cleanCpfCnpj,
          externalReference: user.id,
        }),
      })

      const customerData = await safeJson(customerRes, 'Asaas customer')

      if (customerData._empty || customerData._parseError) {
        return NextResponse.json(
          { error: 'Gateway de pagamento sem resposta válida' },
          { status: 502 }
        )
      }

      if (!customerRes.ok) {
        console.error('Asaas customer error:', customerData)
        return NextResponse.json(
          { error: 'Erro ao criar cliente no gateway de pagamento', details: customerData },
          { status: 502 }
        )
      }

      customerId = customerData.id
      console.log('[checkout] Asaas customer created:', customerId)
    }

    // ── 3. Criar assinatura recorrente ──
    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 1) // cobrar a partir de amanhã
    const dueDateStr = nextDueDate.toISOString().split('T')[0]

    console.log('[checkout] Creating subscription:', { plan, customerId, dueDateStr })
    const subscriptionRes = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: isAnnual ? 299.00 : 29.90,
        nextDueDate: dueDateStr,
        cycle: isAnnual ? 'YEARLY' : 'MONTHLY',
        description: isAnnual
          ? 'BEM Plantonista — Assinatura Anual'
          : 'BEM Plantonista — Assinatura Mensal',
        externalReference: user.id,
      }),
    })

    const subscriptionData = await safeJson(subscriptionRes, 'Asaas subscription')

    if (subscriptionData._empty || subscriptionData._parseError) {
      return NextResponse.json(
        { error: 'Gateway de pagamento sem resposta válida ao criar assinatura' },
        { status: 502 }
      )
    }

    if (!subscriptionRes.ok) {
      console.error('Asaas subscription error:', subscriptionData)
      return NextResponse.json(
        { error: 'Erro ao criar assinatura', details: subscriptionData },
        { status: 502 }
      )
    }

    console.log('[checkout] Subscription created:', subscriptionData.id)

    // ── 4. Salvar dados no user_metadata do Supabase ──
    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionData.id,
        subscription_status: 'pending',
        subscription_plan: isAnnual ? 'anual' : 'mensal',
      },
    })

    if (updateError) {
      console.error('Supabase update error:', updateError)
    }

    // ── 5. Buscar link de checkout (primeira cobrança) ──
    // A primeira cobrança é criada automaticamente pelo Asaas ao criar a subscription.
    // Buscamos ela para obter o invoiceUrl.
    const paymentsRes = await fetch(
      `${ASAAS_BASE_URL}/subscriptions/${subscriptionData.id}/payments`,
      {
        headers: { access_token: ASAAS_API_KEY },
      }
    )

    const paymentsData = await safeJson(paymentsRes, 'Asaas payments')
    const firstPayment = paymentsData?.data?.[0]
    const invoiceUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl || null

    console.log('[checkout] invoiceUrl:', invoiceUrl ? 'found' : 'NOT found')

    return NextResponse.json({
      success: true,
      subscriptionId: subscriptionData.id,
      customerId,
      invoiceUrl,
    })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
