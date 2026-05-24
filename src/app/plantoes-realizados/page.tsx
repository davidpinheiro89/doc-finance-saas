'use client'

import { useState, useEffect } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import type { Plantao } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { isFolga, formatHoras } from '@/lib/folga-utils'

export default function PlantoesRealizadosPage() {
  const { user, loading } = useAuthGuard()
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null)

  useEffect(() => {
    if (user) fetchPlantoes(user.id)
  }, [user])

  const fetchPlantoes = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: false })

      if (error) {
        console.error('Error fetching plantões:', error)
        setPlantoes([])
        return
      }

      // Apply automatic status logic for past plantões
      const processedData = (data || []).map(plantao => {
        const plantaoDate = new Date(plantao.data)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // If plantão date is in the past and status is still 'pendente', change to 'realizado'
        if (plantaoDate < today && plantao.status === 'pendente') {
          return { ...plantao, status: 'realizado' }
        }
        
        return plantao
      })
      
      setPlantoes(processedData)
    } catch (error) {
      console.error('Error fetching plantões:', error)
      setPlantoes([])
    }
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Filter past plantões (data anterior a hoje)
  const getPastPlantoes = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    const pastPlantoes = plantoes.filter(plantao => {
      const plantaoDate = new Date(plantao.data)
      return plantaoDate < today
    })

    // Apply date range filter if set
    if (dateRange.start || dateRange.end) {
      return pastPlantoes.filter(plantao => {
        const plantaoDate = new Date(plantao.data)
        const startDate = dateRange.start ? new Date(dateRange.start) : null
        const endDate = dateRange.end ? new Date(dateRange.end) : null

        if (startDate && endDate) {
          return plantaoDate >= startDate && plantaoDate <= endDate
        } else if (startDate) {
          return plantaoDate >= startDate
        } else if (endDate) {
          return plantaoDate <= endDate
        }
        
        return true
      })
    }

    return pastPlantoes
  }

  // Folgas são filtradas via isFolga() — seção separada abaixo da tabela
  const allPastPlantoes = getPastPlantoes()
  const filteredPlantoes = allPastPlantoes.filter(p => !isFolga(p))
  const folgasNoPeriodo = allPastPlantoes.filter(p => isFolga(p))

  // Calculate metrics (only remunerados)
  const metrics = {
    quantidade: filteredPlantoes.length,
    valorTotal: filteredPlantoes.reduce((sum, p) => sum + (p.valor || 0), 0),
    cargaHoraria: filteredPlantoes.reduce((sum, p) => sum + (p.horas || 0), 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // Use ISO string to avoid timezone issues
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  const getPaymentDeadline = (plantao: Plantao) => {
    if (!plantao.prazo_pagamento_dias) return null
    const plantaoDate = new Date(plantao.data + 'T00:00:00')
    const deadline = new Date(plantaoDate)
    deadline.setDate(deadline.getDate() + plantao.prazo_pagamento_dias)
    return deadline
  }

  const isOverdue = (plantao: Plantao) => {
    if (plantao.status === 'pago') return false
    const deadline = getPaymentDeadline(plantao)
    if (!deadline) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return today > deadline
  }

  const getDaysUntilPayment = (plantao: Plantao) => {
    const deadline = getPaymentDeadline(plantao)
    if (!deadline) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Math.round((deadline.getTime() - today.getTime()) / 86400000)
  }

  type SmartStatus = { label: string; color: string; tooltip: string }

  const getSmartStatus = (plantao: Plantao): SmartStatus => {
    if (plantao.status === 'pago') {
      return { label: 'Pago', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', tooltip: 'Pagamento recebido' }
    }

    if (isOverdue(plantao)) {
      const deadline = getPaymentDeadline(plantao)!
      const daysLate = Math.abs(getDaysUntilPayment(plantao) || 0)
      return {
        label: 'Atrasado',
        color: 'bg-red-50 text-red-700 border-red-200/60',
        tooltip: `Venceu em ${formatDate(deadline.toISOString().split('T')[0])} — ${daysLate} dia(s) de atraso`
      }
    }

    if (plantao.prazo_pagamento_dias) {
      const daysLeft = getDaysUntilPayment(plantao)
      if (daysLeft !== null && daysLeft <= 5 && daysLeft >= 0) {
        return {
          label: 'Vence em breve',
          color: 'bg-amber-50 text-amber-700 border-amber-200/60',
          tooltip: `Pagamento previsto em ${daysLeft} dia(s)`
        }
      }
      const deadline = getPaymentDeadline(plantao)!
      return {
        label: 'Aguardando',
        color: 'bg-sky-50 text-sky-700 border-sky-200/60',
        tooltip: `Pagamento previsto para ${formatDate(deadline.toISOString().split('T')[0])}`
      }
    }

    if (plantao.status === 'realizado' || plantao.status === 'confirmado') {
      return { label: 'Realizado', color: 'bg-green-50 text-green-700 border-green-200/60', tooltip: 'Plantão realizado — sem prazo de pagamento definido' }
    }

    return { label: 'Pendente', color: 'bg-gray-50 text-gray-600 border-gray-200/60', tooltip: 'Status pendente' }
  }

  const handleMarkAsPaid = async (plantaoId: string) => {
    setConfirmingPayment(plantaoId)
    try {
      const { error } = await supabase
        .from('plantoes')
        .update({ status: 'pago' })
        .eq('id', plantaoId)
        .eq('user_id', user!.id)

      if (error) {
        console.error('Error marking plantão as paid:', error)
        alert('Erro ao confirmar pagamento. Tente novamente.')
        return
      }

      if (user) await fetchPlantoes(user.id)
    } catch {
      alert('Erro ao confirmar pagamento. Tente novamente.')
    } finally {
      setConfirmingPayment(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      
      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 p-4 bg-white border-b sticky top-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <span className="h-6 w-6">☰</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Plantões Realizados</h1>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 hidden md:block">
            <h1 className="text-3xl font-bold text-gray-800">
              Plantões <span className="text-orange-500">Realizados</span>
            </h1>
            <p className="text-gray-600 mt-2">Histórico de plantões já realizados</p>
          </div>

          {/* Filtro de Período */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtrar por Período</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={dateRange.start}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={dateRange.end}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setDateRange({ start: '', end: '' })}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Limpar Filtro
                </button>
              </div>
            </div>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Plantões</p>
                  <p className="text-3xl font-bold text-orange-500 mt-2">
                    {metrics.quantidade}
                  </p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {formatCurrency(metrics.valorTotal)}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Carga Horária</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {metrics.cargaHoraria.toFixed(1)}h
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas de Pagamentos em Atraso */}
          {filteredPlantoes.some(plantao => isOverdue(plantao)) && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
              <div className="flex items-start">
                <div className="bg-orange-100 rounded-full p-2 mr-4 flex-shrink-0">
                  <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-orange-800 mb-2">
                    Pagamentos em Atraso Detectados
                  </h4>
                  <p className="text-sm text-orange-700 mb-3">
                    {filteredPlantoes.filter(plantao => isOverdue(plantao)).length} plantão(ões) com pagamento pendente ultrapassaram o prazo estabelecido.
                  </p>
                  <div className="space-y-2">
                    {filteredPlantoes
                      .filter(plantao => isOverdue(plantao))
                      .map(plantao => {
                        const plantaoDate = new Date(plantao.data)
                        const paymentDeadline = new Date(plantaoDate)
                        paymentDeadline.setDate(paymentDeadline.getDate() + (plantao.prazo_pagamento_dias || 30))
                        
                        return (
                          <div key={plantao.id} className="bg-white rounded-lg p-3 border border-orange-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium text-gray-800">{plantao.hospital}</span>
                                <span className="text-sm text-gray-600 ml-2">({formatDate(plantao.data)})</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-orange-600">
                                  {formatCurrency(plantao.valor)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Vencido: {formatDate(paymentDeadline.toISOString().split('T')[0])}
                                </div>
                                <button
                                  onClick={() => handleMarkAsPaid(plantao.id)}
                                  disabled={confirmingPayment === plantao.id}
                                  className="mt-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium py-1 px-2 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {confirmingPayment === plantao.id ? 'Confirmando...' : 'Marcar como Pago'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Plantões */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Histórico de Plantões</h3>
            </div>
            
            {filteredPlantoes.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500">Nenhum plantão realizado encontrado</p>
                <p className="text-sm text-gray-400 mt-2">Plantões realizados aparecerão aqui</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hospital
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Horas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPlantoes.map((plantao) => {
                      const status = getSmartStatus(plantao)
                      const canMarkPaid = plantao.status !== 'pago' && (status.label === 'Aguardando' || status.label === 'Vence em breve')
                      return (
                        <tr key={plantao.id} className={`hover:bg-gray-50/80 transition-colors ${isOverdue(plantao) ? 'bg-red-50/30' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(plantao.data)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {plantao.hospital}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatCurrency(plantao.valor)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatHoras(plantao.horas)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="group relative inline-block">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${status.color}`}>
                                {status.label === 'Pago' && (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                {status.label === 'Atrasado' && (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                                )}
                                {status.label === 'Vence em breve' && (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>
                                )}
                                {status.label}
                              </span>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-10 shadow-lg">
                                {status.tooltip}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            {canMarkPaid ? (
                              <button
                                onClick={() => handleMarkAsPaid(plantao.id)}
                                disabled={confirmingPayment === plantao.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Confirmar recebimento"
                              >
                                {confirmingPayment === plantao.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-emerald-500 border-t-transparent" />
                                ) : (
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                                <span className="hidden sm:inline">Dar Baixa</span>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Folgas no Período ── */}
          {folgasNoPeriodo.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Folgas no Período</h3>
              <p className="text-sm text-gray-500 mb-4">Dias de folga e disponibilidade registrados — não contabilizados nos totais financeiros.</p>
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 text-center">
                  <p className="text-2xl font-bold text-gray-700">{folgasNoPeriodo.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">folga(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {folgasNoPeriodo.map(f => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200/60 rounded-lg text-xs text-gray-600">
                      <span>☽</span>
                      {formatDate((f.data || '').split('T')[0])}
                      {f.hospital && f.hospital.toLowerCase() !== 'folga' && (
                        <span className="text-gray-400">— {f.hospital}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
