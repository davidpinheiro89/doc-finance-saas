import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

const EMAIL_HTML = (name: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p>Olá, <strong>${name}</strong>!</p>

  <p>Obrigado por fazer parte do período beta do <strong>BEM Plantonista</strong>. Sua participação foi fundamental para aprimorarmos a plataforma.</p>

  <p>A partir do dia <strong>15 de julho de 2026</strong>, o acesso gratuito será encerrado. Para continuar organizando suas escalas e finanças de plantão, basta escolher um dos planos:</p>

  <ul style="line-height: 1.8;">
    <li><strong>Mensal:</strong> R$ 39,90/mês</li>
    <li><strong>Anual:</strong> R$ 299,00/ano (economia de R$ 179,80)</li>
  </ul>

  <p>Para assinar, acesse: <a href="https://www.bemplantonista.com.br" style="color: #2563eb; text-decoration: underline;">www.bemplantonista.com.br</a></p>

  <p>Qualquer dúvida, estamos à disposição.</p>

  <p style="margin-top: 32px;">Equipe BEM Plantonista</p>
</div>
`

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

  // ── Parâmetros ──
  const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false'
  const RESEND_API_KEY = process.env.RESEND_API_KEY_V2 ?? process.env.RESEND_API_KEY ?? ''

  if (!RESEND_API_KEY && !dryRun) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
  }

  // ── Buscar usuários beta ──
  const supabaseAdmin = getSupabaseAdmin()
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

  if (listError || !users) {
    return NextResponse.json({ error: 'Erro ao listar usuários', details: listError?.message }, { status: 500 })
  }

  const betaUsers = users.filter((u) => {
    const meta = u.user_metadata ?? {}
    return (
      meta.subscription_status === 'active' &&
      meta.subscription_end_date === '2026-07-15T03:00:00.000Z' &&
      u.email !== ADMIN_EMAIL
    )
  })

  const preview = betaUsers.map((u) => ({
    email: u.email,
    full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? '—',
  }))

  // ── Dry run: só retorna preview ──
  if (dryRun) {
    return NextResponse.json({
      mode: 'DRY_RUN',
      totalDestinatarios: preview.length,
      preview,
    })
  }

  // ── Enviar e-mails via Resend ──
  const enviados: string[] = []
  const falhas: { email: string; error: string }[] = []

  for (const user of betaUsers) {
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? 'Plantonista'

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'BEM Plantonista <noreply@bemplantonista.com.br>',
          to: [user.email],
          subject: 'Seu período beta está encerrando — continue com o BEM Plantonista',
          html: EMAIL_HTML(name),
        }),
      })

      if (res.ok) {
        enviados.push(user.email!)
      } else {
        const errBody = await res.text()
        falhas.push({ email: user.email!, error: `${res.status}: ${errBody.slice(0, 200)}` })
      }
    } catch (err: any) {
      falhas.push({ email: user.email!, error: err.message ?? 'Erro desconhecido' })
    }
  }

  return NextResponse.json({
    mode: 'LIVE',
    totalEnviados: enviados.length,
    totalFalhas: falhas.length,
    enviados,
    falhas,
  })
}
