import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

export async function GET(request: NextRequest) {
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

  return NextResponse.json({
    ASAAS_API_KEY_length: process.env.ASAAS_API_KEY?.length ?? 0,
    ASAAS_API_KEY_first6: process.env.ASAAS_API_KEY?.slice(0, 6) ?? 'EMPTY',
    ASAAS_API_KEY_last4: process.env.ASAAS_API_KEY?.slice(-4) ?? 'EMPTY',
    ASAAS_BASE_URL: process.env.ASAAS_BASE_URL ?? 'EMPTY',
    ASAAS_WEBHOOK_SECRET_length: process.env.ASAAS_WEBHOOK_SECRET?.length ?? 0,
    runtime: process.env.NEXT_RUNTIME ?? 'unknown',
    VERCEL_ENV: process.env.VERCEL_ENV ?? 'EMPTY',
    NODE_ENV: process.env.NODE_ENV ?? 'EMPTY',
    allAsaasKeys: Object.keys(process.env).filter(k => k.includes('ASAAS')),
    timestamp: new Date().toISOString(),
  })
}
