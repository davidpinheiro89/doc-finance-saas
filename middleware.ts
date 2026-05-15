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
        remove(name: string, options: CookieOptions) {
          request.cookies.delete({ name, ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Raiz do site
  if (pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rotas protegidas (requerem autenticação)
  const protectedRoutes = ['/dashboard', '/escala', '/financeiro', '/ir', '/reports', '/analytics', '/plantoes-futuros', '/plantoes-realizados']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rotas de auth (redirecionam se já estiver logado)
  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login/:path*', '/register/:path*', '/dashboard/:path*', '/escala/:path*', '/financeiro/:path*', '/ir/:path*', '/reports/:path*', '/analytics/:path*', '/plantoes-futuros/:path*', '/plantoes-realizados/:path*'],
}
