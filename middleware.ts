import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de autenticação do BEM Plantonista.
 *
 * Regras de redirecionamento:
 * - Raiz (/): redireciona para /dashboard se autenticado, /login se não
 * - /dashboard: redireciona para /login se não autenticado
 * - /login, /register: redireciona para /dashboard se já autenticado
 *
 * Usa o Supabase SSR client para ler a sessão do cookie.
 */

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
        },
        remove(name: string, _options: CookieOptions) {
          request.cookies.delete(name)
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const subscriptionStatus = session?.user?.user_metadata?.subscription_status
  const isActive = subscriptionStatus === 'active'

  // Raiz do site
  if (pathname === '/') {
    if (session && isActive) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (session && !isActive) {
      return NextResponse.redirect(new URL('/assinatura', request.url))
    }
    // Sem sessão: mostra a Landing Page normalmente
    return NextResponse.next()
  }

  // Página de assinatura (requer login, mas não requer assinatura)
  if (pathname.startsWith('/assinatura')) {
    if (!session) return NextResponse.redirect(new URL('/login', request.url))
    if (isActive) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.next()
  }

  // Rotas protegidas (requerem autenticação + assinatura ativa)
  const protectedRoutes = ['/dashboard', '/escala', '/financeiro', '/ir', '/reports', '/analytics', '/plantoes-futuros', '/plantoes-realizados', '/documentos']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    if (!session) return NextResponse.redirect(new URL('/login', request.url))
    if (!isActive) return NextResponse.redirect(new URL('/assinatura', request.url))
    return NextResponse.next()
  }

  // Rotas de auth (redirecionam se já estiver logado)
  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (isAuthRoute && session) {
    if (isActive) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/assinatura', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login/:path*', '/register/:path*', '/dashboard/:path*', '/escala/:path*', '/financeiro/:path*', '/ir/:path*', '/reports/:path*', '/analytics/:path*', '/plantoes-futuros/:path*', '/plantoes-realizados/:path*', '/documentos/:path*', '/assinatura/:path*'],
}
