'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Providers de cliente que envolvem toda a árvore React.
 *
 * Atualmente carrega o `QueryClientProvider` do TanStack Query. A
 * instância do `QueryClient` é criada com `useState(() => ...)` para
 * garantir que cada montagem do cliente tenha sua própria instância
 * (importante em SSR — evita que dados de um request "vazem" para outro).
 *
 * Defaults escolhidos:
 *   - `staleTime: 30s` — evita refetch redundante em navegações rápidas.
 *   - `gcTime: 5min` — dados ficam em cache por 5min após o último uso.
 *   - `refetchOnWindowFocus: false` — médico volta da escala sem barulho.
 *   - `retry: 1` — uma tentativa de retry em falhas transientes.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
