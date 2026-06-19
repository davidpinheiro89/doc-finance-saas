'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { DEFAULT_CORES_EVENTO, type BlockColorKey, type BlockTypeKey } from '@/lib/block-config'

export type CoresEvento = Record<BlockTypeKey, BlockColorKey>

interface UseCoresEventoReturn {
  coresEvento: CoresEvento
  loading: boolean
  salvarCoresEvento: (cores: CoresEvento) => Promise<boolean>
}

/**
 * Hook para ler e salvar as cores padrão dos tipos de evento do usuário.
 * Busca de `user_settings.cores_evento` (jsonb).
 * Retorna DEFAULT_CORES_EVENTO enquanto carrega ou se o usuário não configurou.
 */
export function useCoresEvento(userId: string | undefined): UseCoresEventoReturn {
  const [coresEvento, setCoresEvento] = useState<CoresEvento>({ ...DEFAULT_CORES_EVENTO })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    const fetch = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('cores_evento')
        .eq('user_id', userId)
        .single()

      if (data?.cores_evento && typeof data.cores_evento === 'object') {
        setCoresEvento({ ...DEFAULT_CORES_EVENTO, ...(data.cores_evento as Partial<CoresEvento>) })
      }
      setLoading(false)
    }

    fetch()
  }, [userId])

  const salvarCoresEvento = useCallback(async (cores: CoresEvento): Promise<boolean> => {
    if (!userId) return false

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: userId, cores_evento: cores },
        { onConflict: 'user_id' }
      )

    if (!error) {
      setCoresEvento(cores)
      return true
    }
    return false
  }, [userId])

  return { coresEvento, loading, salvarCoresEvento }
}
