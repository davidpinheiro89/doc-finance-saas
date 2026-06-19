'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import type { Plantao } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { isFolga } from '@/lib/folga-utils'
import { calcularValorEfetivo } from '@/lib/calcular-valor'

export default function AnalyticsPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) fetchPlantoes(user.id)
  }, [user])

  const fetchPlantoes = async (userId: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: false })

      if (error) { console.error('Supabase error:', error); setPlantoes([]); return }
      setPlantoes(data || [])
    } catch { setPlantoes([]) }
    finally { setIsLoading(false) }
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }))
  }

  // Filter plantões based on date range and exclude folgas
  const filteredPlantoes = useMemo(() => {
    const base = plantoes.filter(p => !isFolga(p))
    if (!dateRange.start && !dateRange.end) return base
    return base.filter(plantao => {
      const plantaoDate = new Date(plantao.data)
      const startDate = dateRange.start ? new Date(dateRange.start) : null
      const endDate = dateRange.end ? new Date(dateRange.end) : null
      if (startDate && endDate) return plantaoDate >= startDate && plantaoDate <= endDate
      if (startDate) return plantaoDate >= startDate
      if (endDate) return plantaoDate <= endDate
      return true
    })
  }, [plantoes, dateRange])

  const filteredMetrics = useMemo(() => {
    const valorTotal = calcularValorEfetivo(filteredPlantoes)
    return {
      quantidade: filteredPlantoes.length,
      valorTotal,
      cargaHoraria: filteredPlantoes.reduce((sum, p) => sum + (p.horas || 0), 0),
      mediaPorPlantao: filteredPlantoes.length > 0 ? valorTotal / filteredPlantoes.length : 0
    }
  }, [filteredPlantoes])

  // Volume by unit
  const volumeChartData = useMemo(() => {
    const byUnit = filteredPlantoes.reduce((acc, p) => {
      const unit = p.hospital
      if (!acc[unit]) acc[unit] = { quantidade: 0, horas: 0 }
      acc[unit].quantidade += 1
      acc[unit].horas += Number(p.horas) || 0
      return acc
    }, {} as Record<string, { quantidade: number; horas: number }>)
    return Object.entries(byUnit)
      .map(([unidade, data]) => ({ unidade, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)
  }, [filteredPlantoes])

  // Workload concentration
  const workloadConcentration = useMemo(() => {
    if (filteredPlantoes.length === 0) return null
    const hoursByUnit = filteredPlantoes.reduce((acc, p) => {
      acc[p.hospital] = (acc[p.hospital] || 0) + (p.horas || 0)
      return acc
    }, {} as Record<string, number>)
    const totalHours = Object.values(hoursByUnit).reduce((s, h) => s + h, 0)
    if (totalHours === 0) return null
    const sorted = Object.entries(hoursByUnit)
      .map(([unit, hours]) => ({ unit, hours, percentage: (hours / totalHours) * 100 }))
      .sort((a, b) => b.percentage - a.percentage)
    return sorted[0]
  }, [filteredPlantoes])

  // Monthly/weekly hours for health monitor
  const healthData = useMemo(() => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const monthlyHours = plantoes
      .filter(p => { if (!p.data) return false; const d = new Date(p.data + 'T00:00:00'); return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.horas && p.horas > 0 })
      .reduce((sum, p) => sum + (p.horas || 0), 0)
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0)
    const weeklyHours = plantoes
      .filter(p => { if (!p.data) return false; const d = new Date(p.data + 'T00:00:00'); return !isNaN(d.getTime()) && d >= sevenDaysAgo && d <= today && p.horas && p.horas > 0 })
      .reduce((sum, p) => sum + (p.horas || 0), 0)
    return { monthlyHours, weeklyHours, healthWarning: weeklyHours > 60 }
  }, [plantoes])

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
    </div>
  )

  if (!user) return null

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 overflow-auto w-full relative z-10">
        {/* ── Header Premium ── */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Meu Desempenho</h1>
                  <p className="text-xs text-gray-500 hidden sm:block">Análise detalhada da sua performance</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-800">{user?.user_metadata?.full_name || 'Médico'}</p>
                  <p className="text-xs text-gray-400">{user?.user_metadata?.crm || 'CRM'}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">

          {/* ── Filtro de Período ── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-gray-500">Período:</p>
              <div className="flex items-center gap-2">
                <input type="date" value={dateRange.start} onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                <span className="text-gray-400 text-xs">até</span>
                <input type="date" value={dateRange.end} onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                {(dateRange.start || dateRange.end) && (
                  <button onClick={() => setDateRange({ start: '', end: '' })} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Limpar datas">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              {(dateRange.start || dateRange.end) && (
                <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200/60">
                  {filteredPlantoes.length} plantões no período
                </span>
              )}
            </div>
          </div>

          {/* ── Cards de Métricas Premium ── */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-gray-200/60 p-5 animate-pulse">
                  <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                  <div className="h-7 w-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Plantões */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300">
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                <p className="text-sm font-medium text-orange-100">Plantões Realizados</p>
                <p className="text-3xl font-bold mt-1">{filteredMetrics.quantidade}</p>
                <p className="text-xs text-orange-200 mt-1">no período selecionado</p>
              </div>

              {/* Receita */}
              <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200/60 p-5 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-50" />
                <p className="text-sm font-medium text-gray-500">Receita Acumulada</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(filteredMetrics.valorTotal)}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  Média {formatCurrency(filteredMetrics.mediaPorPlantao)}/plantão
                </p>
              </div>

              {/* Carga Horária */}
              <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200/60 p-5 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-sky-50" />
                <p className="text-sm font-medium text-gray-500">Carga Horária Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{filteredMetrics.cargaHoraria.toFixed(0)}h</p>
                <p className="text-xs text-sky-600 font-medium mt-1">
                  {filteredMetrics.quantidade > 0 ? `${(filteredMetrics.cargaHoraria / filteredMetrics.quantidade).toFixed(1)}h/plantão` : '—'}
                </p>
              </div>

              {/* Valor/Hora */}
              <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200/60 p-5 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-violet-50" />
                <p className="text-sm font-medium text-gray-500">Valor por Hora</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {filteredMetrics.cargaHoraria > 0 ? formatCurrency(filteredMetrics.valorTotal / filteredMetrics.cargaHoraria) : '—'}
                </p>
                <p className="text-xs text-violet-600 font-medium mt-1">eficiência média</p>
              </div>
            </div>
          )}

          {/* ── Monitor de Saúde ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/60 p-5 md:p-6">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-sky-200/20" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-sm shadow-sky-500/20">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Monitor de Carga Horária</h3>
                <p className="text-[10px] text-gray-500">Acompanhe sua saúde ocupacional</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-sky-100/60">
                <p className="text-xs font-medium text-gray-500 mb-1">Este Mês</p>
                <p className={`text-2xl font-bold ${healthData.monthlyHours > 160 ? 'text-red-600' : 'text-gray-900'}`}>
                  {healthData.monthlyHours.toFixed(0)}h
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {healthData.monthlyHours > 160 ? '⚠️ Acima da média recomendada' : '✓ Dentro do esperado'}
                </p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-sky-100/60">
                <p className="text-xs font-medium text-gray-500 mb-1">Últimos 7 Dias</p>
                <p className={`text-2xl font-bold ${healthData.healthWarning ? 'text-red-600' : 'text-gray-900'}`}>
                  {healthData.weeklyHours.toFixed(0)}h
                </p>
                <div className="mt-1.5">
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${healthData.weeklyHours > 60 ? 'bg-red-500' : healthData.weeklyHours > 40 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (healthData.weeklyHours / 60) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Limite: 60h/semana</p>
                </div>
              </div>
            </div>
            {healthData.healthWarning && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200/60">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p className="text-xs text-red-700 font-medium">Carga semanal de {healthData.weeklyHours.toFixed(0)}h excede o limite seguro. Cuide da sua saúde!</p>
              </div>
            )}
          </div>

          {/* ── Concentração por Unidade (alerta inteligente) ── */}
          {workloadConcentration && (
            <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
              workloadConcentration.percentage >= 70
                ? 'bg-amber-50 border-amber-200/60'
                : 'bg-sky-50 border-sky-200/60'
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                workloadConcentration.percentage >= 70 ? 'bg-amber-100' : 'bg-sky-100'
              }`}>
                <svg className={`h-4 w-4 ${workloadConcentration.percentage >= 70 ? 'text-amber-600' : 'text-sky-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-700">
                Maior concentração: <span className="font-bold">{workloadConcentration.unit}</span> com {workloadConcentration.percentage.toFixed(0)}% da carga horária total.
                {workloadConcentration.percentage >= 70 && <span className="text-amber-700 font-medium"> Considere diversificar.</span>}
              </p>
            </div>
          )}

          {/* ── Distribuição por Hospital ── */}
          {volumeChartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Distribuição por Hospital</h3>
                  <p className="text-xs text-gray-400">{volumeChartData.length} unidade(s) no período</p>
                </div>
              </div>
              <div className="space-y-3">
                {volumeChartData.slice(0, 8).map((item, i) => {
                  const maxQtd = volumeChartData[0].quantidade
                  const pct = maxQtd > 0 ? (item.quantidade / maxQtd) * 100 : 0
                  return (
                    <div key={item.unidade}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{item.unidade}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">{item.quantidade}</span>
                          <span>plantões</span>
                          {item.horas > 0 && <span className="text-gray-400">· {item.horas}h</span>}
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!isLoading && filteredPlantoes.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <svg className="h-7 w-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Sem dados no período</h3>
              <p className="text-sm text-gray-500">Ajuste o filtro de datas ou adicione plantões para ver suas métricas de desempenho.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}