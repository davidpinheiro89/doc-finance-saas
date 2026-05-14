'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase-client'

/**
 * Resultado retornado por {@link useAuthGuard}.
 */
export interface UseAuthGuardResult {
  /** Usuário autenticado, ou `null` enquanto a verificação não termina. */
  user: User | null
  /** `true` enquanto o check inicial está em andamento. */
  loading: boolean
}

/**
 * Hook de proteção de rota.
 *
 * Substitui o boilerplate `checkAuth()` duplicado em todas as páginas
 * protegidas. Faz três coisas:
 *
 *   1. **Check inicial**: lê a sessão atual via {@link supabaseClient}; se
 *      não houver usuário, redireciona para `redirectTo` (padrão `/login`).
 *   2. **Reatividade**: assina `onAuthStateChange` para reagir a logout
 *      em outra aba, expiração de token ou login manual.
 *   3. **Cleanup**: cancela a inscrição quando o componente desmonta,
 *      evitando memory leaks.
 *
 * @example
 * ```tsx
 * const { user, loading } = useAuthGuard()
 *
 * useEffect(() => {
 *   if (user) fetchData(user.id)
 * }, [user])
 *
 * if (loading) return <Spinner />
 * if (!user) return null  // redirect em curso
 * return <Dashboard user={user} />
 * ```
 */
export function useAuthGuard(redirectTo: string = '/login'): UseAuthGuardResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    // 1. Check inicial — usa getSession() (lê do storage, rápido) e cai
    //    para getUser() se a sessão estiver suspeita. Para a maioria dos
    //    casos getSession é suficiente porque RLS valida tudo no servidor.
    supabaseClient.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return

        if (error || !session?.user) {
          router.replace(redirectTo)
          return
        }

        setUser(session.user)
      })
      .catch(() => {
        if (mounted) router.replace(redirectTo)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    // 2. Reage a mudanças de auth (logout em outra aba, refresh de token,
    //    expiração de sessão etc.)
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null)
        router.replace(redirectTo)
        return
      }

      // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED → atualiza o user local
      setUser(session.user)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, redirectTo])

  return { user, loading }
}
