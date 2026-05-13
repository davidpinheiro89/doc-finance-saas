'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import Sidebar from '@/components/Sidebar'

interface Plantao {
  id: string
  hospital: string
  data: string
  valor: number
  status: 'pendente' | 'pago' | 'confirmado'
  horas?: number
  endereco?: string
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
    const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      await fetchPlantoes(user.id)
    } catch (error) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlantoes = async (userId: string) => {
    try {
      console.log('Fetching plantões for user:', userId)
      
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('usuario_id', userId)
        .order('data', { ascending: false })

      if (error) {
        console.error('Supabase error fetching plantões:', error)
        alert('Erro ao buscar plantões: ' + error.message)
        setPlantoes([])
        return
      }

      console.log('Plantões fetched successfully:', data)
      setPlantoes(data || [])
    } catch (error) {
      console.error('Error fetching plantões:', error)
      alert('Erro ao buscar plantões. Tente novamente.')
      setPlantoes([])
    }
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Filter plantões based on date range
  const getFilteredPlantoes = () => {
    if (!dateRange.start && !dateRange.end) {
      return plantoes // Return all if no filter
    }

    return plantoes.filter(plantao => {
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

  // Calculate filtered metrics
  const filteredPlantoes = getFilteredPlantoes()
  
  const filteredMetrics = {
    quantidade: filteredPlantoes.length,
    valorTotal: filteredPlantoes.reduce((sum, p) => sum + (p.valor || 0), 0),
    cargaHoraria: filteredPlantoes.reduce((sum, p) => sum + (p.horas || 0), 0)
  }

  // Calculate workload concentration by unit
  const getWorkloadConcentration = () => {
    if (filteredPlantoes.length === 0) return null
    
    const hoursByUnit = filteredPlantoes.reduce((acc, plantao) => {
      const unit = plantao.hospital
      if (!acc[unit]) {
        acc[unit] = 0
      }
      acc[unit] += plantao.horas || 0
      return acc
    }, {} as Record<string, number>)
    
    const totalHours = Object.values(hoursByUnit).reduce((sum, hours) => sum + hours, 0)
    
    if (totalHours === 0) return null
    
    const concentrationData = Object.entries(hoursByUnit).map(([unit, hours]) => ({
      unit,
      hours,
      percentage: (hours / totalHours) * 100
    })).sort((a, b) => b.percentage - a.percentage)
    
    return concentrationData[0] // Return the unit with highest concentration
  }

  const workloadConcentration = getWorkloadConcentration()
  
  // 1. Volume Chart - Quantidade de Plantões por Unidade (filtered by date range)
  const plantoesByUnit = filteredPlantoes.reduce((acc, plantao) => {
    const unit = plantao.hospital
    if (!acc[unit]) {
      acc[unit] = { quantidade: 0, horas: 0 }
    }
    acc[unit].quantidade += 1
    // Better fallback for missing hours data
    const horas = plantao.horas || 0
    acc[unit].horas += Number(horas) || 0
    return acc
  }, {} as Record<string, { quantidade: number, horas: number }>)

  const volumeChartData = Object.entries(plantoesByUnit).map(([unit, data]) => ({
    unidade: unit,
    quantidade: data.quantidade
  })).sort((a, b) => b.quantidade - a.quantidade)

  // 2. Workload Chart - Total de Horas por Unidade (includes ALL plantões for forecast)
  const allPlantoesByUnit = plantoes.reduce((acc, plantao) => {
    const unit = plantao.hospital
    if (!acc[unit]) {
      acc[unit] = { 
        quantidade: 0, 
        horas: 0,
        horasRealizadas: 0,
        horasFuturas: 0
      }
    }
    acc[unit].quantidade += 1
    const horas = plantao.horas || 0
    acc[unit].horas += Number(horas) || 0
    
    // Separate past and future for visual distinction
    const plantaoDate = new Date(plantao.data)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (plantaoDate < today) {
      acc[unit].horasRealizadas += Number(horas) || 0
    } else {
      acc[unit].horasFuturas += Number(horas) || 0
    }

    // Calculate workload concentration percentage
    const totalHoras = acc[unit].horasRealizadas + acc[unit].horasFuturas
    const workloadPercentage = totalHoras > 0 ? (acc[unit].horasRealizadas / totalHoras) * 100 : 0
    
    return acc
  }, {} as Record<string, { quantidade: number, horas: number, horasRealizadas: number, horasFuturas: number }>)

  const workloadChartData = Object.entries(allPlantoesByUnit)
    .map(([unit, data]) => ({
      unidade: unit,
      horas: Number(data.horas) || 0,
      horasRealizadas: Number(data.horasRealizadas) || 0,
      horasFuturas: Number(data.horasFuturas) || 0
    }))
    .filter(item => item.horas > 0) // Only show units with hours > 0
    .sort((a, b) => b.horas - a.horas)

  // 3. Shift Chart - Diurnos vs Noturnos
  const shiftData = filteredPlantoes.reduce((acc, plantao) => {
    const hour = new Date(plantao.data).getHours()
    const shift = hour >= 6 && hour < 18 ? 'Diurno' : 'Noturno'
    if (!acc[shift]) {
      acc[shift] = 0
    }
    acc[shift] += 1
    return acc
  }, {} as Record<string, number>)

  const shiftChartData = Object.entries(shiftData).map(([shift, count]) => ({
    turno: shift,
    quantidade: count,
    percentage: filteredPlantoes.length > 0 ? (count / filteredPlantoes.length * 100).toFixed(1) : '0'
  }))

  // 4. Timeline - Evolução semanal
  const timelineData = filteredPlantoes.reduce((acc, plantao) => {
    const date = new Date(plantao.data)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]
    
    if (!acc[weekKey]) {
      acc[weekKey] = 0
    }
    acc[weekKey] += 1
    return acc
  }, {} as Record<string, number>)

  const timelineChartData = Object.entries(timelineData)
    .map(([week, count]) => ({
      semana: new Date(week).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
      quantidade: count
    }))
    .sort((a, b) => new Date(a.semana).getTime() - new Date(b.semana).getTime())

  // Colors for charts
  const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa']

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
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
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-800">
                Meu desempenho
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{user?.user_metadata?.full_name || 'Médico'}</span>
                <span className="ml-2 text-xs text-gray-500">{user?.user_metadata?.crm || 'CRM'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pílulas Inteligentes */}
        <div className="flex flex-wrap gap-2 mb-8">
          <div className="bg-orange-100 border border-orange-200 rounded-lg px-4 py-3">
            <div className="flex items-center">
              <div className="bg-orange-500 rounded-full p-2 mr-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2H5a2 2 0 00-2 2v6a2 2 0 002 2h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800">Desempenho Geral</h4>
                <p className="text-2xl font-bold text-orange-600">{filteredMetrics.quantidade}</p>
                <p className="text-sm text-gray-600">Plantões realizados</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-2 mr-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a2 2 0 00-2h-3a2 2 0 00-2 2v6a2 2 0 002 2h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800">Carga Horária</h4>
                <p className="text-2xl font-bold text-blue-600">{filteredMetrics.cargaHoraria.toFixed(1)}h</p>
                <p className="text-sm text-gray-600">Média por plantão</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-full p-2 mr-3">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2-3 2 3 .895 3 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800">Valor Total</h4>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(filteredMetrics.valorTotal)}</p>
                <p className="text-sm text-gray-600">Receita acumulada</p>
              </div>
            </div>
          </div>
        </div>

        {/* Informação Estratégica de Concentração */}
        {workloadConcentration && (
          <div className={`${
            workloadConcentration.percentage >= 70 
              ? 'bg-orange-50 border border-orange-200' 
              : 'bg-blue-50 border border-blue-200'
          } rounded-lg px-4 py-3 mb-8`}>
            <p className={`text-sm font-medium ${
              workloadConcentration.percentage >= 70 
                ? 'text-orange-800' 
                : 'text-blue-800'
            }`}>
              {workloadConcentration.percentage >= 70 ? '⚠️' : 'ℹ️'} Unidade de maior concentração no período: <span className="font-bold">{workloadConcentration.unit}</span> ({workloadConcentration.percentage.toFixed(1)}% da carga horária total).
            </p>
          </div>
        )}

        {/* Eficiência por Hospital */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Eficiência por Hospital</h3>
          {(() => {
            // Group by hospital and sum values
            const hospitalGroups = filteredPlantoes.reduce((acc, plantao) => {
              const hospital = (plantao.hospital || 'Não informado').trim()
              if (!acc[hospital]) {
                acc[hospital] = 0
              }
              acc[hospital] += Number(plantao.valor || 0)
              return acc
            }, {} as Record<string, number>)
            
            // Convert to chart data format
            const chartData = Object.entries(hospitalGroups)
              .map(([hospital, sum]) => ({
                name: hospital.length > 15 ? hospital.substring(0, 15) + '...' : hospital,
                value: parseFloat(String(sum)) || 0
              }))
              .filter(item => item.value > 0)
              .sort((a, b) => b.value - a.value)
            
            console.log('Eficiência por Hospital (Analytics):', chartData)
            
            if (chartData.length === 0) {
              return (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Nenhum plantão registrado neste período</p>
                </div>
              )
            }
            
            return (
              <div style={{ height: '300px', width: '100%', background: '#f97316' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Valor Total']}
                    />
                    <Legend />
                    <Bar 
                      dataKey="value" 
                      fill="#f97316" 
                      name="Valor Total (R$)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
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
      </main>
      </div>
    </div>
  )
}