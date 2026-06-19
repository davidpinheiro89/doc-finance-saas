'use client'

import React, { useState } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Sidebar from '../../components/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { fetchPlantoesByUser, plantoesKeys, type PlantaoListItem } from '@/lib/queries/plantoes'
import { formatHoras } from '@/lib/folga-utils'
import { calcularValorEfetivo } from '@/lib/calcular-valor'

// ── Block Type & Color config ──
const BLOCK_TYPES = [
  { key: 'plantao', label: 'Plantão', revenue: true },
  { key: 'folga', label: 'Folga', revenue: false },
  { key: 'pos-plantao', label: 'Pós-Plantão', revenue: false },
  { key: 'ferias', label: 'Férias', revenue: false },
  { key: 'personalizado', label: 'Personalizado', revenue: false },
] as const

const BLOCK_COLORS = [
  { key: 'emerald', label: 'Esmeralda', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200/60', text: 'text-emerald-800' },
  { key: 'indigo', label: 'Índigo', dot: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200/60', text: 'text-indigo-800' },
  { key: 'amber', label: 'Âmbar', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200/60', text: 'text-amber-800' },
  { key: 'rose', label: 'Rosa', dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200/60', text: 'text-rose-800' },
  { key: 'gray', label: 'Cinza', dot: 'bg-gray-500', bg: 'bg-gray-100', border: 'border-gray-200/60', text: 'text-gray-700' },
  { key: 'violet', label: 'Violeta', dot: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-200/60', text: 'text-violet-800' },
  { key: 'sky', label: 'Céu', dot: 'bg-sky-500', bg: 'bg-sky-50', border: 'border-sky-200/60', text: 'text-sky-800' },
  { key: 'orange', label: 'Laranja', dot: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200/60', text: 'text-orange-800' },
] as const

type BlockColorKey = typeof BLOCK_COLORS[number]['key']

const getColorConfig = (colorKey: string | null) => {
  return BLOCK_COLORS.find(c => c.key === colorKey) || BLOCK_COLORS[0]
}

export default function EscalaPage() {
  const { user, loading } = useAuthGuard()
  const queryClient = useQueryClient()

  const { data: plantoes = [], isPending: isPlantoesPending } = useQuery({
    queryKey: user ? plantoesKeys.byUser(user.id) : ['plantoes', 'anon'],
    queryFn: () => fetchPlantoesByUser(user!.id),
    enabled: !!user,
  })

  const invalidatePlantoes = () => {
    if (user) queryClient.invalidateQueries({ queryKey: plantoesKeys.byUser(user.id) })
  }

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showPlantaoForm, setShowPlantaoForm] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [formData, setFormData] = useState({
    hospital: '', data: '', valor: '', status: 'pendente',
    horas: '', endereco: '', cep: '',
    data_prevista_pagamento: '', prazo_pagamento_dias: '',
    classificacao: '', especialidade: '', turno: '',
  })
  const [hospitalSuggestions, setHospitalSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [conflictData, setConflictData] = useState<{ hospitals: string[]; dateStr: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [savingPlantao, setSavingPlantao] = useState(false)
  // Block type & color
  const [blockType, setBlockType] = useState<string>('plantao')
  const [blockColor, setBlockColor] = useState<BlockColorKey>('emerald')
  const [customBlockName, setCustomBlockName] = useState('')
  // "Passar Plantão" share
  const [editingId, setEditingId] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<PlantaoListItem | null>(null)
  const [shareShowValor, setShareShowValor] = useState(false)
  const [shareNota, setShareNota] = useState('')
  // Recurrence
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'biweekly'>('weekly')
  const [recurrenceLimitType, setRecurrenceLimitType] = useState<'date' | 'count'>('count')
  const [recurrenceLimitDate, setRecurrenceLimitDate] = useState('')
  const [recurrenceLimitCount, setRecurrenceLimitCount] = useState(4)
  const [tipoRemuneracao, setTipoRemuneracao] = useState<'por_plantao' | 'fixo_mensal'>('por_plantao')
  // Series modal
  const [seriesModal, setSeriesModal] = useState<{ action: 'edit' | 'delete'; plantao: PlantaoListItem; siblings: PlantaoListItem[] } | null>(null)
  const router = useRouter()

  const isRevenueBlock = BLOCK_TYPES.find(b => b.key === blockType)?.revenue ?? true

  // ── Helpers ──
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayStr = fmt(new Date())
  const getDaysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay()

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const navigateMonth = (dir: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const m = new Date(prev)
      m.setMonth(m.getMonth() + (dir === 'prev' ? -1 : 1))
      return m
    })
  }

  const getPlantoesForDay = (day: number): PlantaoListItem[] => {
    const dateStr = fmt(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
    return plantoes.filter(p => (p.data || '').split('T')[0] === dateStr)
  }

  const getDayType = (events: PlantaoListItem[]): 'plantao' | 'folga' | 'disponivel' | null => {
    if (events.length === 0) return null
    if (events.some(e => e.classificacao === 'folga')) return 'folga'
    if (events.some(e => e.classificacao === 'disponivel')) return 'disponivel'
    return 'plantao'
  }

  // Check if an event is a custom non-revenue block (not standard folga/disponivel)
  const isCustomBlock = (p: PlantaoListItem) => {
    const cls = p.classificacao || ''
    return cls !== '' && cls !== 'folga' && cls !== 'disponivel' &&
      !['Sala Verde', 'Sala Amarela', 'Sala Vermelha', 'Outro'].includes(cls) &&
      p.valor === 0
  }

  // Get display label for an event
  const getEventLabel = (p: PlantaoListItem) => {
    if (isCustomBlock(p)) {
      const label = BLOCK_TYPES.find(b => b.key === p.classificacao)?.label
      return label || p.hospital || p.classificacao || 'Evento'
    }
    return p.hospital
  }

  // ── Series detection ──
  const findSeriesSiblings = (p: PlantaoListItem): PlantaoListItem[] => {
    if (!p.data || !p.hospital) return []
    const pDate = new Date(p.data.split('T')[0] + 'T12:00:00')
    const pDay = pDate.getDay()
    return plantoes.filter(other => {
      if (other.id === p.id) return false
      if (other.hospital !== p.hospital) return false
      if (other.valor !== p.valor) return false
      if ((other.horas || 0) !== (p.horas || 0)) return false
      if (!other.data) return false
      const oDate = new Date(other.data.split('T')[0] + 'T12:00:00')
      if (oDate.getDay() !== pDay) return false
      // Check if interval is multiple of 7 days
      const diffDays = Math.abs(Math.round((oDate.getTime() - pDate.getTime()) / 86400000))
      return diffDays > 0 && diffDays % 7 === 0
    })
  }

  const handleSeriesEdit = (p: PlantaoListItem) => {
    const siblings = findSeriesSiblings(p)
    if (siblings.length > 0) {
      setSeriesModal({ action: 'edit', plantao: p, siblings })
    } else {
      handleEditShift(p)
    }
  }

  const handleSeriesDelete = (p: PlantaoListItem) => {
    const siblings = findSeriesSiblings(p)
    if (siblings.length > 0) {
      setSeriesModal({ action: 'delete', plantao: p, siblings })
    } else {
      handleDeleteSingle(p)
    }
  }

  const handleDeleteSingle = async (p: PlantaoListItem) => {
    if (!user) return
    try {
      const { error } = await supabase.from('plantoes').delete().eq('id', p.id).eq('user_id', user.id)
      if (error) { alert('Erro: ' + error.message); return }
      setSeriesModal(null)
      setShowActionModal(false)
      invalidatePlantoes()
    } catch { alert('Erro ao apagar.') }
  }

  const handleDeleteSeries = async (p: PlantaoListItem, siblings: PlantaoListItem[]) => {
    if (!user) return
    const allIds = [p.id, ...siblings.map(s => s.id)]
    try {
      const { error } = await supabase.from('plantoes').delete().in('id', allIds).eq('user_id', user.id)
      if (error) { alert('Erro: ' + error.message); return }
      setSeriesModal(null)
      setShowActionModal(false)
      invalidatePlantoes()
    } catch { alert('Erro ao apagar série.') }
  }

  // ── Actions ──
  const handleDayClick = (day: number) => {
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
    setShowActionModal(true)
  }

  const handleAddStatus = async (status: 'disponivel' | 'folga') => {
    if (!user || !selectedDate) return
    const dateStr = fmt(selectedDate)
    try {
      const { error } = await supabase.from('plantoes').insert([{
        user_id: user.id, data: dateStr, status: 'confirmado',
        hospital: status === 'disponivel' ? 'Disponível' : 'Folga',
        valor: 0, horas: 0, endereco: '', cep: '',
        data_prevista_pagamento: dateStr, prazo_pagamento_dias: 0,
        classificacao: status, especialidade: ''
      }]).select()
      if (error) { alert('Erro: ' + error.message); return }
      setShowActionModal(false)
      invalidatePlantoes()
    } catch { alert('Erro ao salvar. Tente novamente.') }
  }

  const handleOpenPlantaoForm = async () => {
    if (!user || !selectedDate) return
    const dateStr = fmt(selectedDate)
    // Remove disponível/folga if present before opening form
    const statusEvents = plantoes.filter(p => {
      const d = (p.data || '').split('T')[0]
      return d === dateStr && (p.classificacao === 'folga' || p.classificacao === 'disponivel')
    })
    if (statusEvents.length > 0) {
      await supabase.from('plantoes').delete().in('id', statusEvents.map(e => e.id)).eq('user_id', user.id)
      invalidatePlantoes()
    }
    const existing = plantoes.filter(p => {
      const d = (p.data || '').split('T')[0]
      return d === dateStr && p.classificacao !== 'folga' && p.classificacao !== 'disponivel'
    })
    if (existing.length > 0) {
      setConflictData({ hospitals: existing.map(p => p.hospital), dateStr })
      setShowActionModal(false)
      return
    }
    setShowActionModal(false)
    setShowPlantaoForm(true)
    setFormData(prev => ({ ...prev, data: dateStr }))
  }

  const handleConfirmConflict = () => {
    if (!selectedDate) return
    setConflictData(null)
    setShowPlantaoForm(true)
    setFormData(prev => ({ ...prev, data: fmt(selectedDate) }))
  }

  const handleClearDay = () => {
    if (!user || !selectedDate) return
    setShowActionModal(false)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteDay = async () => {
    if (!user || !selectedDate) return
    const dateStr = fmt(selectedDate)
    try {
      const { error } = await supabase.from('plantoes').delete().eq('data', dateStr).eq('user_id', user.id)
      if (error) { alert('Erro: ' + error.message); return }
      setShowDeleteConfirm(false)
      invalidatePlantoes()
    } catch { alert('Erro ao limpar. Tente novamente.') }
  }

  const generateRecurrenceDates = (startDate: string): string[] => {
    const dates: string[] = [startDate]
    const intervalDays = recurrenceFreq === 'weekly' ? 7 : 14
    const base = new Date(startDate + 'T00:00:00')

    if (recurrenceLimitType === 'count') {
      for (let i = 1; i < recurrenceLimitCount; i++) {
        const next = new Date(base)
        next.setDate(next.getDate() + intervalDays * i)
        dates.push(fmt(next))
      }
    } else {
      const limitDate = recurrenceLimitDate
      let i = 1
      while (true) {
        const next = new Date(base)
        next.setDate(next.getDate() + intervalDays * i)
        const nextStr = fmt(next)
        if (nextStr > limitDate) break
        dates.push(nextStr)
        i++
        if (i > 52) break // safety limit
      }
    }
    return dates
  }

  const handleSavePlantao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Resolve the display label for this block
    const blockLabel = blockType === 'personalizado'
      ? customBlockName.trim() || 'Personalizado'
      : BLOCK_TYPES.find(b => b.key === blockType)?.label || 'Plantão'

    // Validation depends on block type
    if (isRevenueBlock) {
      if (!formData.hospital || !formData.data || !formData.valor || !formData.horas) {
        alert('Preencha hospital, data, valor e duração.'); return
      }
    } else {
      if (!formData.data) {
        alert('Preencha a data.'); return
      }
    }

    let prazoDias: number | null = formData.prazo_pagamento_dias ? parseInt(formData.prazo_pagamento_dias) : null
    if (formData.data_prevista_pagamento && formData.data && !prazoDias) {
      const diff = Math.round((new Date(formData.data_prevista_pagamento + 'T00:00:00').getTime() - new Date(formData.data + 'T00:00:00').getTime()) / 86400000)
      prazoDias = diff > 0 ? diff : null
    }

    // Generate dates (single or recurrence batch)
    const grupoId = recurrenceEnabled ? crypto.randomUUID() : null
    const dates = recurrenceEnabled ? generateRecurrenceDates(formData.data) : [formData.data]

    const rows = dates.map(dateStr => {
      const autoStatus = dateStr < todayStr ? 'realizado' : 'pendente'
      // Recalculate data_prevista_pagamento relative to each date if prazoDias is set
      let dataPrevPgto: string | null = formData.data_prevista_pagamento || null
      if (prazoDias && dateStr !== formData.data) {
        const d = new Date(dateStr + 'T00:00:00')
        d.setDate(d.getDate() + prazoDias)
        dataPrevPgto = fmt(d)
      }

      // Non-revenue blocks: override hospital/valor/horas, store color in especialidade
      const hospitalName = isRevenueBlock
        ? formData.hospital.trim()
        : (blockLabel)
      const valor = isRevenueBlock ? parseFloat(formData.valor) : 0
      const horas = isRevenueBlock ? (formData.horas ? parseFloat(formData.horas) : 0) : 0

      // Store block metadata: classificacao = block type key, especialidade = color key
      // For revenue (plantao), keep original behavior
      const classificacao = isRevenueBlock
        ? (formData.classificacao || null)
        : blockType === 'personalizado' ? customBlockName.trim() || 'personalizado' : blockType
      const especialidade = isRevenueBlock
        ? (formData.especialidade || null)
        : blockColor

      return {
        user_id: user.id, hospital: hospitalName, data: dateStr,
        valor, status: autoStatus,
        horas,
        endereco: isRevenueBlock ? (formData.endereco?.trim() || null) : null,
        data_prevista_pagamento: isRevenueBlock ? dataPrevPgto : null,
        prazo_pagamento_dias: isRevenueBlock ? prazoDias : null,
        classificacao,
        especialidade,
        turno: isRevenueBlock ? (formData.turno || null) : null,
        grupo_recorrencia_id: grupoId,
        tipo_remuneracao: recurrenceEnabled ? tipoRemuneracao : 'por_plantao',
      }
    })

    setSavingPlantao(true)
    try {
      if (editingId) {
        // Update existing record
        const { error } = await supabase.from('plantoes').update(rows[0]).eq('id', editingId).eq('user_id', user.id)
        if (error) { alert('Erro: ' + error.message); return }
        // If recurrence is enabled, insert the additional weeks
        if (recurrenceEnabled && rows.length > 1) {
          const extraRows = rows.slice(1)
          const { error: recError } = await supabase.from('plantoes').insert(extraRows).select()
          if (recError) { alert('Plantão atualizado, mas erro ao replicar semanas: ' + recError.message); return }
        }
      } else {
        const { error } = await supabase.from('plantoes').insert(rows).select()
        if (error) { alert('Erro: ' + error.message); return }
      }
      setShowPlantaoForm(false)
      setEditingId(null)
      setFormData({ hospital: '', data: '', valor: '', status: 'pendente', horas: '', endereco: '', cep: '', data_prevista_pagamento: '', prazo_pagamento_dias: '', classificacao: '', especialidade: '', turno: '' })
      setBlockType('plantao')
      setBlockColor('emerald')
      setCustomBlockName('')
      setRecurrenceEnabled(false)
      setRecurrenceLimitCount(4)
      setRecurrenceLimitDate('')
      setTipoRemuneracao('por_plantao')
      invalidatePlantoes()
    } catch { alert('Erro ao salvar plantão.') }
    finally { setSavingPlantao(false) }
  }

  const handleEditShift = (p: PlantaoListItem) => {
    const isCustom = isCustomBlock(p)
    setEditingId(p.id)
    setFormData({
      hospital: isCustom ? '' : p.hospital,
      data: (p.data || '').split('T')[0],
      valor: p.valor > 0 ? String(p.valor) : '',
      status: p.status || 'pendente',
      horas: p.horas ? String(p.horas) : '',
      endereco: p.endereco || '',
      cep: '',
      data_prevista_pagamento: p.data_prevista_pagamento || '',
      prazo_pagamento_dias: p.prazo_pagamento_dias ? String(p.prazo_pagamento_dias) : '',
      classificacao: isCustom ? '' : (p.classificacao || ''),
      especialidade: isCustom ? '' : (p.especialidade || ''),
      turno: p.turno || '',
    })
    // Determine block type
    const matchedBlock = BLOCK_TYPES.find(b => b.key === p.classificacao)
    setBlockType(matchedBlock ? matchedBlock.key : (p.valor > 0 ? 'plantao' : 'plantao'))
    // Determine block color
    const matchedColor = BLOCK_COLORS.find(c => c.key === p.especialidade)
    setBlockColor(matchedColor ? matchedColor.key : 'emerald')
    setCustomBlockName(isCustom && !matchedBlock ? (p.classificacao || '') : '')
    setRecurrenceEnabled(false)
    setTipoRemuneracao(p.tipo_remuneracao === 'fixo_mensal' ? 'fixo_mensal' : 'por_plantao')
    setShowActionModal(false)
    setShowPlantaoForm(true)
  }

  const handleOpenPassarPlantao = (p: PlantaoListItem) => {
    setShareTarget(p)
    setShareShowValor(false)
    setShareNota('')
    setShowActionModal(false)
  }

  const handlePassarPlantaoWhatsApp = () => {
    if (!shareTarget) return
    const p = shareTarget
    const dateObj = new Date(p.data.split('T')[0] + 'T12:00:00')
    const dateBR = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const userName = user?.user_metadata?.full_name || 'Colega'

    const lines: string[] = []
    lines.push('*PLANTAO DISPONIVEL*')
    lines.push('----------------------------')
    lines.push('')
    lines.push(`Hospital: *${p.hospital}*`)
    if (p.especialidade) lines.push(`Especialidade: ${p.especialidade}`)
    if (p.classificacao && p.classificacao !== 'plantao') lines.push(`Setor: ${p.classificacao}`)
    if (p.turno) lines.push(`Turno: ${p.turno === 'dia' ? 'Diurno ☀️' : 'Noturno 🌙'}`)
    lines.push(`Data: ${dateBR}`)
    if (p.horas) lines.push(`Duracao: ${formatHoras(p.horas)}`)
    if (p.endereco) lines.push(`Local: ${p.endereco}`)
    if (shareShowValor && p.valor > 0) {
      lines.push(`Valor: R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    }
    if (shareNota.trim()) {
      lines.push('')
      lines.push(`Obs: ${shareNota.trim()}`)
    }
    lines.push('')
    lines.push('----------------------------')
    lines.push(`Contato: *${userName}*`)
    lines.push('Interessados, enviem mensagem!')
    lines.push('')
    lines.push('_Organizado com BEM Plantonista_')
    lines.push('https://bemplantonista.com.br')

    const msg = lines.join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    setShareTarget(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleHospitalChange = async (value: string) => {
    setFormData(prev => ({ ...prev, hospital: value }))
    if (value.length < 2) { setHospitalSuggestions([]); setShowSuggestions(false); return }
    try {
      const { data } = await supabase.from('plantoes').select('hospital, endereco, cep').ilike('hospital', `%${value}%`).limit(5)
      const unique = (data || []).reduce((acc: any[], p) => {
        if (!acc.find(h => h.hospital === p.hospital) && p.hospital) acc.push(p)
        return acc
      }, [])
      setHospitalSuggestions(unique); setShowSuggestions(true)
    } catch {}
  }

  const selectHospital = (h: any) => {
    setFormData(prev => ({ ...prev, hospital: h.hospital, endereco: h.endereco || '', cep: h.cep || '' }))
    setShowSuggestions(false)
  }

  const handleCepLookup = async () => {
    const cep = formData.cep.replace(/\D/g, '')
    if (cep.length !== 8) { alert('CEP inválido.'); return }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const d = await res.json()
      if (d.erro) { alert('CEP não encontrado.'); return }
      setFormData(prev => ({ ...prev, endereco: `${d.logradouro}, ${d.bairro}, ${d.localidade} - ${d.uf}` }))
    } catch { alert('Erro ao buscar CEP.') }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return
    try {
      const { error } = await supabase.from('plantoes').delete().eq('id', itemId).eq('user_id', user.id)
      if (error) { alert('Erro ao apagar item.'); return }
      invalidatePlantoes()
    } catch { alert('Erro ao apagar item.') }
  }

  // ── Loading / Not auth ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sessão expirada.</p>
          <button onClick={() => router.push('/login')} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors">Fazer Login</button>
        </div>
      </div>
    )
  }

  const isDataLoading = loading || (!!user && isPlantoesPending)

  // ── Calendar rendering data ──
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const calendarDays: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  // Fill remaining slots to complete last row
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

  // Month stats — only revenue-generating blocks count as "plantões"
  const monthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
  const nonRevenueKeys = new Set<string>(BLOCK_TYPES.filter(b => !b.revenue).map(b => b.key))

  const isRevenueEvent = (p: PlantaoListItem) => {
    const cls = (p.classificacao || '').toLowerCase()
    if (cls === 'folga' || cls === 'disponivel' || cls === 'disponível') return false
    if (nonRevenueKeys.has(cls)) return false
    // Custom non-revenue blocks: valor === 0 and classificacao not in standard revenue categories
    if (p.valor === 0 && cls !== '' && !['Sala Verde', 'Sala Amarela', 'Sala Vermelha', 'Outro'].includes(p.classificacao || '')) return false
    return true
  }

  const monthEvents = plantoes.filter(p => (p.data || '').split('T')[0].startsWith(monthPrefix))
  const monthPlantoes = monthEvents.filter(isRevenueEvent)
  const monthFolgas = monthEvents.filter(p => {
    const cls = (p.classificacao || '').toLowerCase()
    return cls === 'folga'
  })
  const monthRevenue = calcularValorEfetivo(monthPlantoes)
  const monthHours = monthPlantoes.reduce((s, p) => s + (p.horas || 0), 0)

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 overflow-auto w-full relative z-10">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-lg">☰</span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Escala</h1>
                  <p className="text-xs text-gray-500 hidden sm:block">Calendário mensal interativo</p>
                </div>
              </div>
              {/* Month stats — desktop (inline no header) */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Plantões</p>
                  <p className="text-sm font-bold text-gray-800">{monthPlantoes.length}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Folgas</p>
                  <p className="text-sm font-bold text-gray-500">{monthFolgas.length}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Faturamento</p>
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(monthRevenue)}</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Horas</p>
                  <p className="text-sm font-bold text-gray-800">{monthHours}h</p>
                </div>
              </div>
            </div>
            {/* Month stats — mobile (below title, always visible) */}
            <div className="sm:hidden flex items-center justify-between gap-2 mt-2 px-1">
              <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center border border-gray-100">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider leading-tight">Plantões</p>
                <p className="text-sm font-bold text-gray-800">{monthPlantoes.length}</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center border border-gray-100">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider leading-tight">Folgas</p>
                <p className="text-sm font-bold text-gray-500">{monthFolgas.length}</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center border border-gray-100">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider leading-tight">Faturamento</p>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(monthRevenue)}</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center border border-gray-100">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider leading-tight">Horas</p>
                <p className="text-sm font-bold text-gray-800">{monthHours}h</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => navigateMonth('prev')} className="p-2.5 rounded-xl hover:bg-white border border-gray-200/60 shadow-sm transition-all hover:shadow-md">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {(() => { const s = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) })()}
            </h2>
            <button onClick={() => navigateMonth('next')} className="p-2.5 rounded-xl hover:bg-white border border-gray-200/60 shadow-sm transition-all hover:shadow-md">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Plantão</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" />Folga</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Disponível</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Personalizado</span>
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <div key={i} className="py-2.5 md:py-3 text-center text-[10px] md:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <span className="md:hidden">{d}</span>
                  <span className="hidden md:inline">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i]}</span>
                </div>
              ))}
            </div>

            {/* Days */}
            {isDataLoading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[56px] md:min-h-[110px] border-b border-r border-gray-50 p-1.5">
                    <div className="animate-pulse">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-200 mb-1" />
                      <div className="hidden md:block space-y-1">
                        <div className="h-3 w-full rounded bg-gray-100" />
                        <div className="h-3 w-3/4 rounded bg-gray-100" />
                      </div>
                      <div className="md:hidden flex gap-1 mt-1">
                        <div className="w-2 h-2 rounded-full bg-gray-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="min-h-[56px] md:min-h-[110px] border-b border-r border-gray-50 bg-gray-50/30" />

                const events = getPlantoesForDay(day)
                const dayType = getDayType(events)
                const dateStr = fmt(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
                const isToday = dateStr === todayStr
                const realPlantoes = events.filter(e => e.classificacao !== 'folga' && e.classificacao !== 'disponivel')

                return (
                  <div
                    key={`day-${day}`}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[56px] md:min-h-[110px] border-b border-r border-gray-50 p-1 md:p-1.5 cursor-pointer transition-all duration-150 hover:bg-orange-50/40 active:bg-orange-100/40 relative group ${
                      isToday ? 'bg-orange-50/60 ring-1 ring-inset ring-orange-200' : ''
                    } ${dayType === 'folga' ? 'bg-gray-50' : ''} ${dayType === 'disponivel' ? 'bg-amber-50/40' : ''}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-0.5 md:mb-1">
                      <span className={`text-[11px] md:text-xs font-semibold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-orange-500 text-white' : 'text-gray-700 group-hover:text-orange-600'
                      }`}>{day}</span>
                      {/* Quick add indicator on hover — hidden on mobile */}
                      <span className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </span>
                    </div>

                    {/* Mobile: compact dot indicators */}
                    <div className="md:hidden flex flex-wrap gap-[3px] items-center">
                      {dayType === 'folga' && <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />}
                      {dayType === 'disponivel' && <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                      {realPlantoes.slice(0, 3).map((p) => {
                        const color = isCustomBlock(p)
                          ? getColorConfig(p.especialidade).dot
                          : 'bg-emerald-500'
                        return <span key={p.id} className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      })}
                      {realPlantoes.length > 3 && (
                        <span className="text-[8px] text-gray-400 font-bold">+{realPlantoes.length - 3}</span>
                      )}
                    </div>

                    {/* Desktop: full text badges */}
                    <div className="hidden md:flex flex-col gap-[3px] overflow-hidden max-h-[78px]">
                      {dayType === 'folga' && (
                        <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-gray-200/80 text-[10px] font-medium text-gray-500 leading-tight">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                          <span className="truncate">Folga</span>
                        </div>
                      )}
                      {dayType === 'disponivel' && (
                        <div className="flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-amber-100/80 text-[10px] font-medium text-amber-700 leading-tight">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="truncate">Disponível</span>
                        </div>
                      )}
                      {realPlantoes.slice(0, 3).map((p) => {
                        const cc = isCustomBlock(p) ? getColorConfig(p.especialidade) : getColorConfig('emerald')
                        return (
                          <div key={p.id} className={`flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium leading-tight ${cc.bg} border ${cc.border} ${cc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cc.dot}`} />
                            <span className="truncate">{getEventLabel(p)}</span>
                          </div>
                        )
                      })}
                      {realPlantoes.length > 3 && (
                        <p className="text-[9px] text-gray-400 pl-1 leading-tight">+{realPlantoes.length - 3} mais</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </div>
        </main>

        {/* ── Action Modal (Day Click) — Drawer on mobile ── */}
        {showActionModal && selectedDate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4" onClick={() => setShowActionModal(false)}>
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-sm w-full p-6 pb-8 md:pb-6 border border-gray-200/60 animate-[slideUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
              {/* Drag handle for mobile */}
              <div className="md:hidden flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                  </h3>
                  <p className="text-xs text-gray-400 capitalize">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
                </div>
                <button onClick={() => setShowActionModal(false)} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Show existing events for this day */}
              {(() => {
                const dayEvents = getPlantoesForDay(selectedDate.getDate())
                const real = dayEvents.filter(e => e.classificacao !== 'folga' && e.classificacao !== 'disponivel')
                if (real.length > 0) return (
                  <div className="mb-4 space-y-2">
                    {real.map(p => (
                      <div key={p.id} className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.hospital}</p>
                            <p className="text-[10px] text-gray-500">{formatHoras(p.horas)} · {p.especialidade || 'Geral'}</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600 ml-2">{formatCurrency(p.valor)}</p>
                        </div>
                        {/* Action buttons */}
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => handleSeriesEdit(p)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-white/80 hover:bg-sky-50 border border-sky-200/60 rounded-lg transition-all active:scale-[0.98]">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Editar
                          </button>
                          {p.valor > 0 && (
                            <button onClick={() => handleOpenPassarPlantao(p)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-white/80 hover:bg-emerald-50 border border-emerald-200/60 rounded-lg transition-all active:scale-[0.98]">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                              Passar
                            </button>
                          )}
                          <button onClick={() => handleSeriesDelete(p)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-white/80 hover:bg-red-50 border border-red-200/60 rounded-lg transition-all active:scale-[0.98]">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
                return null
              })()}

              {/* Show Disponível / Folga status with individual delete */}
              {(() => {
                const dayEvents = getPlantoesForDay(selectedDate.getDate())
                const disponivel = dayEvents.find(e => e.classificacao === 'disponivel')
                const folga = dayEvents.find(e => e.classificacao === 'folga')
                if (!disponivel && !folga) return null
                return (
                  <div className="mb-4 space-y-2">
                    {disponivel && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-amber-800">✓ Disponível</span>
                        <button onClick={() => handleDeleteItem(disponivel.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    {folga && (
                      <div className="p-3 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">☽ Folga</span>
                        <button onClick={() => handleDeleteItem(folga.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="space-y-2">
                <button onClick={handleOpenPlantaoForm} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200/60 text-emerald-800 font-medium text-sm transition-colors">
                  <span className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white text-xs">🏥</span>
                  Adicionar Plantão
                </button>
                <button onClick={() => handleAddStatus('disponivel')} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200/60 text-amber-800 font-medium text-sm transition-colors">
                  <span className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center text-white text-xs">✓</span>
                  Marcar Disponível
                </button>
                <button onClick={() => handleAddStatus('folga')} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200/60 text-gray-700 font-medium text-sm transition-colors">
                  <span className="w-9 h-9 rounded-lg bg-gray-400 flex items-center justify-center text-white text-xs">☽</span>
                  Marcar Folga
                </button>
                <button onClick={handleClearDay} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-red-50 active:bg-red-100 border border-gray-200/60 text-red-600 font-medium text-sm transition-colors">
                  <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-500 text-xs">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </span>
                  Apagar Informação do Dia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Conflict Confirmation Modal — Drawer on mobile ── */}
        {conflictData && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4" onClick={() => setConflictData(null)}>
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-sm w-full p-6 pb-8 md:pb-6 border border-gray-200/60 animate-[slideUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Conflito de Agenda</h3>
                  <p className="text-xs text-gray-400">Já existe plantão neste dia</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 mb-5">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Você já tem {conflictData.hospitals.length > 1 ? 'plantões cadastrados' : 'um plantão cadastrado'} neste dia em:
                </p>
                <div className="mt-2 space-y-1">
                  {conflictData.hospitals.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{h}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-3">Deseja realmente adicionar mais um plantão nesta data?</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConflictData(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmConflict}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all"
                >
                  Sim, Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal — Drawer on mobile ── */}
        {showDeleteConfirm && selectedDate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-sm w-full p-6 pb-8 md:pb-6 border border-gray-200/60 animate-[slideUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Confirmar Exclusão</h3>
                  <p className="text-xs text-gray-400">{selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 mb-5">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Tem certeza que deseja apagar <strong>todos os registros</strong> deste dia? Os plantões removidos serão descontados do faturamento do Dashboard.
                </p>
                {(() => {
                  const dayEvents = getPlantoesForDay(selectedDate.getDate())
                  const real = dayEvents.filter(e => e.classificacao !== 'folga' && e.classificacao !== 'disponivel')
                  if (real.length > 0) return (
                    <div className="mt-3 space-y-1">
                      {real.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span className="font-medium text-gray-800">{p.hospital}</span>
                          </span>
                          <span className="text-red-600 font-semibold">{formatCurrency(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )
                  return null
                })()}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmDeleteDay}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-red-500/20 hover:shadow-lg transition-all">
                  Sim, Apagar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Series Action Modal ── */}
        {seriesModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4" onClick={() => setSeriesModal(null)}>
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-sm w-full p-6 pb-8 md:pb-6 border border-gray-200/60 animate-[slideUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
              <div className="md:hidden flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${seriesModal.action === 'delete' ? 'bg-red-100' : 'bg-sky-100'}`}>
                  {seriesModal.action === 'delete' ? (
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  ) : (
                    <svg className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Plantão em série</h3>
                  <p className="text-xs text-gray-500">Este plantão faz parte de uma série de {seriesModal.siblings.length + 1} repetições</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200/60 rounded-xl p-4 mb-5">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Deseja {seriesModal.action === 'delete' ? 'apagar' : 'editar'} apenas este plantão ou todos os plantões desta série?
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (seriesModal.action === 'edit') {
                      handleEditShift(seriesModal.plantao)
                      setSeriesModal(null)
                    } else {
                      handleDeleteSingle(seriesModal.plantao)
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">1</span>
                  Apenas este plantão
                </button>
                <button
                  onClick={() => {
                    if (seriesModal.action === 'edit') {
                      setRecurrenceEnabled(true)
                      handleEditShift(seriesModal.plantao)
                      setSeriesModal(null)
                    } else {
                      handleDeleteSeries(seriesModal.plantao, seriesModal.siblings)
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    seriesModal.action === 'delete'
                      ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
                      : 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                    seriesModal.action === 'delete' ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-600'
                  }`}>{seriesModal.siblings.length + 1}</span>
                  Todos da série ({seriesModal.siblings.length + 1} plantões)
                </button>
                <button
                  onClick={() => setSeriesModal(null)}
                  className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Plantão Form Modal — Drawer on mobile ── */}
        {showPlantaoForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-md w-full p-6 pb-8 md:pb-6 border border-gray-200/60 max-h-[92vh] md:max-h-[90vh] overflow-y-auto animate-[slideUp_0.25s_ease-out]">
              {/* Drag handle for mobile */}
              <div className="md:hidden flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Editar Plantão' : 'Novo Evento'}</h3>
                <button onClick={() => { setShowPlantaoForm(false); setEditingId(null) }} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSavePlantao} className="space-y-4">
                {/* ── Tipo de Bloco ── */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Tipo de Evento</label>
                  <div className="flex flex-wrap gap-2">
                    {BLOCK_TYPES.map(bt => (
                      <button key={bt.key} type="button" onClick={() => setBlockType(bt.key)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          blockType === bt.key
                            ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 active:bg-gray-100'
                        }`}>
                        {bt.label}
                      </button>
                    ))}
                  </div>
                  {blockType === 'personalizado' && (
                    <input type="text" value={customBlockName} onChange={(e) => setCustomBlockName(e.target.value)}
                      className="mt-2 block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                      placeholder="Nome do evento (ex: Congresso, Consultório)" />
                  )}
                </div>

                {/* ── Seletor de Cor ── */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Cor do Evento</label>
                  <div className="flex flex-wrap gap-2.5">
                    {BLOCK_COLORS.map(c => (
                      <button key={c.key} type="button" onClick={() => setBlockColor(c.key)}
                        className={`w-7 h-7 rounded-full ${c.dot} transition-all ${
                          blockColor === c.key ? 'ring-2 ring-offset-2 ring-orange-400 scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                        title={c.label} />
                    ))}
                  </div>
                </div>

                {/* Hospital — only for revenue blocks */}
                {isRevenueBlock && (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Hospital/Local *</label>
                  <input type="text" name="hospital" value={formData.hospital} onChange={(e) => handleHospitalChange(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="Nome do hospital" required />
                  {showSuggestions && hospitalSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
                      {hospitalSuggestions.map((h, i) => (
                        <div key={i} onClick={() => selectHospital(h)} className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-900">{h.hospital}</span>
                          {h.endereco && <span className="block text-[10px] text-gray-400">{h.endereco}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Date + Value row */}
                <div className={`grid gap-3 ${isRevenueBlock ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Data *</label>
                    <input type="date" name="data" value={formData.data} onChange={handleInputChange}
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" required />
                  </div>
                  {isRevenueBlock && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{recurrenceEnabled && tipoRemuneracao === 'fixo_mensal' ? 'Valor fixo mensal (R$) *' : 'Valor (R$) *'}</label>
                    <input type="number" name="valor" value={formData.valor} onChange={handleInputChange} step="0.01" min="0"
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="0,00" required />
                  </div>
                  )}
                </div>

                {/* Hours + Specialty — only for revenue */}
                {isRevenueBlock && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Duração (h)</label>
                    <input type="number" name="horas" value={formData.horas} onChange={handleInputChange} step="0.5" min="0" required
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="Ex: 12" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Especialidade</label>
                    <select name="especialidade" value={formData.especialidade} onChange={handleInputChange}
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-white">
                      <option value="">Selecione...</option>
                      <option value="Clínica Médica">Clínica Médica</option>
                      <option value="Pediatria">Pediatria</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
                )}

                {/* CEP + Endereço — only for revenue */}
                {isRevenueBlock && (
                <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">CEP</label>
                  <div className="flex gap-2">
                    <input type="text" name="cep" value={formData.cep} onChange={handleInputChange} maxLength={9}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="00000-000" />
                    <button type="button" onClick={handleCepLookup} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">Buscar</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Endereço</label>
                  <input type="text" name="endereco" value={formData.endereco} onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="Endereço completo" />
                </div>

                {/* Data prevista pagamento */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Data Prevista de Pagamento</label>
                  <input type="date" name="data_prevista_pagamento" value={formData.data_prevista_pagamento} onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => {
                      if (!formData.data) return
                      const b = new Date(formData.data + 'T00:00:00'); b.setDate(b.getDate() + 30)
                      setFormData(prev => ({ ...prev, data_prevista_pagamento: fmt(b), prazo_pagamento_dias: '30' }))
                    }} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${formData.prazo_pagamento_dias === '30' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                      30 dias
                    </button>
                    <button type="button" onClick={() => {
                      if (!formData.data) return
                      const b = new Date(formData.data + 'T00:00:00')
                      const nm = new Date(b.getFullYear(), b.getMonth() + 1, 15)
                      const diff = Math.round((nm.getTime() - b.getTime()) / 86400000)
                      setFormData(prev => ({ ...prev, data_prevista_pagamento: fmt(nm), prazo_pagamento_dias: String(diff) }))
                    }} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-orange-300 transition-all">
                      Dia 15 prox. mês
                    </button>
                  </div>
                </div>

                {/* Setor */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Setor/Classificação</label>
                  <select name="classificacao" value={formData.classificacao} onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-white">
                    <option value="">Selecione...</option>
                    <option value="Sala Verde">Sala Verde</option>
                    <option value="Sala Amarela">Sala Amarela</option>
                    <option value="Sala Vermelha">Sala Vermelha</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {/* Turno */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Turno</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, turno: prev.turno === 'dia' ? '' : 'dia' }))}
                      className={`flex-1 py-2.5 px-3 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                        formData.turno === 'dia' ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                      }`}>
                      <span>☀️</span> Diurno
                    </button>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, turno: prev.turno === 'noite' ? '' : 'noite' }))}
                      className={`flex-1 py-2.5 px-3 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                        formData.turno === 'noite' ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}>
                      <span>🌙</span> Noturno
                    </button>
                  </div>
                </div>
                </>
                )}

                {/* ── Recorrência ── */}
                <div className="border border-gray-200/60 rounded-xl p-4 space-y-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Repetir este plantão</p>
                      <p className="text-[10px] text-gray-400">Cadastre em lote para o mês</p>
                    </div>
                    <button type="button" onClick={() => setRecurrenceEnabled(!recurrenceEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${recurrenceEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${recurrenceEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  {recurrenceEnabled && (
                    <div className="space-y-3 pt-1">
                      {/* Tipo de remuneração — só para blocos de receita */}
                      {isRevenueBlock && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de remuneração</label>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setTipoRemuneracao('por_plantao')}
                              className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                                tipoRemuneracao === 'por_plantao' ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                              }`}>
                              Por plantão
                            </button>
                            <button type="button" onClick={() => setTipoRemuneracao('fixo_mensal')}
                              className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                                tipoRemuneracao === 'fixo_mensal' ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                              }`}>
                              Valor fixo mensal
                            </button>
                          </div>
                          {tipoRemuneracao === 'fixo_mensal' && (
                            <p className="text-[10px] text-amber-600 mt-1.5">O valor informado é o total do mês — não será multiplicado por ocorrência.</p>
                          )}
                        </div>
                      )}

                      {/* Frequency */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Frequência</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setRecurrenceFreq('weekly')}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                              recurrenceFreq === 'weekly' ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                            }`}>
                            Semanalmente
                          </button>
                          <button type="button" onClick={() => setRecurrenceFreq('biweekly')}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                              recurrenceFreq === 'biweekly' ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                            }`}>
                            Quinzenalmente
                          </button>
                        </div>
                      </div>

                      {/* Limit type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Limite de repetição</label>
                        <div className="flex gap-2 mb-2">
                          <button type="button" onClick={() => setRecurrenceLimitType('count')}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                              recurrenceLimitType === 'count' ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                            }`}>
                            Nº de semanas
                          </button>
                          <button type="button" onClick={() => setRecurrenceLimitType('date')}
                            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                              recurrenceLimitType === 'date' ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                            }`}>
                            Até uma data
                          </button>
                        </div>

                        {recurrenceLimitType === 'count' ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              <button type="button"
                                onClick={() => setRecurrenceLimitCount(prev => Math.max(2, prev - 1))}
                                className="w-9 h-9 flex items-center justify-center rounded-l-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600 font-bold text-lg transition-colors select-none">
                                −
                              </button>
                              <input type="text" inputMode="numeric" pattern="[0-9]*"
                                value={recurrenceLimitCount === 0 ? '' : recurrenceLimitCount}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '')
                                  if (raw === '') { setRecurrenceLimitCount(0 as any); return }
                                  const n = parseInt(raw, 10)
                                  setRecurrenceLimitCount(Math.min(26, n))
                                }}
                                onBlur={() => { if (!recurrenceLimitCount || recurrenceLimitCount < 2) setRecurrenceLimitCount(2) }}
                                className="w-12 h-9 border-y border-gray-200 text-sm text-center font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:z-10" />
                              <button type="button"
                                onClick={() => setRecurrenceLimitCount(prev => Math.min(26, (prev || 2) + 1))}
                                className="w-9 h-9 flex items-center justify-center rounded-r-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600 font-bold text-lg transition-colors select-none">
                                +
                              </button>
                            </div>
                            <span className="text-xs text-gray-500">ocorrências ({recurrenceFreq === 'weekly' ? 'semanas' : 'quinzenas'})</span>
                          </div>
                        ) : (
                          <input type="date" value={recurrenceLimitDate}
                            onChange={(e) => setRecurrenceLimitDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                        )}
                      </div>

                      {/* Preview of dates */}
                      {formData.data && (
                        <div className="bg-white rounded-lg border border-gray-200/60 p-3">
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Datas que serão criadas:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {generateRecurrenceDates(formData.data).slice(0, 8).map((d, i) => (
                              <span key={d} className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${
                                i === 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {d.split('-').reverse().join('/')}
                              </span>
                            ))}
                            {generateRecurrenceDates(formData.data).length > 8 && (
                              <span className="px-2 py-0.5 text-[10px] text-gray-400">+{generateRecurrenceDates(formData.data).length - 8} mais</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPlantaoForm(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingPlantao}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                    {savingPlantao ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Salvando...
                      </span>
                    ) : editingId
                      ? 'Atualizar Plantão'
                      : recurrenceEnabled
                        ? `Salvar ${generateRecurrenceDates(formData.data || todayStr).length} Plantões`
                        : 'Salvar Plantão'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Passar Plantão — Share Config Drawer ── */}
        {shareTarget && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4" onClick={() => setShareTarget(null)}>
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-sm w-full p-6 pb-8 md:pb-6 border border-gray-200/60 animate-[slideUp_0.25s_ease-out]" onClick={e => e.stopPropagation()}>
              {/* Drag handle */}
              <div className="md:hidden flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Passar Plantão</h3>
                    <p className="text-[10px] text-gray-400">Compartilhe no grupo do hospital</p>
                  </div>
                </div>
                <button onClick={() => setShareTarget(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Preview card */}
              <div className="rounded-xl bg-gray-50 border border-gray-200/60 p-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-sm font-semibold text-gray-900">{shareTarget.hospital}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>📅 {new Date(shareTarget.data.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  {shareTarget.horas ? <span>⏱️ {formatHoras(shareTarget.horas)}</span> : null}
                  {shareTarget.endereco ? <span className="truncate max-w-[200px]">📍 {shareTarget.endereco}</span> : null}
                </div>
              </div>

              {/* Privacy toggles */}
              <div className="space-y-3 mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Privacidade</p>
                {/* Show valor toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200/60">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Exibir valor do plantão</p>
                    <p className="text-[10px] text-gray-400">R$ {shareTarget.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <button type="button" onClick={() => setShareShowValor(!shareShowValor)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${shareShowValor ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${shareShowValor ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {/* Custom note */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Observação (opcional)</label>
                  <input type="text" value={shareNota} onChange={(e) => setShareNota(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="Ex: Preciso trocar por motivo pessoal" maxLength={120} />
                  <p className="text-[10px] text-gray-400 mt-1">{shareNota.length}/120 caracteres</p>
                </div>
              </div>

              {/* Send button */}
              <button onClick={handlePassarPlantaoWhatsApp}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-[0.98]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                Enviar pelo WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}