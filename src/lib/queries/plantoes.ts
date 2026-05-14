/**
 * Queries de `plantoes` — funções puras de acesso ao Supabase.
 *
 * Toda página/hook que precise ler plantões deve consumir estas funções
 * (via TanStack Query) em vez de chamar o cliente Supabase diretamente.
 * Isso garante:
 *   - Cache compartilhado entre páginas (deduplicação de requests).
 *   - Query keys consistentes para invalidação cirúrgica após mutações.
 *   - Um único ponto para evoluir o schema/select.
 */

import { supabaseClient } from '@/lib/supabase-client'
import type { Plantao } from '@/types/database'

// =============================================================================
// Projeção — colunas que voltam dos fetchers de listagem
// =============================================================================

/**
 * Colunas selecionadas por `fetchPlantoesByUser*`. Centralizada para evitar
 * divergências entre as várias queries.
 *
 * **Não selecionamos**: `created_at`, `updated_at`, `tipo_evento`.
 * Esses campos não são lidos por nenhuma página de listagem hoje; se
 * passarem a ser, basta adicionar aqui e estender `PlantaoListItem`.
 */
export const PLANTAO_LIST_COLUMNS = [
  'id',
  'user_id',
  'hospital',
  'endereco',
  'cep',
  'data',
  'valor',
  'horas',
  'status',
  'prazo_pagamento_dias',
  'data_prevista_pagamento',
  'classificacao',
  'especialidade',
  'local_favorito_id',
].join(', ')

/**
 * Tipo concreto retornado pelos fetchers — subset do `Plantao` completo.
 * Use este tipo em estados/props que recebem o resultado das queries de
 * listagem. Para inserts/updates, continue usando `Plantao`/`PlantaoInsert`.
 */
export type PlantaoListItem = Pick<
  Plantao,
  | 'id'
  | 'user_id'
  | 'hospital'
  | 'endereco'
  | 'cep'
  | 'data'
  | 'valor'
  | 'horas'
  | 'status'
  | 'prazo_pagamento_dias'
  | 'data_prevista_pagamento'
  | 'classificacao'
  | 'especialidade'
  | 'local_favorito_id'
>

// =============================================================================
// Query keys — fonte única para invalidação
// =============================================================================

/**
 * Hierarquia de query keys. Use os helpers abaixo em vez de literais para
 * que `invalidateQueries({ queryKey: plantoesKeys.byUser(uid) })` funcione
 * como esperado (invalida o user inteiro, incluindo sub-ranges).
 */
export const plantoesKeys = {
  /** Raiz — invalida todos os caches de plantões. */
  all: ['plantoes'] as const,

  /** Todos os plantões de um usuário (sem filtro de data). */
  byUser: (userId: string) => [...plantoesKeys.all, 'byUser', userId] as const,

  /** Plantões de um usuário dentro de um intervalo de datas. */
  byUserRange: (userId: string, start: string, end: string) =>
    [...plantoesKeys.byUser(userId), 'range', { start, end }] as const,
}

// =============================================================================
// Fetchers
// =============================================================================

/**
 * Retorna todos os plantões do usuário, ordenados por data (mais recente
 * primeiro). RLS no servidor já restringe à linha do próprio usuário,
 * mas filtramos explicitamente por defesa em profundidade.
 *
 * Seleciona apenas as colunas listadas em {@link PLANTAO_LIST_COLUMNS} —
 * reduz payload de rede e deixa explícito o contrato com a UI.
 */
export async function fetchPlantoesByUser(userId: string): Promise<PlantaoListItem[]> {
  const { data, error } = await supabaseClient
    .from('plantoes')
    .select(PLANTAO_LIST_COLUMNS)
    .eq('user_id', userId)
    .order('data', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as PlantaoListItem[]
}

/**
 * Retorna os plantões do usuário num intervalo de datas `[start, end]`
 * (inclusivos). `start` e `end` devem estar em formato ISO `YYYY-MM-DD`.
 */
export async function fetchPlantoesByUserRange(
  userId: string,
  start: string,
  end: string,
): Promise<PlantaoListItem[]> {
  const { data, error } = await supabaseClient
    .from('plantoes')
    .select(PLANTAO_LIST_COLUMNS)
    .eq('user_id', userId)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as PlantaoListItem[]
}

// =============================================================================
// Transforms reutilizáveis (passar via `select` do useQuery)
// =============================================================================

/**
 * Regra de negócio: plantões com data já passada e status ainda `pendente`
 * são exibidos como `realizado`. Não muda o banco — apenas a visualização.
 *
 * Genérico em `T` (qualquer objeto com `data` e `status`) para servir tanto
 * a `PlantaoListItem` quanto a `Plantao` completo.
 */
export function applyAutoRealizadoStatus<T extends { data: string; status: Plantao['status'] }>(
  plantoes: T[],
): T[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return plantoes.map((p) => {
    const plantaoDate = new Date(p.data + 'T00:00:00')
    if (plantaoDate < today && p.status === 'pendente') {
      return { ...p, status: 'realizado' as const }
    }
    return p
  })
}
