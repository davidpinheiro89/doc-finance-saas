import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

export async function GET(request: Request) {
  // Authenticate the caller
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // Use service role to bypass RLS
  const admin = getSupabaseAdmin()

  const { data: feedbacks, error } = await admin
    .from('user_feedback')
    .select('id, user_id, rating, comment, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch user emails from auth.users
  const userIds = Array.from(new Set(feedbacks.map((f: any) => f.user_id)))
  const emailMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (users) {
      for (const u of users) {
        if (userIds.includes(u.id)) {
          emailMap[u.id] = u.email || 'N/A'
        }
      }
    }
  }

  const result = feedbacks.map((f: any) => ({
    ...f,
    email: emailMap[f.user_id] || 'N/A',
  }))

  return NextResponse.json({ feedbacks: result })
}
