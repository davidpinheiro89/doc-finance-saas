/**
 * Utilitários de data do BEM Plantonista.
 *
 * Todas as datas de plantão são armazenadas no Supabase como YYYY-MM-DD
 * (sem hora, sem timezone). NUNCA usar `new Date(dateString)` diretamente,
 * pois o JS interpreta a string como UTC e a converte para o fuso local
 * (UTC-3 no Brasil), causando off-by-one no dia.
 */

/**
 * Formata "YYYY-MM-DD" para "DD/MM/YYYY" sem conversão de fuso horário.
 * Faz split manual da string, evitando `new Date()` completamente.
 */
export function formatDateBR(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('T')[0].split('-')
  if (!year || !month || !day) return dateString
  return `${day}/${month}/${year}`
}

/**
 * Retorna a data local de HOJE no formato YYYY-MM-DD.
 * Usa getFullYear/Month/Date (hora local) em vez de toISOString (UTC).
 */
export function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Retorna uma Date como YYYY-MM-DD na hora local (sem conversão UTC).
 */
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Retorna o intervalo (start, end) do mês atual no formato YYYY-MM-DD,
 * computado em hora local — seguro mesmo perto da meia-noite.
 */
export function getCurrentMonthRangeLocal(): { start: string; end: string } {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: toLocalISO(firstDay), end: toLocalISO(lastDay) }
}

/**
 * Retorna o intervalo (start, end) do mês anterior no formato YYYY-MM-DD.
 */
export function getPreviousMonthRangeLocal(): { start: string; end: string } {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start: toLocalISO(firstDay), end: toLocalISO(lastDay) }
}
