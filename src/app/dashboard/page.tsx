'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Sidebar from '@/components/Sidebar'

// Shared delete function for both pages
const deletePlantaoEvent = async (id: string, userId: string) => {
  if (!confirm('Tem certeza que deseja apagar este plantão? Esta ação não pode ser desfeita.')) {
    return { success: false }
  }

  try {
    // Force delete with no timezone issues
    const { error } = await supabase
      .from('plantoes')
        .delete()
        .eq('id', id)

    if (error) {
      console.error('Supabase delete error:', error)
      alert('Erro ao apagar plantão: ' + (error as any).message)
      return { success: false, error }
    }

    console.log('Plantão deleted successfully from database - ID:', id)
    
    // Return success without updating state (handled by calling function)
    return { success: true }
  } catch (error) {
    console.error('Error deleting plantão:', error)
    return { success: false, error }
  }
}

interface Plantao {
  id: string
  usuario_id: string
  hospital: string
  data: string
  valor: number
  status: 'pendente' | 'pago' | 'confirmado' | 'realizado'
  horas?: number
  endereco?: string
  cep: string
  data_prevista_pagamento: string
  prazo_pagamento_dias: string
  classificacao: string
  especialidade: string
  tipo_evento?: 'plantao' | 'folga' | 'disponivel'
  local_favorito_id?: string | null
}

interface LocalFavorito {
  id: string
  usuario_id: string
  nome: string
  endereco: string
  valor_hora: number
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plantoes, setPlantoes] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingPlantao, setEditingPlantao] = useState<Plantao | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [locaisFavoritos, setLocaisFavoritos] = useState<any[]>([]) // Add favorite locations state
  const [formData, setFormData] = useState({
    hospital: '',
    data: '',
    valor: '',
    status: 'pendente' as 'pendente' | 'pago' | 'confirmado' | 'realizado',
    horas: '',
    endereco: '',
    cep: '',
    data_prevista_pagamento: '',
    prazo_pagamento_dias: '',
    classificacao: '',
    especialidade: '',
    local_favorito_id: null as string | null // Add favorite location field as optional
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

      // Filter out 'Folga' entries and apply automatic status logic for past plantões
      const processedData = (data || []).map((plantao: Plantao) => {
        // Keep data as pure string, no Date object conversion
        const plantaoDate = new Date(plantao.data + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // If plantão date is in the past and status is still 'pendente', change to 'realizado'
        if (plantaoDate < today && plantao.status === 'pendente') {
          return { ...plantao, status: 'realizado' }
        }
        
        return plantao
      })
      
      setPlantoes(processedData)
      
      // Fetch favorite locations
      await fetchLocaisFavoritos(userId)
    } catch (error) {
      console.error('Error fetching plantões:', error)
      alert('Erro ao buscar plantões. Tente novamente.')
      setPlantoes([])
    }
  }

  const fetchLocaisFavoritos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('locais_favoritos')
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching favorite locations:', error)
        setLocaisFavoritos([])
        return
      }

      setLocaisFavoritos(data || [])
    } catch (error) {
      console.error('Error fetching favorite locations:', error)
      setLocaisFavoritos([])
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLocationId = e.target.value
    const selectedLocation = locaisFavoritos.find(local => local.id === selectedLocationId)
    
    if (selectedLocation) {
      setFormData(prev => ({
        ...prev,
        local_favorito_id: selectedLocationId,
        hospital: selectedLocation.nome,
        endereco: selectedLocation.endereco || ''
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        local_favorito_id: '',
        hospital: '',
        endereco: ''
      }))
    }
  }

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveAsFavorite = async () => {
    if (!formData.hospital || !formData.endereco) {
      alert('Para salvar como favorito, preencha primeiro o Hospital/Local e Endereço.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('locais_favoritos')
        .insert({
          usuario_id: user.id,
          nome: `${formData.hospital} - ${formData.endereco}`,
          endereco: formData.endereco,
          valor_hora: parseFloat(formData.valor) || 0
        })

      if (error) {
        console.error('Error saving favorite location:', error)
        alert('Erro ao salvar local favorito. Tente novamente.')
        return
      }

      alert('Local salvo como favorito com sucesso!')
      
      // Update form to include the new favorite location
      if (data && data[0]) {
        setFormData(prev => ({
          ...prev,
          local_favorito_id: (data as any)?.[0]?.id || ''
        }))
        
        // Clear favorite location field
        setFormData(prev => ({
          ...prev,
          hospital: '',
          endereco: ''
        }))
      }
      
      // Refresh favorites list
      await fetchLocaisFavoritos(user.id)
    } catch (error) {
      console.error('Error saving favorite location:', error)
      alert('Erro ao salvar local favorito. Tente novamente.')
    }
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
      
      if (startDate && plantaoDate < startDate) return false
      if (endDate && plantaoDate > endDate) return false
      
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

  // Prepare data for bar chart (plantões by unit)
  const plantoesByUnit = filteredPlantoes.reduce((acc, plantao) => {
    const unit = plantao.hospital
    if (!acc[unit]) {
      acc[unit] = 0
    }
    acc[unit] += 1
    return acc
  }, {} as Record<string, number>)

  const chartData = Object.entries(plantoesByUnit).map(([unit, count]) => ({
    unidade: unit,
    quantidade: (count as number) || 0
  })).sort((a, b) => b.quantidade - a.quantidade)

  // Prepare data for hours distribution chart
  const hoursByUnit = filteredPlantoes.reduce((acc, plantao) => {
    const unit = plantao.hospital
    if (!acc[unit]) {
      acc[unit] = 0
    }
    acc[unit] += (plantao.horas as number || 0)
    return acc
  }, {} as Record<string, number>)

  const hoursChartData = Object.entries(hoursByUnit).map(([unit, hours]) => ({
    unidade: unit,
    horas: (hours as number) || 0
  })).sort((a, b) => b.horas - a.horas)

  const COLORS = ['#f97316', '#ea580c', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#22c55e']

  const handleCepLookup = async () => {
    const cep = formData.cep.replace(/\D/g, '') // Remove non-digits
    
    if (cep.length !== 8) {
      alert('CEP inválido. Digite 8 dígitos.')
      return
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()

      if (data.erro) {
        alert('CEP não encontrado.')
        return
      }

      // Update form with address data
      const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
      setFormData(prev => ({
        ...prev,
        endereco: fullAddress
      }))
    } catch (error) {
      console.error('Error looking up CEP:', error)
      alert('Erro ao buscar CEP. Tente novamente.')
    }
  }

  const refreshConnection = async () => {
    try {
      // Force connection refresh by checking auth status
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Connection refresh error:', error)
        return false
      }
      console.log('Connection refreshed successfully')
      return true
    } catch (error) {
      console.error('Error refreshing connection:', error)
      return false
    }
  }

  const handleDeletePlantao = async (id: string) => {
    if (!confirm('Tem certeza que deseja apagar este plantão? Esta ação não pode ser desfeita.')) {
      return
    }

    setDeletingId(id)

    try {
      const { success, error } = await deletePlantaoEvent(id, user.id)

      if (error) {
        console.error('Supabase delete error:', error)
        alert('Erro ao apagar plantão: ' + (error as any).message)
        return
      }

      // Update local state immediately for visual feedback - NO AUTO FETCH
      setPlantoes(prev => {
        const updated = prev.filter(p => p.id !== id)
        return updated
      })
      
      // Force router refresh to clear any cache
      router.refresh()
      
      alert('Plantão apagado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao apagar:', error.message || error)
      alert('Erro ao apagar plantão. Tente novamente.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditPlantao = (plantao: Plantao) => {
    setEditingPlantao(plantao)
    setFormData({
      hospital: plantao.hospital,
      data: plantao.data,
      valor: plantao.valor.toString(),
      status: plantao.status,
      horas: plantao.horas?.toString() || '',
      endereco: plantao.endereco || '',
      cep: plantao.cep || '',
      data_prevista_pagamento: plantao.data_prevista_pagamento || '',
      prazo_pagamento_dias: plantao.prazo_pagamento_dias?.toString() || '',
      classificacao: plantao.classificacao || '',
      especialidade: plantao.especialidade || '',
      local_favorito_id: plantao.local_favorito_id || null
    })
    setShowModal(true)
  }

  const handleSavePlantao = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Validate required fields
      if (!formData.hospital || !formData.data || !formData.valor || !user.id) {
        console.error('Missing required fields:', { hospital: formData.hospital, data: formData.data, valor: formData.valor, userId: user.id })
        alert('Preencha todos os campos obrigatórios.')
        return
      }

      // Refresh connection before saving
      const connectionOk = await refreshConnection()
      if (!connectionOk) {
        alert('Erro de conexão. Tente novamente.')
        return
      }

      // Implement date automation logic
      const selectedDate = new Date(formData.data)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Set to midnight for accurate comparison
      
      // Auto-determine status based on date comparison
      let autoStatus = formData.status
      if (selectedDate < today) {
        autoStatus = 'realizado'
      } else if (selectedDate >= today) {
        autoStatus = 'pendente'
      }

      let plantaoData: any = {
        usuario_id: user.id,
        hospital: formData.hospital.trim(),
        data: formData.data,
        valor: parseFloat(formData.valor),
        status: autoStatus,
        horas: formData.horas ? parseFloat(formData.horas) : 0,
        endereco: formData.endereco?.trim() || null,
        data_prevista_pagamento: formData.data_prevista_pagamento || null,
        prazo_pagamento_dias: formData.prazo_pagamento_dias ? parseInt(formData.prazo_pagamento_dias) : null,
        classificacao: formData.classificacao || null,
        especialidade: formData.especialidade || null
      }

      let result

      if (editingPlantao) {
        // Update existing plantão
        console.log('Updating plantão:', editingPlantao.id, plantaoData)
        result = await supabase
          .from('plantoes')
          .update(plantaoData)
          .eq('id', editingPlantao.id)
          .select()
      } else {
        // Create new plantão
        plantaoData.created_at = new Date().toISOString()
        console.log('Saving plantão to table "plantoes":', plantaoData)
        result = await supabase
          .from('plantoes')
          .insert([plantaoData])
          .select()
      }

      const { data, error } = result

      if (error) {
        console.error('Supabase error saving plantão:', error)
        if (error.code === 'PGRST116') {
          alert('Tabela "plantoes" não encontrada. Verifique se a tabela foi criada corretamente no Supabase.')
        } else {
          alert('Erro ao salvar plantão: ' + error.message)
        }
        return
      }

      console.log('Plantão saved successfully:', data)

      // Refresh plantões list
      await fetchPlantoes(user.id)
      
      // Close modal and reset form
      setShowModal(false)
      setEditingPlantao(null)
      setFormData({
        hospital: '',
        data: '',
        valor: '',
        status: 'pendente',
        horas: '',
        endereco: '',
        cep: '',
        data_prevista_pagamento: '',
        prazo_pagamento_dias: '',
        classificacao: '',
        especialidade: '',
        local_favorito_id: null
      })

      // Show success message with auto-determined status
      const statusMessage = autoStatus === 'realizado' ? 'realizado' : 'planejado'
      alert(editingPlantao ? 'Plantão atualizado com sucesso!' : `Plantão ${statusMessage} salvo com sucesso!`)
      
      // Redirect to analytics page to show updated dashboard
      if (!editingPlantao && autoStatus === 'realizado') {
        // For new realized plantões, redirect to analytics to see immediate impact
        setTimeout(() => {
          router.push('/analytics')
        }, 1000)
      }
    } catch (error) {
      console.error('Error saving plantão:', error)
      alert('Erro ao salvar plantão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // Consistent date formatting - no timezone issues
    const date = new Date(dateString + 'T00:00:00')
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    
    return `${day}/${month}/${year}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-800'
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800'
      case 'confirmado':
        return 'bg-blue-100 text-blue-800'
      case 'realizado':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Filter plantões by date
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Set to start of day for accurate comparison

  const upcomingPlantoes = plantoes.filter(plantao => {
    const plantaoDate = new Date(plantao.data)
    plantaoDate.setHours(0, 0, 0, 0)
    return plantaoDate >= today
  }).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

  const historicalPlantoes = plantoes.filter(plantao => {
    const plantaoDate = new Date(plantao.data)
    plantaoDate.setHours(0, 0, 0, 0)
    return plantaoDate < today
  }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  // Calculate management metrics
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  
  const plantoesEsteMes = plantoes.filter(plantao => {
    const plantaoDate = new Date(plantao.data)
    return plantaoDate.getMonth() === currentMonth && plantaoDate.getFullYear() === currentYear
  }).length

  const pendentesPagamento = plantoes.filter(plantao => 
    plantao.status === 'pendente' || plantao.status === 'confirmado'
  ).length

  // Calculate net profit (placeholder tax rate - will be configurable later)
  const TAX_RATE = 0.25 // 25% for taxes and costs (configurable later)
  const totalRealizado = plantoes
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0)
  const estimatedTaxCosts = totalRealizado * TAX_RATE
  const lucroLiquidoEstimado = totalRealizado - estimatedTaxCosts

  // Calculate metrics from real data
  const totalGanho = plantoes
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0)

  const horasTotais = plantoes
    .filter(p => p.horas)
    .reduce((sum, p) => sum + (p.horas || 0), 0)

  const plantoesRealizados = plantoes.filter(p => p.status === 'pago').length

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
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-800">
                Início
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
        {/* Intelligent Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Efficiency Calculation Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Eficiência por Hospital</h3>
              <div className="bg-blue-100 rounded-full p-2">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              {(() => {
                // Calculate efficiency by hospital
                const hospitalEfficiency = plantoes
                  .filter((p: any) => p.status === 'pago' && p.horas && p.horas > 0)
                  .reduce((acc: any, plantao: any) => {
                    const hospital = plantao.hospital
                    const hourlyRate = plantao.valor / plantao.horas
                    
                    if (!acc[hospital]) {
                      acc[hospital] = {
                        totalValue: 0,
                        totalHours: 0,
                        hourlyRate: 0,
                        count: 0
                      }
                    }
                    
                    acc[hospital].totalValue += plantao.valor
                    acc[hospital].totalHours += plantao.horas
                    acc[hospital].count += 1
                    acc[hospital].hourlyRate = acc[hospital].totalValue / acc[hospital].totalHours
                    
                    return acc
                  }, {} as Record<string, { totalValue: number; totalHours: number; hourlyRate: number; count: number }>)

                const sortedHospitals = Object.entries(hospitalEfficiency)
                  .sort(([,a]: any, [,b]: any) => b.hourlyRate - a.hourlyRate)
                  .slice(0, 3)

                // Check for 70% concentration
                const concentrationAlert = Object.entries(hospitalEfficiency).find(([, data]: any) => {
                  const totalHours = Object.values(hospitalEfficiency).reduce((sum: number, [, hospitalData]: any) => sum + hospitalData.totalHours, 0)
                  const concentrationPercentage = (data.totalHours / totalHours) * 100
                  return concentrationPercentage >= 70
                })

                if (sortedHospitals.length === 0) {
                  return (
                    <p className="text-gray-600 text-sm">
                      Nenhum dado suficiente para calcular eficiência. Adicione plantões com horas registradas.
                    </p>
                  )
                }

                // Display concentration alert if found
                if (concentrationAlert) {
                  return (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                      <p className="text-orange-700 font-medium text-sm">
                        ⚠️ Atenção: 70% da sua carga horária está concentrada no {concentrationAlert[0]}.
                      </p>
                      <p className="text-orange-600 text-xs mt-1">
                        Considere diversificar suas unidades de trabalho para melhor distribuição.
                      </p>
                    </div>
                  )
                }

                return sortedHospitals.map(([hospital, data]: any, index: number) => (
                  <div key={hospital} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-green-500' : index === 1 ? 'bg-blue-500' : 'bg-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{hospital}</p>
                        <p className="text-xs text-gray-500">{data.count} plantões</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{formatCurrency(data.hourlyRate)}/h</p>
                        <p className="text-xs text-gray-500">R$/h</p>
                      <p className="text-xs text-gray-500">{data.totalHours}h totais</p>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Workload Monitoring Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Monitor de Carga Horária</h3>
              <div className="bg-blue-100 rounded-full p-2">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              {(() => {
                const today = new Date()
                const currentMonth = today.getMonth()
                const currentYear = today.getFullYear()
                
                // Calculate monthly hours
                const monthlyHours = plantoes
                  .filter((p: any) => {
                    const plantaoDate = new Date(p.data)
                    return plantaoDate.getMonth() === currentMonth && 
                           plantaoDate.getFullYear() === currentYear &&
                           p.horas && p.horas > 0
                  })
                  .reduce((sum: number, p: any) => sum + (p.horas || 0), 0)

                // Calculate weekly hours (last 7 days)
                const sevenDaysAgo = new Date(today)
                sevenDaysAgo.setDate(today.getDate() - 7)
                sevenDaysAgo.setHours(0, 0, 0, 0)

                const weeklyHours = plantoes
                  .filter((p: any) => {
                    const plantaoDate = new Date(p.data)
                    return plantaoDate >= sevenDaysAgo && 
                           plantaoDate <= today &&
                           p.horas && p.horas > 0
                  })
                  .reduce((sum: number, p: any) => sum + (p.horas || 0), 0)

                const healthWarning = weeklyHours > 60

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600">Horas Mensais</p>
                        <p className={`text-xl font-bold ${monthlyHours > 160 ? 'text-red-600' : 'text-gray-800'}`}>
                          {monthlyHours.toFixed(1)}h
                        </p>
                        <p className="text-xs text-gray-500">
                          {monthlyHours > 160 ? '⚠️ Acima da média' : 'Dentro do esperado'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-sm text-gray-600">Horas Semanais</p>
                        <p className={`text-xl font-bold ${healthWarning ? 'text-red-600' : 'text-gray-800'}`}>
                          {weeklyHours.toFixed(1)}h / 60h
                        </p>
                        <p className="text-xs text-gray-500">
                          {healthWarning ? '⚠️ Cuidado com a Saúde' : 'Carga segura'}
                        </p>
                      </div>
                    </div>
                    
                    {healthWarning && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-red-700 font-medium text-sm">
                          ⚠️ Cuidado com a Saúde
                        </p>
                        <p className="text-red-600 text-xs mt-1">
                          Sua carga horária semanal de {weeklyHours.toFixed(1)}h excede o recomendado de 60h. 
                          Considere descansar para manter sua saúde e bem-estar.
                        </p>
                      </div>
                    )}
                    
                    {!healthWarning && weeklyHours > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-green-700 font-medium text-sm">
                          ✅ Carga Horária Saudável
                        </p>
                        <p className="text-green-600 text-xs mt-1">
                          Sua carga horária semanal está dentro dos limites recomendados para uma boa saúde.
                        </p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
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
          {/* Plantões no Período */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Plantões no Período</p>
                <p className="text-3xl font-bold text-orange-500 mt-2">
                  {filteredMetrics.quantidade}
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Valor Total (R$) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total (R$)</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency(filteredMetrics.valorTotal)}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Carga Horária Total (Hrs) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Carga Horária Total (Hrs)</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {horasTotais.toFixed(1)}
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

        {/* Próximos Plantões (A Realizar) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Próximos Plantões</h2>
              <p className="text-sm text-gray-600 mt-1">Plantões agendados para datas futuras</p>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              + Novo Plantão
            </button>
          </div>

          {upcomingPlantoes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">Nenhum plantão agendado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Hospital/Local
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {upcomingPlantoes.map((plantao) => (
                    <tr key={plantao.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-semibold text-orange-600">
                          {formatDate(plantao.data)}
                        </div>
                        {plantao.horas && (
                          <div className="text-xs text-gray-500">{plantao.horas}h</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <button
                            onClick={() => {
                              const query = plantao.endereco || plantao.hospital
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
                              window.open(mapsUrl, '_blank')
                            }}
                            className="text-gray-900 hover:text-orange-500 font-medium underline underline-offset-2 hover:underline-offset-4 transition-all duration-200"
                          >
                            {plantao.hospital}
                          </button>
                        </div>
                        {plantao.endereco && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                            {plantao.endereco}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(plantao.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(plantao.status)}`}>
                          {plantao.status.charAt(0).toUpperCase() + plantao.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEditPlantao(plantao)}
                            className="text-orange-500 hover:text-orange-600 p-1 rounded hover:bg-orange-50 transition-colors duration-200"
                            title="Editar plantão"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeletePlantao(plantao.id)}
                            disabled={deletingId === plantao.id}
                            className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Apagar plantão"
                          >
                            {deletingId === plantao.id ? (
                              <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Histórico (Realizados) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Histórico</h2>
              <p className="text-sm text-gray-600 mt-1">Plantões já realizados</p>
            </div>
          </div>

          {historicalPlantoes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500">Nenhum plantão realizado ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Hospital/Local
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historicalPlantoes.map((plantao) => (
                    <tr key={plantao.id} className="hover:bg-gray-50 opacity-75">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{formatDate(plantao.data)}</div>
                        {plantao.horas && (
                          <div className="text-xs text-gray-400">{plantao.horas}h</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <button
                            onClick={() => {
                              const query = plantao.endereco || plantao.hospital
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
                              window.open(mapsUrl, '_blank')
                            }}
                            className="text-gray-700 hover:text-orange-500 font-medium underline underline-offset-2 hover:underline-offset-4 transition-all duration-200"
                          >
                            {plantao.hospital}
                          </button>
                        </div>
                        {plantao.endereco && (
                          <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                            {plantao.endereco}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {formatCurrency(plantao.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(plantao.status)}`}>
                          {plantao.status.charAt(0).toUpperCase() + plantao.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEditPlantao(plantao)}
                            className="text-orange-500 hover:text-orange-600 p-1 rounded hover:bg-orange-50 transition-colors duration-200"
                            title="Editar plantão"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeletePlantao(plantao.id)}
                            disabled={deletingId === plantao.id}
                            className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Apagar plantão"
                          >
                            {deletingId === plantao.id ? (
                              <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingPlantao ? 'Editar Plantão' : 'Novo Plantão'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingPlantao(null)
                  setFormData({
                    hospital: '',
                    data: '',
                    valor: '',
                    status: 'pendente',
                    horas: '',
                    endereco: '',
                    cep: '',
                    data_prevista_pagamento: '',
                    prazo_pagamento_dias: '',
                    classificacao: '',
                    especialidade: '',
                    local_favorito_id: null
                  })
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSavePlantao} className="space-y-4">
              {/* Hospital/Local */}
              <div>
                <label htmlFor="hospital" className="block text-sm font-medium text-gray-700 mb-2">
                  Hospital/Local
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="hospital"
                    name="hospital"
                    value={formData.hospital}
                    onChange={handleInputChange}
                    className="flex-1 block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Nome do hospital"
                    required
                  />
                  <select
                    id="local_favorito_id"
                    name="local_favorito_id"
                    value={formData.local_favorito_id || ''}
                    onChange={handleLocationChange}
                    className="flex-1 block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Selecionar Local Salvo</option>
                    {locaisFavoritos.map((local) => (
                      <option key={local.id} value={local.id}>
                        {local.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data */}
              <div>
                <label htmlFor="data" className="block text-sm font-medium text-gray-700 mb-2">
                  Data do Plantão
                </label>
                <input
                  type="date"
                  id="data"
                  name="data"
                  value={formData.data}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Valor */}
              <div>
                <label htmlFor="valor" className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  id="valor"
                  name="valor"
                  value={formData.valor}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              
              {/* CEP */}
              <div>
                <label htmlFor="cep" className="block text-sm font-medium text-gray-700 mb-2">
                  CEP
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="cep"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    maxLength={9}
                    className="flex-1 block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="00000-000"
                  />
                  <button
                    type="button"
                    onClick={handleCepLookup}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {/* Duração (Horas) */}
              <div>
                <label htmlFor="horas" className="block text-sm font-medium text-gray-700 mb-2">
                  Duração (Horas)
                </label>
                <input
                  type="number"
                  id="horas"
                  name="horas"
                  value={formData.horas}
                  onChange={handleInputChange}
                  step="0.5"
                  min="0"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="12"
                />
              </div>

              {/* Classificação/Setor */}
              <div>
                <label htmlFor="classificacao" className="block text-sm font-medium text-gray-700 mb-2">
                  Classificação/Setor
                </label>
                <select
                  id="classificacao"
                  name="classificacao"
                  value={formData.classificacao}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="Sala Verde">Sala Verde</option>
                  <option value="Sala Amarela">Sala Amarela</option>
                  <option value="Sala Vermelha">Sala Vermelha</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Especialidade */}
              <div>
                <label htmlFor="especialidade" className="block text-sm font-medium text-gray-700 mb-2">
                  Especialidade
                </label>
                <select
                  id="especialidade"
                  name="especialidade"
                  value={formData.especialidade}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="Clínica Médica">Clínica Médica</option>
                  <option value="Pediatria">Pediatria</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Prazo de Pagamento */}
              <div>
                <label htmlFor="prazo_pagamento_dias" className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo de Pagamento (dias)
                </label>
                <input
                  type="number"
                  id="prazo_pagamento_dias"
                  name="prazo_pagamento_dias"
                  value={formData.prazo_pagamento_dias}
                  onChange={handleInputChange}
                  min="1"
                  max="365"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">Dias após a data do plantão para pagamento</p>
              </div>

              {/* Endereço */}
              <div>
                <label htmlFor="endereco" className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  id="endereco"
                  name="endereco"
                  value={formData.endereco || ''}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Endereço completo"
                />
              </div>

              {/* Actions */}
              <div className="flex space-x-2 mt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {editingPlantao ? 'Atualizar Plantão' : 'Cadastrar Plantão'}
                </button>
                {formData.hospital && !formData.local_favorito_id && (
                  <button
                    type="button"
                    onClick={handleSaveAsFavorite}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Salvar como Favorito
                  </button>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : (editingPlantao ? 'Atualizar Plantão' : 'Salvar Plantão')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
