'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { SkeletonMetricCard, SkeletonTableRows } from '@/components/Skeleton'
import type { Plantao, LocalFavorito } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPlantoesByUser,
  fetchPlantoesByUserRange,
  applyAutoRealizadoStatus,
  plantoesKeys,
  type PlantaoListItem,
} from '@/lib/queries/plantoes'

// Shared delete function for both pages
const deletePlantaoEvent = async (id: string, userId: string) => {
  if (!confirm('Tem certeza que deseja apagar este plantão? Esta ação não pode ser desfeita.')) {
    return { success: false }
  }

  try {
    // Force delete with no timezone issues and user_id filter
    const { error } = await supabase
      .from('plantoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

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

export default function DashboardPage() {
  const { user, loading } = useAuthGuard()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingPlantao, setEditingPlantao] = useState<PlantaoListItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveAsFavorite, setSaveAsFavorite] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [locaisFavoritos, setLocaisFavoritos] = useState<any[]>([])
  const [monthlyFilter, setMonthlyFilter] = useState<'current' | 'previous'>('current')

  // --- TanStack Query: lista principal de plantões do usuário ---
  const { data: plantoes = [], isPending: isPlantoesPending, error: plantoesError } = useQuery<PlantaoListItem[]>({
    queryKey: user ? plantoesKeys.byUser(user.id) : ['plantoes', 'anon'],
    queryFn: () => fetchPlantoesByUser(user!.id),
    enabled: !!user,
    // Aplica regra de negócio (data passada + pendente → realizado) sem
    // alterar o cache subjacente.
    select: applyAutoRealizadoStatus,
  })

  // Log erros do useQuery (TanStack Query v5 não suporta onError nas opções)
  if (plantoesError) {
    console.error('Erro ao buscar plantões:', plantoesError)
  }

  // Mostra skeletons enquanto: (a) auth não terminou OU (b) primeira busca
  // de plantões está em andamento. Após carga inicial, refetches em
  // background não disparam skeleton (fica responsivo).
  const isInitialLoading = loading || (!!user && isPlantoesPending)

  // --- TanStack Query: plantões do mês anterior (para comparação) ---
  const previousMonthRange = useMemo(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    }
  }, [])

  const { data: previousMonthData = [], isFetching: isComparing } = useQuery({
    queryKey: user
      ? plantoesKeys.byUserRange(user.id, previousMonthRange.start, previousMonthRange.end)
      : ['plantoes', 'anon-range'],
    queryFn: () => fetchPlantoesByUserRange(user!.id, previousMonthRange.start, previousMonthRange.end),
    enabled: !!user,
  })

  const invalidatePlantoes = () => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: plantoesKeys.byUser(user.id) })
    }
  }
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

  // Carrega lugares favoritos sempre que o user mudar (não-cacheado por
  // ora; pode ser migrado para useQuery quando necessário).
  useEffect(() => {
    if (user) fetchLocaisFavoritos(user.id)
  }, [user])

  const fetchLocaisFavoritos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('locais_favoritos')
        .select('*')
        .eq('user_id', userId)
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

  // Function to calculate previous month date range
  const getPreviousMonthRange = () => {
    const now = new Date()
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    
    return {
      start: previousMonth.toISOString().split('T')[0],
      end: lastDayOfPreviousMonth.toISOString().split('T')[0]
    }
  }

  // Function to get current month date range
  const getCurrentMonthRange = () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    return {
      start: firstDayOfMonth.toISOString().split('T')[0],
      end: lastDayOfMonth.toISOString().split('T')[0]
    }
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
          user_id: user!.id,
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
      await fetchLocaisFavoritos(user!.id)
    } catch (error) {
      console.error('Error saving favorite location:', error)
      alert('Erro ao salvar local favorito. Tente novamente.')
    }
  }

  // Filter plantões based on date range and monthly filter - normaliza datas para evitar problemas de fuso horário
  const getListagemPlantoes = () => {
    let dataToFilter: PlantaoListItem[] = plantoes

    // Apply monthly filter
    if (monthlyFilter === 'current') {
      const { start, end } = getCurrentMonthRange()
      dataToFilter = plantoes.filter((plantao: PlantaoListItem) => {
        if (!plantao.data) return false
        const plantaoDate = new Date(plantao.data + 'T00:00:00')
        if (isNaN(plantaoDate.getTime())) return false
        return plantaoDate >= new Date(start + 'T00:00:00') && plantaoDate <= new Date(end + 'T00:00:00')
      })
    } else if (monthlyFilter === 'previous') {
      const { start, end } = getPreviousMonthRange()
      dataToFilter = previousMonthData.filter((plantao: PlantaoListItem) => {
        if (!plantao.data) return false
        const plantaoDate = new Date(plantao.data + 'T00:00:00')
        if (isNaN(plantaoDate.getTime())) return false
        return plantaoDate >= new Date(start + 'T00:00:00') && plantaoDate <= new Date(end + 'T00:00:00')
      })
    }

    // Apply custom date range filter if set
    if (dateRange.start || dateRange.end) {
      return dataToFilter.filter((plantao: PlantaoListItem) => {
        if (!plantao.data) return false
        const plantaoDate = new Date(plantao.data + 'T00:00:00')
        if (isNaN(plantaoDate.getTime())) return false
        const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null
        const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : null

        if (startDate && plantaoDate < startDate) return false
        if (endDate && plantaoDate > endDate) return false

        return true
      })
    }

    return dataToFilter
  }

  // Calculate filtered metrics
  const listagemPlantoes = getListagemPlantoes()

  const filteredMetrics = {
    quantidade: listagemPlantoes.length,
    valorTotal: listagemPlantoes.reduce((sum: number, p: PlantaoListItem) => sum + (p.valor || 0), 0),
    cargaHoraria: listagemPlantoes.reduce((sum: number, p: PlantaoListItem) => sum + (p.horas || 0), 0)
  }

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
      const { success, error } = await deletePlantaoEvent(id, user!.id)

      if (error) {
        console.error('Supabase delete error:', error)
        alert('Erro ao apagar plantão: ' + (error as any).message)
        return
      }

      // Optimistic delete diretamente no cache do TanStack Query
      if (user) {
        queryClient.setQueryData<PlantaoListItem[]>(plantoesKeys.byUser(user.id), (old) =>
          (old ?? []).filter((p) => p.id !== id),
        )
      }
      
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

  const handleEditPlantao = (plantao: PlantaoListItem) => {
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
      if (!formData.hospital || !formData.data || !formData.valor || !user!.id) {
        console.error('Missing required fields:', { hospital: formData.hospital, data: formData.data, valor: formData.valor, userId: user!.id })
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
        user_id: user!.id,
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
          .eq('user_id', user!.id)
          .select()
      } else {
        // Create new plantão
        plantaoData.created_at = new Date().toISOString()
        plantaoData.user_id = user!.id
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

      // Salvar como favorito se o checkbox estiver marcado
      if (saveAsFavorite && formData.hospital && !formData.local_favorito_id) {
        try {
          await supabase.from('locais_favoritos').insert({
            user_id: user!.id,
            nome: formData.hospital,
            endereco: formData.endereco || '',
            valor_hora: parseFloat(formData.valor) || 0,
          })
          await fetchLocaisFavoritos(user!.id)
        } catch (favErr) {
          console.error('Erro ao salvar favorito:', favErr)
        }
      }

      // Refresh plantões list
      invalidatePlantoes()

      // Close modal and reset form
      setSaveAsFavorite(false)
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

  // Filter plantões by date — comparação por string YYYY-MM-DD evita 100% dos
  // problemas de fuso horário (plantao.data já vem nesse formato do Supabase).
  // Calcula a data local de hoje (America/Sao_Paulo é UTC-3, sem horário de verão).
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const todayPlantoes = plantoes.filter((plantao: PlantaoListItem) => {
    if (!plantao.data) return false
    return plantao.data === todayStr
  }).sort((a: PlantaoListItem, b: PlantaoListItem) => (a.hospital || '').localeCompare(b.hospital || ''))

  const upcomingPlantoes = plantoes.filter((plantao: PlantaoListItem) => {
    if (!plantao.data) return false
    return plantao.data > todayStr
  }).sort((a: PlantaoListItem, b: PlantaoListItem) => a.data.localeCompare(b.data))

  const historicalPlantoes = plantoes.filter((plantao: PlantaoListItem) => {
    if (!plantao.data) return false
    return plantao.data < todayStr
  }).sort((a: PlantaoListItem, b: PlantaoListItem) => b.data.localeCompare(a.data))

  // Calculate management metrics - normaliza datas para evitar problemas de fuso horário
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const plantoesEsteMes = plantoes.filter((plantao: PlantaoListItem) => {
    if (!plantao.data) return false
    const plantaoDate = new Date(plantao.data + 'T00:00:00')
    if (isNaN(plantaoDate.getTime())) return false
    return plantaoDate.getMonth() === currentMonth && plantaoDate.getFullYear() === currentYear
  }).length

  const pendentesPagamento = plantoes.filter((plantao: PlantaoListItem) =>
    plantao.status === 'pendente' || plantao.status === 'confirmado'
  ).length

  // Calculate net profit (placeholder tax rate - will be configurable later)
  const TAX_RATE = 0.25 // 25% for taxes and costs (configurable later)
  const totalRealizado = plantoes
    .filter((p: PlantaoListItem) => p.status === 'pago')
    .reduce((sum: number, p: PlantaoListItem) => sum + (p.valor || 0), 0)
  const estimatedTaxCosts = totalRealizado * TAX_RATE
  const lucroLiquidoEstimado = totalRealizado - estimatedTaxCosts

  // Calculate metrics from real data
  const totalGanho = plantoes
    .filter((p: PlantaoListItem) => p.status === 'pago')
    .reduce((sum: number, p: PlantaoListItem) => sum + (p.valor || 0), 0)

  const horasTotais = plantoes
    .filter((p: PlantaoListItem) => p.horas)
    .reduce((sum: number, p: PlantaoListItem) => sum + (p.horas || 0), 0)

  const plantoesRealizados = plantoes.filter((p: PlantaoListItem) => p.status === 'pago').length

  // Debug: Log filtered data - REMOVED TO PREVENT INFINITE LOOP
  // console.log('Dados do gráfico:', listagemPlantoes)

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
    <div className="flex h-screen bg-gray-50 w-full overflow-x-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto w-full relative z-10">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              {/* Mobile Menu Button */}
              <button
                onClick={() => {
                  const sidebar = document.querySelector('[data-sidebar-mobile]')
                  if (sidebar) {
                    sidebar.classList.toggle('-translate-x-full')
                  }
                }}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="h-6 w-6">☰</span>
              </button>
              <h1 className="text-3xl font-bold text-gray-800 ml-2">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Intelligent Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                  .filter((p: PlantaoListItem) => {
                    if (!p.data) return false
                    const plantaoDate = new Date(p.data + 'T00:00:00')
                    if (isNaN(plantaoDate.getTime())) return false
                    return plantaoDate.getMonth() === currentMonth &&
                           plantaoDate.getFullYear() === currentYear &&
                           p.horas && p.horas > 0
                  })
                  .reduce((sum: number, p: PlantaoListItem) => sum + (p.horas || 0), 0)

                // Calculate weekly hours (last 7 days)
                const sevenDaysAgo = new Date(today)
                sevenDaysAgo.setDate(today.getDate() - 7)
                sevenDaysAgo.setHours(0, 0, 0, 0)

                const weeklyHours = plantoes
                  .filter((p: PlantaoListItem) => {
                    if (!p.data) return false
                    const plantaoDate = new Date(p.data + 'T00:00:00')
                    if (isNaN(plantaoDate.getTime())) return false
                    return plantaoDate >= sevenDaysAgo &&
                           plantaoDate <= today &&
                           p.horas && p.horas > 0
                  })
                  .reduce((sum: number, p: PlantaoListItem) => sum + (p.horas || 0), 0)

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
          {isPlantoesPending ? (
            <>
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
            </>
          ) : (
            <>
              {/* Plantões no Período */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
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
              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
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
              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
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
            </>
          )}
        </div>

        {/* Plantões de Hoje — destaque (só aparece se houver plantões para hoje) */}
        {!isPlantoesPending && todayPlantoes.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500 rounded-full p-2">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Plantões de Hoje</h2>
                <p className="text-sm text-gray-600">{todayPlantoes.length} plantão(ões) agendado(s) para hoje</p>
              </div>
            </div>
            <div className="space-y-2">
              {todayPlantoes.map((plantao) => (
                <div key={plantao.id} className="bg-white rounded-lg p-4 flex items-center justify-between border border-orange-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{plantao.hospital}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {plantao.horas ? `${plantao.horas}h` : ''}
                      {plantao.especialidade ? ` · ${plantao.especialidade}` : ''}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-green-600">{formatCurrency(plantao.valor || 0)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusColor(plantao.status)}`}>
                      {plantao.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

          {isPlantoesPending ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody>
                  <SkeletonTableRows rows={4} cols={6} />
                </tbody>
              </table>
            </div>
          ) : upcomingPlantoes.length === 0 ? (
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
                      Hospital
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Horas
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(plantao.horas || 0)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(plantao.status)}`}>
                          {plantao.status.charAt(0).toUpperCase() + plantao.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditPlantao(plantao)}
                            className="text-orange-500 hover:text-orange-600 p-1 rounded hover:bg-orange-50 transition-colors duration-200"
                            title="Editar plantão"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePlantao(plantao.id)}
                            disabled={deletingId === plantao.id}
                            className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir plantão"
                          >
                            {deletingId === plantao.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b border-red-500"></div>
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
                {/* Seletor de local salvo aparece somente se houver favoritos cadastrados */}
                {locaisFavoritos.length > 0 && (
                  <select
                    id="local_favorito_id"
                    name="local_favorito_id"
                    value={formData.local_favorito_id || ''}
                    onChange={handleLocationChange}
                    className="block w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-gray-50"
                  >
                    <option value="">Selecionar local salvo (opcional)</option>
                    {locaisFavoritos.map((local) => (
                      <option key={local.id} value={local.id}>
                        {local.nome}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  id="hospital"
                  name="hospital"
                  value={formData.hospital}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Nome do hospital"
                  required
                />
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

              {/* Checkbox discreto: salvar local como favorito */}
              {formData.hospital && !formData.local_favorito_id && !editingPlantao && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none pt-2">
                  <input
                    type="checkbox"
                    checked={saveAsFavorite}
                    onChange={(e) => setSaveAsFavorite(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  Salvar este local como favorito
                </label>
              )}

              {/* Ações: Cancelar + Salvar Plantão */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : 'Salvar Plantão'}
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
