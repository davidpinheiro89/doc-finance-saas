'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { SkeletonMetricCard, SkeletonTableRows } from '@/components/Skeleton'
import DashboardAlerts from '@/components/DashboardAlerts'
import NotificationPermission from '@/components/NotificationPermission'
import OnboardingModal from '@/components/OnboardingModal'
import { useOnboarding } from '@/hooks/useOnboarding'
import type { Plantao, LocalFavorito } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { isFolga, formatHoras } from '@/lib/folga-utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPlantoesByUser,
  fetchPlantoesByUserRange,
  applyAutoRealizadoStatus,
  plantoesKeys,
  type PlantaoListItem,
} from '@/lib/queries/plantoes'
import {
  formatDateBR,
  todayLocalISO,
  toLocalISO,
  getCurrentMonthRangeLocal,
  getPreviousMonthRangeLocal,
} from '@/lib/date-utils'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [locaisFavoritos, setLocaisFavoritos] = useState<any[]>([])
  const [dashboardFilter, setDashboardFilter] = useState<'current' | '3months' | 'hospital'>('current')
  const [hospitalFilter, setHospitalFilter] = useState<string>('')
  const [metaMensal, setMetaMensal] = useState<number>(30000)
  const [metaEditing, setMetaEditing] = useState(false)
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaSaved, setMetaSaved] = useState(false)
  // History filters
  const [historyHospitalFilter, setHistoryHospitalFilter] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pago' | 'aguardando' | 'atrasado'>('all')
  const [historyShowAll, setHistoryShowAll] = useState(false)
  const metaSavedTimeout = useRef<NodeJS.Timeout | null>(null)

  // --- Onboarding (primeiro acesso) ---
  const onboarding = useOnboarding(user)

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
      start: toLocalISO(firstDay),
      end: toLocalISO(lastDay),
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

  // ── Fetch meta mensal do Supabase ──
  useEffect(() => {
    if (!user) return
    const fetchMeta = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('meta_mensal')
        .eq('user_id', user.id)
        .single()
      if (data?.meta_mensal != null) setMetaMensal(data.meta_mensal)
    }
    fetchMeta()
  }, [user])

  // ── Salvar meta mensal no Supabase (onBlur / Enter) ──
  const saveMetaMensal = useCallback(async (valor: number) => {
    if (!user) return
    setMetaSaving(true)
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, meta_mensal: valor }, { onConflict: 'user_id' })
      if (!error) {
        setMetaSaved(true)
        if (metaSavedTimeout.current) clearTimeout(metaSavedTimeout.current)
        metaSavedTimeout.current = setTimeout(() => setMetaSaved(false), 2000)
      }
    } finally { setMetaSaving(false) }
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
      start: toLocalISO(previousMonth),
      end: toLocalISO(lastDayOfPreviousMonth)
    }
  }

  // Function to get current month date range
  const getCurrentMonthRange = () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    return {
      start: toLocalISO(firstDayOfMonth),
      end: toLocalISO(lastDayOfMonth)
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

  // ── Smart filter: filtra plantões conforme o modo selecionado ──
  const getFilteredPlantoes = useMemo(() => {
    const dk = (p: PlantaoListItem) => (p.data || '').split('T')[0]
    let result: PlantaoListItem[] = plantoes

    if (dashboardFilter === 'current') {
      const { start, end } = getCurrentMonthRangeLocal()
      result = plantoes.filter((p) => { const d = dk(p); return d >= start && d <= end })
    } else if (dashboardFilter === '3months') {
      const now = new Date()
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const start = toLocalISO(threeMonthsAgo)
      const end = todayLocalISO()
      result = plantoes.filter((p) => { const d = dk(p); return d >= start && d <= end })
    }

    if (dashboardFilter === 'hospital' && hospitalFilter) {
      result = plantoes.filter((p) => p.hospital === hospitalFilter)
    }

    // Custom date range overlay
    if (dateRange.start) result = result.filter((p) => dk(p) >= dateRange.start)
    if (dateRange.end) result = result.filter((p) => dk(p) <= dateRange.end)

    return result
  }, [plantoes, dashboardFilter, hospitalFilter, dateRange])

  // ── Hospital list for filter dropdown ──
  const uniqueHospitals = useMemo(() => {
    const set = new Set(plantoes.map((p) => p.hospital).filter(Boolean))
    return Array.from(set).sort()
  }, [plantoes])

  // ── Business Intelligence Metrics ──
  const metrics = useMemo(() => {
    const filtered = getFilteredPlantoes.filter(p => !isFolga(p))
    const quantidade = filtered.length
    const valorBruto = filtered.reduce((s, p) => s + (p.valor || 0), 0)
    const horasTotal = filtered.reduce((s, p) => s + (p.horas || 0), 0)

    // Valor Líquido Estimado (PJ médico: ~25% impostos/retenções)
    const TAX_RATE = 0.25
    const valorLiquido = valorBruto * (1 - TAX_RATE)

    // Valor médio por hora trabalhada (período filtrado)
    const valorHora = horasTotal > 0 ? valorBruto / horasTotal : 0

    // Média histórica geral (todos os plantões do médico, para comparação)
    const allNonFolga = plantoes.filter(p => !isFolga(p))
    const allValor = allNonFolga.reduce((s, p) => s + (p.valor || 0), 0)
    const allHoras = allNonFolga.reduce((s, p) => s + (p.horas || 0), 0)
    const valorHoraHistorico = allHoras > 0 ? allValor / allHoras : 0

    // Progresso da meta mensal (usa apenas mês atual)
    const { start: mesStart, end: mesEnd } = getCurrentMonthRangeLocal()
    const faturamentoMes = plantoes
      .filter((p) => { const d = (p.data || '').split('T')[0]; return d >= mesStart && d <= mesEnd && !isFolga(p) })
      .reduce((s, p) => s + (p.valor || 0), 0)
    const progressoMeta = metaMensal > 0 ? Math.min((faturamentoMes / metaMensal) * 100, 100) : 0

    // Ranking de hospitais por valor/hora (exclui folgas e registros sem valor)
    const hospitalMap: Record<string, { valor: number; horas: number; count: number }> = {}
    filtered.forEach((p) => {
      if (!p.hospital || isFolga(p)) return
      if (!hospitalMap[p.hospital]) hospitalMap[p.hospital] = { valor: 0, horas: 0, count: 0 }
      hospitalMap[p.hospital].valor += p.valor || 0
      hospitalMap[p.hospital].horas += p.horas || 0
      hospitalMap[p.hospital].count += 1
    })
    const hospitalRanking = Object.entries(hospitalMap)
      .map(([name, d]) => ({ name, valorHora: d.horas > 0 ? d.valor / d.horas : 0, total: d.valor, count: d.count }))
      .filter(h => h.valorHora > 0)
      .sort((a, b) => b.valorHora - a.valorHora)
      .slice(0, 5)

    return { quantidade, valorBruto, horasTotal, valorLiquido, valorHora, valorHoraHistorico, faturamentoMes, progressoMeta, hospitalRanking }
  }, [getFilteredPlantoes, plantoes, metaMensal])

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
    } catch (error) {
      console.error('Erro ao apagar:', error instanceof Error ? error.message : error)
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
      local_favorito_id: null // coluna não existe no schema atual
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

      // Auto-calculate prazo_pagamento_dias from date difference
      let prazoDias: number | null = formData.prazo_pagamento_dias ? parseInt(formData.prazo_pagamento_dias) : null
      if (formData.data_prevista_pagamento && formData.data && !prazoDias) {
        const diff = Math.round(
          (new Date(formData.data_prevista_pagamento + 'T00:00:00').getTime() - new Date(formData.data + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
        )
        prazoDias = diff > 0 ? diff : null
      }

      const plantaoData: Record<string, string | number | null> = {
        user_id: user!.id,
        hospital: formData.hospital.trim(),
        data: formData.data,
        valor: parseFloat(formData.valor),
        status: autoStatus,
        horas: formData.horas ? parseFloat(formData.horas) : 0,
        endereco: formData.endereco?.trim() || null,
        data_prevista_pagamento: formData.data_prevista_pagamento || null,
        prazo_pagamento_dias: prazoDias,
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
        // created_at handled by Supabase DEFAULT now()
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
    // Split puro da string YYYY-MM-DD — zero conversão de fuso.
    return formatDateBR(dateString)
  }

  const getSmartStatus = (plantao: PlantaoListItem): string => {
    const st = plantao.status as string
    if (st === 'pago') return 'pago'
    // Check if overdue: past payment deadline and not paid
    if (plantao.data_prevista_pagamento) {
      const deadlineStr = plantao.data_prevista_pagamento.split('T')[0]
      if (deadlineStr < todayStr) return 'atrasado'
    } else if (plantao.prazo_pagamento_dias && plantao.data) {
      const base = new Date(plantao.data.split('T')[0] + 'T00:00:00')
      base.setDate(base.getDate() + plantao.prazo_pagamento_dias)
      const deadlineStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      if (deadlineStr < todayStr) return 'atrasado'
    }
    return st
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-emerald-100 text-emerald-700'
      case 'realizado':
        return 'bg-emerald-50 text-emerald-600'
      case 'atrasado':
        return 'bg-red-100 text-red-700'
      case 'pendente':
      case 'confirmado':
        return 'bg-amber-100 text-amber-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pago': return 'Pago'
      case 'realizado': return 'Realizado'
      case 'atrasado': return 'Atrasado'
      case 'pendente': return 'Aguardando'
      case 'confirmado': return 'Confirmado'
      default: return status
    }
  }

  const handleMarkAsPaid = async (plantao: PlantaoListItem) => {
    setMarkingPaidId(plantao.id)
    try {
      const { error } = await supabase
        .from('plantoes')
        .update({ status: 'pago' })
        .eq('id', plantao.id)
        .eq('user_id', user!.id)
      if (error) { alert('Erro: ' + error.message); return }
      // Optimistic update in TanStack cache
      if (user) {
        queryClient.setQueryData<PlantaoListItem[]>(plantoesKeys.byUser(user.id), (old) =>
          (old ?? []).map((p) => p.id === plantao.id ? { ...p, status: 'pago' as const } : p),
        )
      }
    } catch { alert('Erro ao confirmar pagamento.') }
    finally { setMarkingPaidId(null) }
  }

  // Filter plantões by date — comparação por string YYYY-MM-DD evita 100% dos
  // problemas de fuso horário. Normaliza com `.split('T')[0]` para ser robusto
  // caso o Supabase devolva timestamp completo em vez de date puro.
  const todayStr = todayLocalISO()
  const dataKey = (p: PlantaoListItem) => (p.data || '').split('T')[0]

  const todayPlantoes = plantoes.filter((p: PlantaoListItem) => {
    const d = dataKey(p)
    return d && d === todayStr && !isFolga(p)
  }).sort((a: PlantaoListItem, b: PlantaoListItem) => (a.hospital || '').localeCompare(b.hospital || ''))

  const upcomingPlantoes = plantoes.filter((p: PlantaoListItem) => {
    const d = dataKey(p)
    return d && d > todayStr && !isFolga(p)
  }).sort((a: PlantaoListItem, b: PlantaoListItem) => dataKey(a).localeCompare(dataKey(b)))

  const historicalPlantoes = plantoes.filter((p: PlantaoListItem) => {
    const d = dataKey(p)
    return d && d < todayStr && !isFolga(p)
  }).sort((a: PlantaoListItem, b: PlantaoListItem) => dataKey(b).localeCompare(dataKey(a)))

  const pendentesPagamento = plantoes.filter((p: PlantaoListItem) =>
    (p.status === 'pendente' || p.status === 'confirmado') && !isFolga(p)
  ).length

  // Folgas no mês atual (para exibição separada)
  const folgasNoMes = useMemo(() => {
    const { start, end } = getCurrentMonthRangeLocal()
    return plantoes.filter(p => {
      const d = (p.data || '').split('T')[0]
      return d >= start && d <= end && isFolga(p)
    }).length
  }, [plantoes])

  // ── History filter logic ──
  const historyUniqueHospitals = useMemo(() => {
    const set = new Set(historicalPlantoes.map(p => p.hospital).filter(Boolean))
    return Array.from(set).sort()
  }, [historicalPlantoes])

  const filteredHistoricalPlantoes = useMemo(() => {
    return historicalPlantoes.filter(p => {
      if (historyHospitalFilter && p.hospital !== historyHospitalFilter) return false
      if (historyStatusFilter !== 'all') {
        const smart = getSmartStatus(p)
        if (historyStatusFilter === 'pago' && smart !== 'pago') return false
        if (historyStatusFilter === 'aguardando' && smart !== 'realizado' && smart !== 'pendente' && smart !== 'confirmado') return false
        if (historyStatusFilter === 'atrasado' && smart !== 'atrasado') return false
      }
      return true
    })
  }, [historicalPlantoes, historyHospitalFilter, historyStatusFilter])

  // ── Export CSV ──
  const handleExportCSV = () => {
    const rows = filteredHistoricalPlantoes.map(p => {
      const bruto = p.valor || 0
      const retencao = bruto * 0.25
      const liquido = bruto - retencao
      return {
        'Data': (p.data || '').split('T')[0].split('-').reverse().join('/'),
        'Hospital': p.hospital || '',
        'Carga Horária (h)': p.horas || 0,
        'Valor Bruto (R$)': bruto.toFixed(2).replace('.', ','),
        'Retenção Estimada (R$)': retencao.toFixed(2).replace('.', ','),
        'Valor Líquido (R$)': liquido.toFixed(2).replace('.', ','),
        'Status': getStatusLabel(getSmartStatus(p)),
      }
    })
    if (rows.length === 0) { alert('Nenhum plantão para exportar com os filtros atuais.'); return }
    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => `"${r[h as keyof typeof r]}"`).join(';'))
    ].join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `plantoes_relatorio_${todayStr}.csv`
    link.click()
    URL.revokeObjectURL(url)
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

  const subscriptionStatus = user?.user_metadata?.subscription_status
  if (subscriptionStatus !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center border border-orange-200/60">
              <span className="text-4xl">🔒</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Acesso Restrito</h1>
            <p className="text-gray-600 leading-relaxed mb-8">
              Identificamos que você ainda não possui uma assinatura ativa no BEM Plantonista. Ative seu plano piloto para liberar o acesso completo à sua escala e controle financeiro.
            </p>
            <a
              href="https://wa.me/5511985904388?text=Olá, gostaria de ativar minha conta do BEM Plantonista."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Falar com o Suporte / Ativar Conta
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      {onboarding.showOnboarding && (
        <OnboardingModal
          step={onboarding.step}
          setStep={onboarding.setStep}
          saveProfile={onboarding.saveProfile}
          completeOnboarding={onboarding.completeOnboarding}
          skipOnboarding={onboarding.skipOnboarding}
        />
      )}
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 overflow-auto w-full relative z-10">
        {/* ── Header Premium ── */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-lg">☰</span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
                  <p className="text-xs text-gray-500 hidden sm:block">Visão geral dos seus plantões</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pendentesPagamento > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    {pendentesPagamento} pagamento(s) pendente(s)
                  </span>
                )}
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-800">{user?.user_metadata?.full_name || 'Médico'}</p>
                  <p className="text-xs text-gray-400">{user?.user_metadata?.crm || 'CRM'}</p>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-all" title="Sair">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">

          {/* ── Filtros Fluidos ── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 rounded-xl p-1">
                {([
                  { key: 'current', label: 'Mês Atual' },
                  { key: '3months', label: 'Últimos 3 Meses' },
                  { key: 'hospital', label: 'Por Hospital' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setDashboardFilter(key); if (key !== 'hospital') setHospitalFilter('') }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      dashboardFilter === key
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {dashboardFilter === 'hospital' && (
                <select
                  value={hospitalFilter}
                  onChange={(e) => setHospitalFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-white"
                >
                  <option value="">Todos os hospitais</option>
                  {uniqueHospitals.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              )}

              <div className="flex items-center gap-2 ml-auto">
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
            </div>
          </div>

          {/* ── Cards de Métricas Premium ── */}
          {isPlantoesPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SkeletonMetricCard /><SkeletonMetricCard /><SkeletonMetricCard /><SkeletonMetricCard />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Faturamento Bruto */}
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="text-sm font-medium text-orange-100">Faturamento Bruto</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{formatCurrency(metrics.valorBruto)}</p>
                  <p className="text-xs text-orange-200 mt-2">{metrics.quantidade} plantões no período</p>
                </div>

                {/* Líquido Estimado */}
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="text-sm font-medium text-emerald-100">Líquido Estimado</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{formatCurrency(metrics.valorLiquido)}</p>
                  <p className="text-xs text-emerald-200 mt-2">Após ~25% de retenções PJ</p>
                </div>

                {/* Valor Médio/Hora */}
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="text-sm font-medium text-orange-100">Valor Médio / Hora</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{formatCurrency(metrics.valorHora)}</p>
                  <p className="text-xs text-orange-200 mt-2">
                    {metrics.valorHoraHistorico > 0 && metrics.valorHora > 0 ? (
                      <>
                        Sua média histórica: {formatCurrency(metrics.valorHoraHistorico)}/h
                        {metrics.valorHora > metrics.valorHoraHistorico
                          ? <span className="ml-1 text-green-200">▲ acima</span>
                          : metrics.valorHora < metrics.valorHoraHistorico
                          ? <span className="ml-1 text-red-200">▼ abaixo</span>
                          : null}
                      </>
                    ) : (
                      <>{formatHoras(metrics.horasTotal)} trabalhadas no período</>
                    )}
                  </p>
                </div>

                {/* Carga Horária */}
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="text-sm font-medium text-emerald-100">Carga Horária</p>
                  <p className="text-3xl font-bold mt-1 tracking-tight">{formatHoras(metrics.horasTotal)}</p>
                  <p className="text-xs text-emerald-200 mt-2">{metrics.quantidade} plantões</p>
                </div>
              </div>

              {/* Folgas no mês (exibição separada, sem somar nos KPIs) */}
              {folgasNoMes > 0 && (
                <p className="text-xs text-gray-400 text-right">Folgas no mês: {folgasNoMes}</p>
              )}

              {/* ── Meta Mensal + Ranking por Hospital ── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Meta Mensal */}
                <div className="lg:col-span-2 bg-gradient-to-br from-white to-orange-50/30 rounded-2xl border border-gray-200/60 shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Meta Mensal</h3>
                    <div className="flex items-center gap-1.5">
                      {metaSaved && (
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">✓ Salvo</span>
                      )}
                      {metaSaving && (
                        <span className="text-[10px] text-gray-400">Salvando...</span>
                      )}
                      {metaEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">R$</span>
                          <input
                            autoFocus
                            type="number"
                            value={metaMensal}
                            onChange={(e) => setMetaMensal(Number(e.target.value) || 0)}
                            onBlur={() => { saveMetaMensal(metaMensal); setMetaEditing(false) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') setMetaEditing(false) }}
                            className="w-28 text-right text-xs font-medium text-gray-700 border border-orange-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setMetaEditing(true)}
                          title="Clique para editar sua meta mensal"
                          className="group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                        >
                          <span className="text-xs font-medium text-gray-600">{formatCurrency(metaMensal)}</span>
                          <svg className="h-3.5 w-3.5 text-gray-400 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ring Progress */}
                  <div className="flex items-center gap-6">
                    <div className="relative w-28 h-28 flex-shrink-0">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                        <circle
                          cx="60" cy="60" r="50" fill="none"
                          stroke={metrics.progressoMeta >= 100 ? '#10b981' : '#f97316'}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(metrics.progressoMeta / 100) * 314.16} 314.16`}
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-800">{metrics.progressoMeta.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-400">Faturado este mês</p>
                        <p className="text-lg font-bold text-gray-800">{formatCurrency(metrics.faturamentoMes)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Falta para a meta</p>
                        <p className="text-lg font-bold text-gray-800">
                          {formatCurrency(Math.max(metaMensal - metrics.faturamentoMes, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ranking de Hospitais */}
                <div className="lg:col-span-3 bg-gradient-to-br from-white to-violet-50/20 rounded-2xl border border-gray-200/60 shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Top Hospitais por R$/Hora</h3>
                  {metrics.hospitalRanking.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Registre plantões com horas para ver o ranking</p>
                  ) : (
                    <div className="space-y-3">
                      {metrics.hospitalRanking.map((h, i) => {
                        const maxValorHora = metrics.hospitalRanking[0]?.valorHora || 1
                        const pct = (h.valorHora / maxValorHora) * 100
                        return (
                          <div key={h.name} className="group cursor-default">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm ${
                                  i === 0 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>{i + 1}</span>
                                <span className="text-sm font-medium text-gray-800 truncate">{h.name}</span>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <span className="text-sm font-bold text-gray-900">{formatCurrency(h.valorHora)}/h</span>
                                <span className="text-[10px] text-gray-400 ml-1.5 bg-gray-100 px-1.5 py-0.5 rounded-md">{h.count} plantões</span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${i === 0 ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 'bg-gradient-to-r from-orange-200 to-orange-300'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {/* Tooltip on hover */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1">
                              <p className="text-[10px] text-gray-400">Total: {formatCurrency(h.total)} em {h.count} plantão(ões)</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Central de Alertas ── */}
          {!isPlantoesPending && (
            <div className="space-y-3">
              <DashboardAlerts plantoes={plantoes} getSmartStatus={getSmartStatus} isLoading={isPlantoesPending} />
              <NotificationPermission />
            </div>
          )}

          {/* ── Plantões de Hoje ── */}
          {!isPlantoesPending && todayPlantoes.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 p-6">
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-500 rounded-xl p-2.5 shadow-lg shadow-orange-500/30">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Plantões de Hoje</h2>
                  <p className="text-xs text-gray-500">{todayPlantoes.length} plantão(ões) agendado(s)</p>
                </div>
              </div>
              <div className="space-y-2">
                {todayPlantoes.map((plantao) => (
                  <div key={plantao.id} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between border border-orange-100/60 hover:bg-white transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{plantao.hospital}</p>
                      <p className="text-xs text-gray-500">{plantao.horas ? formatHoras(plantao.horas) : ''}{plantao.especialidade ? ` · ${plantao.especialidade}` : ''}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-emerald-600">{formatCurrency(plantao.valor || 0)}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${getStatusColor(getSmartStatus(plantao))}`}>{getStatusLabel(getSmartStatus(plantao))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Próximos Plantões ── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="flex justify-between items-center p-6 pb-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Próximos Plantões</h2>
                <p className="text-xs text-gray-500 mt-0.5">{upcomingPlantoes.length} agendado(s)</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-sm py-2.5 px-5 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-200"
              >
                + Novo Plantão
              </button>
            </div>

            {isPlantoesPending ? (
              <div className="p-6"><SkeletonTableRows rows={4} cols={6} /></div>
            ) : upcomingPlantoes.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                  <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-gray-500 font-medium">Nenhum plantão agendado</p>
                <p className="text-xs text-gray-400 mt-1">Clique em &quot;+ Novo Plantão&quot; para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50/80 to-gray-100/50 border-b border-gray-100">
                      {['Data', 'Hospital', 'Valor', 'Horas', 'Status', 'Ações'].map((h) => (
                        <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPlantoes.map((plantao, idx) => (
                      <tr key={plantao.id} className={`hover:bg-orange-50/40 transition-colors ${idx !== upcomingPlantoes.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-orange-600">{formatDate(plantao.data)}</span>
                          {Number(plantao.horas) > 0 && <span className="block text-[10px] text-gray-400">{formatHoras(plantao.horas)}</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button onClick={() => { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plantao.endereco || plantao.hospital)}`, '_blank') }}
                            className="text-sm text-gray-900 hover:text-orange-600 font-medium transition-colors">{plantao.hospital}</button>
                          {plantao.endereco && <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{plantao.endereco}</p>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{formatCurrency(plantao.valor)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatHoras(plantao.horas)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wide ${getStatusColor(getSmartStatus(plantao))}`}>{getStatusLabel(getSmartStatus(plantao))}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-1">
                            <button onClick={() => handleEditPlantao(plantao)} className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors" title="Editar">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDeletePlantao(plantao.id)} disabled={deletingId === plantao.id} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40" title="Excluir">
                              {deletingId === plantao.id ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" /> : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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

          {/* ── Histórico ── */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
            <div className="p-6 pb-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Histórico</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {filteredHistoricalPlantoes.length === historicalPlantoes.length
                        ? `${historicalPlantoes.length} plantão(ões)`
                        : `${filteredHistoricalPlantoes.length} de ${historicalPlantoes.length} plantão(ões)`
                      }
                    </p>
                  </div>
                </div>
                {/* Export button */}
                <button onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all group">
                  <svg className="h-4 w-4 text-gray-400 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Exportar</span>
                </button>
              </div>

              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status chips — larger touch targets on mobile */}
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'pago', label: 'Pagos' },
                  { key: 'aguardando', label: 'Aguardando' },
                  { key: 'atrasado', label: 'Atrasados' },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => setHistoryStatusFilter(key)}
                    className={`px-3.5 py-2 md:px-3 md:py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      historyStatusFilter === key
                        ? key === 'atrasado'
                          ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                          : key === 'pago'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                            : 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 active:bg-gray-100'
                    }`}>
                    {label}
                  </button>
                ))}

                {/* Hospital select */}
                <select value={historyHospitalFilter} onChange={(e) => setHistoryHospitalFilter(e.target.value)}
                  className="ml-auto px-3 py-2 md:py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 max-w-[180px] sm:max-w-[200px] truncate">
                  <option value="">Todos os hospitais</option>
                  {historyUniqueHospitals.map(h => <option key={h} value={h}>{h}</option>)}
                </select>

                {/* Clear filters */}
                {(historyHospitalFilter || historyStatusFilter !== 'all') && (
                  <button onClick={() => { setHistoryHospitalFilter(''); setHistoryStatusFilter('all') }}
                    className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="Limpar filtros">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            {isPlantoesPending ? (
              <div className="p-6"><SkeletonTableRows rows={5} cols={5} /></div>
            ) : filteredHistoricalPlantoes.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                  <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-gray-500 font-medium">
                  {historicalPlantoes.length === 0 ? 'Nenhum plantão realizado ainda' : 'Nenhum plantão encontrado com esses filtros'}
                </p>
                {historicalPlantoes.length > 0 && (
                  <button onClick={() => { setHistoryHospitalFilter(''); setHistoryStatusFilter('all') }}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-2 transition-colors">Limpar filtros</button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50/80 to-gray-100/50 border-b border-gray-100">
                      {['Data', 'Hospital', 'Valor', 'Status', 'Ações'].map((h) => (
                        <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(historyShowAll ? filteredHistoricalPlantoes : filteredHistoricalPlantoes.slice(0, 10)).map((plantao, idx) => {
                      const visibleCount = historyShowAll ? filteredHistoricalPlantoes.length : Math.min(filteredHistoricalPlantoes.length, 10)
                      return (
                      <tr key={plantao.id} className={`hover:bg-gray-50/60 transition-colors ${idx !== visibleCount - 1 ? 'border-b border-gray-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{formatDate(plantao.data)}</span>
                          {Number(plantao.horas) > 0 && <span className="block text-[10px] text-gray-400">{formatHoras(plantao.horas)}</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button onClick={() => { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plantao.endereco || plantao.hospital)}`, '_blank') }}
                            className="text-sm text-gray-700 hover:text-orange-600 font-medium transition-colors">{plantao.hospital}</button>
                          {plantao.endereco && <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{plantao.endereco}</p>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{formatCurrency(plantao.valor)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => { const smart = getSmartStatus(plantao); return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wide ${getStatusColor(smart)}`}>
                              {smart === 'atrasado' && <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" /></svg>}
                              {smart === 'pago' && <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                              {getStatusLabel(smart)}
                            </span>
                          )})()}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-0.5">
                            {getSmartStatus(plantao) !== 'pago' && (
                              <button onClick={() => handleMarkAsPaid(plantao)} disabled={markingPaidId === plantao.id}
                                className="p-2 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-40" title="Dar Baixa">
                                {markingPaidId === plantao.id
                                  ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" />
                                  : <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                }
                              </button>
                            )}
                            <button onClick={() => handleEditPlantao(plantao)} className="p-2 rounded-lg hover:bg-orange-50 active:bg-orange-100 text-gray-400 hover:text-orange-600 transition-colors" title="Editar">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDeletePlantao(plantao.id)} disabled={deletingId === plantao.id} className="p-2 rounded-lg hover:bg-red-50 active:bg-red-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40" title="Excluir">
                              {deletingId === plantao.id ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500 border-t-transparent" /> : (
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                {filteredHistoricalPlantoes.length > 10 && (
                  <div className="text-center py-3 border-t border-gray-50">
                    <button onClick={() => setHistoryShowAll(!historyShowAll)} className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors">
                      {historyShowAll ? 'Mostrar menos' : `Ver todos os ${filteredHistoricalPlantoes.length} plantões →`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

      {/* Modal Premium */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto flex flex-col border border-gray-200/60">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">
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

              {/* Data Prevista de Pagamento */}
              <div>
                <label htmlFor="data_prevista_pagamento" className="block text-sm font-medium text-gray-700 mb-2">
                  Data Prevista de Pagamento
                </label>
                <input
                  type="date"
                  id="data_prevista_pagamento"
                  name="data_prevista_pagamento"
                  value={formData.data_prevista_pagamento}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-transparent text-sm"
                />
                {/* Atalhos rápidos */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.data) { alert('Preencha a data do plantão primeiro.'); return }
                      const base = new Date(formData.data + 'T00:00:00')
                      base.setDate(base.getDate() + 30)
                      const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
                      setFormData(prev => ({ ...prev, data_prevista_pagamento: iso, prazo_pagamento_dias: '30' }))
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      formData.prazo_pagamento_dias === '30'
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.data) { alert('Preencha a data do plantão primeiro.'); return }
                      const base = new Date(formData.data + 'T00:00:00')
                      const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 15)
                      const iso = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-15`
                      const diffDays = Math.round((nextMonth.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
                      setFormData(prev => ({ ...prev, data_prevista_pagamento: iso, prazo_pagamento_dias: String(diffDays) }))
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      formData.data_prevista_pagamento && formData.data_prevista_pagamento.endsWith('-15') && formData.prazo_pagamento_dias !== '30'
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    Próximo Mês (dia 15)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, data_prevista_pagamento: '', prazo_pagamento_dias: '' }))
                      document.getElementById('data_prevista_pagamento')?.focus()
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      formData.data_prevista_pagamento && formData.prazo_pagamento_dias !== '30' && !formData.data_prevista_pagamento.endsWith('-15')
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    Customizado
                  </button>
                </div>
                {formData.data_prevista_pagamento && formData.data && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    {(() => {
                      const diff = Math.round((new Date(formData.data_prevista_pagamento + 'T00:00:00').getTime() - new Date(formData.data + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                      return diff > 0 ? `≈ ${diff} dias após o plantão` : 'Data anterior ao plantão'
                    })()}
                  </p>
                )}
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
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
