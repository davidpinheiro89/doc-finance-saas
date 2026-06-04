import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()
  let page = 1
  const perPage = 100
  let totalExpired = 0
  let totalErrors = 0

  while (true) {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error || !users || users.length === 0) break

    const expired = users.filter(user => {
      const status = user.user_metadata?.subscription_status
      const endDate = user.user_metadata?.subscription_end_date
      if (status !== 'active') return false
      if (!endDate) return false
      return new Date(endDate) < new Date()
    })

    for (const user of expired) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, subscription_status: 'inactive' },
      })
      if (updateError) { totalErrors++ } else { totalExpired++ }
    }

    if (users.length < perPage) break
    page++
  }

  return NextResponse.json({ ok: true, expired: totalExpired, errors: totalErrors, ranAt: now })
}
