'use client'

import { useState, useEffect } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import type { Plantao } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { isFolga, formatHoras } from '@/lib/folga-utils'

export default function PlantoesFuturosPage() {
  const { user, loading } = useAuthGuard()
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })

  useEffect(() => {
    if (user) fetchPlantoes(user.id)
  }, [user])

  const fetchPlantoes = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: true }) // Future plantões in chronological order

      if (error) {
        console.error('Error fetching plantões:', error)
        setPlantoes([])
        return
      }

      setPlantoes(data || [])
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

  // Filter future plantões (data de hoje em diante), excluindo folgas
  const getFuturePlantoes = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    const futurePlantoes = plantoes.filter(plantao => {
      if (isFolga(plantao)) return false
      const plantaoDate = new Date(plantao.data + 'T00:00:00')
      return plantaoDate >= today
    })

    // Apply date range filter if set
    if (dateRange.start || dateRange.end) {
      return futurePlantoes.filter(plantao => {
        const plantaoDate = new Date(plantao.data + 'T00:00:00')
        const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null
        const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : null

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

    return futurePlantoes
  }

  const filteredPlantoes = getFuturePlantoes()

  // Calculate metrics
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
    // Split puro da string YYYY-MM-DD para evitar conversão UTC (off-by-one no fuso UTC-3)
    if (!dateString) return ''
    const [year, month, day] = dateString.split('T')[0].split('-')
    if (year && month && day) return `${day}/${month}/${year}`
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    // Parseia manualmente para evitar off-by-one UTC
    const [year, month, day] = (dateString || '').split('T')[0].split('-').map(Number)
    if (!year || !month || !day) return ''
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-800'
      case 'confirmado':
        return 'bg-blue-100 text-blue-800'
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDaysUntil = (dateString: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const plantaoDate = new Date(dateString + 'T00:00:00')
    const diffTime = plantaoDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Amanhã'
    if (diffDays > 1) return `Em ${diffDays} dias`
    return `Há ${Math.abs(diffDays)} dias`
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
          <h1 className="text-xl font-bold text-gray-800">Plantões Futuros</h1>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 hidden md:block">
            <h1 className="text-3xl font-bold text-gray-800">
              Plantões <span className="text-orange-500">Futuros</span>
            </h1>
            <p className="text-gray-600 mt-2">Agenda de plantões a realizar</p>
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
                  <p className="text-sm font-medium text-gray-600">Próximos Plantões</p>
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
                  <p className="text-sm font-medium text-gray-600">Valor Previsto</p>
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

          {/* Tabela de Plantões */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Agenda de Plantões</h3>
            </div>
            
            {filteredPlantoes.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500">Nenhum plantão futuro agendado</p>
                <p className="text-sm text-gray-400 mt-2">Adicione plantões futuros para vê-los aqui</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quando
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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPlantoes.map((plantao) => (
                      <tr key={plantao.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatDate(plantao.data)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDateTime(plantao.data)}
                            </div>
                            <div className="text-xs text-orange-600 font-medium">
                              {getDaysUntil(plantao.data)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{plantao.hospital}</div>
                            {plantao.endereco && (
                              <div className="text-xs text-gray-500">{plantao.endereco}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(plantao.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatHoras(plantao.horas)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(plantao.status)}`}>
                            {plantao.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
