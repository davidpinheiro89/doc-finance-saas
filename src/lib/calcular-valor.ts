/**
 * Utilitário para cálculo de valor efetivo de plantões considerando
 * o tipo de remuneração "fixo_mensal".
 *
 * Regra:
 * - `por_plantao` (ou null/undefined — registros antigos): soma normalmente.
 * - `fixo_mensal`: agrupa por `grupo_recorrencia_id + mês (YYYY-MM)` e
 *   conta o valor UMA ÚNICA VEZ por grupo/mês.
 */

interface PlantaoParaCalculo {
  valor: number
  data: string // ISO YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  grupo_recorrencia_id?: string | null
  tipo_remuneracao?: 'por_plantao' | 'fixo_mensal' | string | null
}

/**
 * Calcula o valor efetivo total de um array de plantões, aplicando a
 * regra de deduplicação para plantões com tipo_remuneracao = 'fixo_mensal'.
 */
export function calcularValorEfetivo<T extends PlantaoParaCalculo>(plantoes: T[]): number {
  let total = 0
  const fixoProcessado = new Set<string>()

  for (const p of plantoes) {
    if (p.tipo_remuneracao === 'fixo_mensal' && p.grupo_recorrencia_id) {
      const mes = (p.data || '').split('T')[0].slice(0, 7) // "YYYY-MM"
      const chave = `${p.grupo_recorrencia_id}|${mes}`
      if (fixoProcessado.has(chave)) continue
      fixoProcessado.add(chave)
      total += p.valor || 0
    } else {
      total += p.valor || 0
    }
  }

  return total
}

/**
 * Calcula valor/hora considerando a regra fixo_mensal.
 * Para grupos fixo_mensal: valor único do mês ÷ soma de TODAS as horas
 * das ocorrências daquele grupo no mês.
 *
 * Para plantões por_plantao: soma valores ÷ soma horas (comportamento atual).
 */
export function calcularValorHora<T extends PlantaoParaCalculo & { horas?: number | null }>(plantoes: T[]): number {
  const valorTotal = calcularValorEfetivo(plantoes)
  const horasTotal = plantoes.reduce((s, p) => s + (p.horas || 0), 0)
  return horasTotal > 0 ? valorTotal / horasTotal : 0
}

/**
 * Agrupa plantões por hospital e calcula valor efetivo por hospital,
 * respeitando a regra fixo_mensal.
 */
export function calcularValorPorHospital<T extends PlantaoParaCalculo & { hospital: string; horas?: number | null }>(
  plantoes: T[]
): Record<string, { valor: number; horas: number; count: number }> {
  const hospitalMap: Record<string, { plantoes: T[]; count: number }> = {}

  for (const p of plantoes) {
    if (!p.hospital) continue
    if (!hospitalMap[p.hospital]) hospitalMap[p.hospital] = { plantoes: [], count: 0 }
    hospitalMap[p.hospital].plantoes.push(p)
    hospitalMap[p.hospital].count += 1
  }

  const result: Record<string, { valor: number; horas: number; count: number }> = {}
  for (const [name, data] of Object.entries(hospitalMap)) {
    result[name] = {
      valor: calcularValorEfetivo(data.plantoes),
      horas: data.plantoes.reduce((s, p) => s + (p.horas || 0), 0),
      count: data.count,
    }
  }

  return result
}
