import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/checkout
 *
 * Body esperado:
 *   { cpfCnpj: string }
 *
 * Fluxo:
 *   1. Autentica via Supabase JWT (cookie de sessão)
 *   2. Cria (ou reutiliza) cliente no Asaas
 *   3. Cria assinatura recorrente mensal R$49,90 via cartão de crédito
 *   4. Salva asaas_customer_id + subscription_status='pending' no user_metadata
 *   5. Retorna invoiceUrl do Asaas para o médico inserir dados do cartão
 */
export async function POST(request: NextRequest) {
  try {
    const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3'
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? ''

    // ── 1. Autenticação via Supabase JWT ──
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(_name: string, _value: string, _options: CookieOptions) {},
          remove(_name: string, _options: CookieOptions) {},
        },
      }
    )

    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const user = session.user
    const { cpfCnpj } = await request.json()

    if (!cpfCnpj || typeof cpfCnpj !== 'string' || cpfCnpj.replace(/\D/g, '').length < 11) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '')
    const fullName = user.user_metadata?.full_name || 'Médico BEM Plantonista'

    // ── 2. Criar (ou buscar) cliente no Asaas ──
    let customerId = user.user_metadata?.asaas_customer_id as string | undefined

    if (!customerId) {
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

      const customerData = await customerRes.json()

      if (!customerRes.ok) {
        console.error('Asaas customer error:', customerData)
        return NextResponse.json(
          { error: 'Erro ao criar cliente no gateway de pagamento', details: customerData },
          { status: 502 }
        )
      }

      customerId = customerData.id
    }

    // ── 3. Criar assinatura recorrente mensal ──
    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 1) // cobrar a partir de amanhã
    const dueDateStr = nextDueDate.toISOString().split('T')[0]

    const subscriptionRes = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: 49.90,
        nextDueDate: dueDateStr,
        cycle: 'MONTHLY',
        description: 'BEM Plantonista — Assinatura Mensal',
        externalReference: user.id,
      }),
    })

    const subscriptionData = await subscriptionRes.json()

    if (!subscriptionRes.ok) {
      console.error('Asaas subscription error:', subscriptionData)
      return NextResponse.json(
        { error: 'Erro ao criar assinatura', details: subscriptionData },
        { status: 502 }
      )
    }

    // ── 4. Salvar dados no user_metadata do Supabase ──
    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionData.id,
        subscription_status: 'pending',
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

    const paymentsData = await paymentsRes.json()
    const firstPayment = paymentsData?.data?.[0]
    const invoiceUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl || null

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
