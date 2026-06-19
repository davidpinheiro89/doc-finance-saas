/**
 * Configuração centralizada de tipos e cores de eventos da escala.
 * Compartilhada entre escala, configurações e qualquer outro componente.
 */

export const BLOCK_TYPES = [
  { key: 'plantao', label: 'Plantão', revenue: true },
  { key: 'folga', label: 'Folga', revenue: false },
  { key: 'pos-plantao', label: 'Pós-Plantão', revenue: false },
  { key: 'ferias', label: 'Férias', revenue: false },
  { key: 'personalizado', label: 'Personalizado', revenue: false },
] as const

export type BlockTypeKey = typeof BLOCK_TYPES[number]['key']

export const BLOCK_COLORS = [
  { key: 'emerald', label: 'Esmeralda', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200/60', text: 'text-emerald-800' },
  { key: 'indigo', label: 'Índigo', dot: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200/60', text: 'text-indigo-800' },
  { key: 'amber', label: 'Âmbar', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200/60', text: 'text-amber-800' },
  { key: 'rose', label: 'Rosa', dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200/60', text: 'text-rose-800' },
  { key: 'gray', label: 'Cinza', dot: 'bg-gray-500', bg: 'bg-gray-100', border: 'border-gray-200/60', text: 'text-gray-700' },
  { key: 'violet', label: 'Violeta', dot: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-200/60', text: 'text-violet-800' },
  { key: 'sky', label: 'Céu', dot: 'bg-sky-500', bg: 'bg-sky-50', border: 'border-sky-200/60', text: 'text-sky-800' },
  { key: 'orange', label: 'Laranja', dot: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200/60', text: 'text-orange-800' },
] as const

export type BlockColorKey = typeof BLOCK_COLORS[number]['key']

export const getColorConfig = (colorKey: string | null) => {
  return BLOCK_COLORS.find(c => c.key === colorKey) || BLOCK_COLORS[0]
}

/** Cores padrão por tipo de evento (usadas quando o usuário ainda não configurou) */
export const DEFAULT_CORES_EVENTO: Record<BlockTypeKey, BlockColorKey> = {
  'plantao': 'emerald',
  'folga': 'gray',
  'pos-plantao': 'sky',
  'ferias': 'amber',
  'personalizado': 'violet',
}
