/**
 * Tipos canônicos do banco de dados — BEM Plantonista.
 *
 * Esta é a **fonte única da verdade** para as entidades persistidas no
 * Supabase. Toda página/lib deve importar daqui em vez de redeclarar
 * interfaces locais (cada cópia divergente costuma virar bug em produção).
 *
 * Quando o schema do banco mudar:
 *   1. Crie/atualize a migration SQL correspondente.
 *   2. Atualize este arquivo refletindo a nova realidade.
 *   3. Idealmente, gere o tipo Database via `supabase gen types typescript`
 *      e substitua os tipos manuais abaixo.
 */

// =============================================================================
// Enums / unions
// =============================================================================

/** Estados persistidos de um plantão na coluna `status`. */
export type PlantaoStatus = 'pendente' | 'confirmado' | 'realizado' | 'pago'

/** Tipo de evento na agenda — diferencia plantão real de marcações auxiliares. */
export type TipoEvento = 'plantao' | 'folga' | 'disponivel'

/** Categorias suportadas para despesas (usadas em IR e relatórios). */
export type CategoriaDespesa =
  | 'transporte'
  | 'alimentacao'
  | 'hospedagem'
  | 'equipamento'
  | 'educacao'
  | 'outros'

/**
 * Status derivado mostrado na UI — NÃO existe na coluna `status` do banco.
 * Calculado em runtime a partir do `status` persistido + datas/prazos.
 */
export type PlantaoStatusUI = PlantaoStatus | 'aguardando' | 'atrasado'

// =============================================================================
// Entidades
// =============================================================================

/** Plantão — linha da tabela `public.plantoes`. */
export interface Plantao {
  id: string
  user_id: string
  hospital: string
  endereco: string | null
  cep: string | null
  data: string                       // ISO YYYY-MM-DD
  valor: number
  horas: number | null
  status: PlantaoStatus
  prazo_pagamento_dias: number | null
  data_prevista_pagamento: string | null
  classificacao: string | null
  especialidade: string | null
  tipo_evento: TipoEvento | null
  local_favorito_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Payload para criação de plantão — `id`/`user_id`/timestamps são
 * preenchidos pelo banco ou pelo client antes do insert.
 */
export type PlantaoInsert = Omit<Plantao, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Plantao, 'id' | 'created_at' | 'updated_at'>>

/** Atualização parcial — qualquer campo exceto chaves. */
export type PlantaoUpdate = Partial<Omit<Plantao, 'id' | 'user_id' | 'created_at'>>

/** Despesa — linha da tabela `public.despesas`. */
export interface Despesa {
  id: string
  user_id: string
  descricao: string
  valor: number
  data: string                       // ISO YYYY-MM-DD
  categoria: CategoriaDespesa | string  // string para tolerar valores legados
  recorrente: boolean | null
  created_at: string
  updated_at: string
}

export type DespesaInsert = Omit<Despesa, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Despesa, 'id' | 'created_at' | 'updated_at'>>

export type DespesaUpdate = Partial<Omit<Despesa, 'id' | 'user_id' | 'created_at'>>

/** Categorias de documentos profissionais na wallet digital. */
export type CategoriaDocumento =
  | 'crm'
  | 'diploma'
  | 'residencia'
  | 'rg'
  | 'cpf'
  | 'pis'
  | 'titulo_especialista'
  | 'comprovante_endereco'
  | 'certidao_negativa'
  | 'alvara'
  | 'outro'

/** Documento — linha da tabela `public.documentos`. */
export interface Documento {
  id: string
  user_id: string
  nome: string
  categoria: CategoriaDocumento | string
  arquivo_url: string | null
  arquivo_nome: string | null
  arquivo_tipo: string | null          // MIME type
  arquivo_tamanho: number | null       // bytes
  validade: string | null              // ISO YYYY-MM-DD, null = sem validade
  notas: string | null
  created_at: string
  updated_at: string
}

export type DocumentoInsert = Omit<Documento, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Documento, 'id' | 'created_at' | 'updated_at'>>

export type DocumentoUpdate = Partial<Omit<Documento, 'id' | 'user_id' | 'created_at'>>

/** Local favorito — linha da tabela `public.locais_favoritos`. */
export interface LocalFavorito {
  id: string
  user_id: string
  nome: string
  endereco: string
  valor_hora: number
  created_at: string
  updated_at: string
}

// =============================================================================
// Type guards / helpers
// =============================================================================

/** Garante em tempo de execução que um valor é um PlantaoStatus válido. */
export const isPlantaoStatus = (value: unknown): value is PlantaoStatus =>
  value === 'pendente' ||
  value === 'confirmado' ||
  value === 'realizado' ||
  value === 'pago'
