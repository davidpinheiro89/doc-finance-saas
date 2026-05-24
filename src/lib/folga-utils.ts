/**
 * Utilitário centralizado para identificar registros de folga / disponível.
 *
 * A fonte de verdade é o campo `classificacao` gravado no Supabase.
 * Como fallback (registros antigos sem classificação), usa heurística de
 * nome + valor/horas zerados.
 */

/** Campos mínimos necessários para a detecção. */
interface FolgaCheckable {
  classificacao?: string | null
  hospital?: string | null
  valor?: number | null
  horas?: number | null
}

/**
 * Retorna `true` se o registro representar folga ou disponibilidade —
 * isto é, **não** é um plantão remunerado.
 */
export function isFolga(p: FolgaCheckable): boolean {
  // 1. Fonte primária: campo classificacao
  const cls = (p.classificacao || '').toLowerCase()
  if (cls === 'folga' || cls === 'disponivel' || cls === 'disponível') return true

  // 2. Fallback: nome do hospital contém "folg" (Folga, Folguinha…)
  const name = (p.hospital || '').toLowerCase()
  if (name.includes('folg') || name === 'disponível' || name === 'disponivel') return true

  // 3. Fallback: valor e horas ambos zerados/nulos
  if ((Number(p.valor) || 0) <= 0 && (Number(p.horas) || 0) <= 0) return true

  return false
}

/**
 * Formata horas sem casas decimais desnecessárias.
 * Ex: 12.0 → "12h", 6.5 → "6.5h", 0 → "0h"
 */
export function formatHoras(h: number | null | undefined): string {
  const n = Number(h) || 0
  return n % 1 === 0 ? `${Math.round(n)}h` : `${n}h`
}
