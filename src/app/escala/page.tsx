'use client'

import React, { useState } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Sidebar from '../../components/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { fetchPlantoesByUser, plantoesKeys, type PlantaoListItem } from '@/lib/queries/plantoes'

export default function EscalaPage() {
  const { user, loading } = useAuthGuard()
  const queryClient = useQueryClient()

  const { data: plantoes = [] } = useQuery({
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
    classificacao: '', especialidade: '',
  })
  const [hospitalSuggestions, setHospitalSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const router = useRouter()

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

  const handleOpenPlantaoForm = () => {
    setShowActionModal(false)
    setShowPlantaoForm(true)
    if (selectedDate) setFormData(prev => ({ ...prev, data: fmt(selectedDate) }))
  }

  const handleClearDay = async () => {
    if (!user || !selectedDate) return
    if (!confirm('Apagar todos os registros deste dia?')) return
    const dateStr = fmt(selectedDate)
    try {
      const { error } = await supabase.from('plantoes').delete().eq('data', dateStr).eq('user_id', user.id)
      if (error) { alert('Erro: ' + error.message); return }
      setShowActionModal(false)
      invalidatePlantoes()
    } catch { alert('Erro ao limpar. Tente novamente.') }
  }

  const handleSavePlantao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!formData.hospital || !formData.data || !formData.valor) {
      alert('Preencha hospital, data e valor.'); return
    }
    const autoStatus = formData.data < todayStr ? 'realizado' : 'pendente'
    let prazoDias: number | null = formData.prazo_pagamento_dias ? parseInt(formData.prazo_pagamento_dias) : null
    if (formData.data_prevista_pagamento && formData.data && !prazoDias) {
      const diff = Math.round((new Date(formData.data_prevista_pagamento + 'T00:00:00').getTime() - new Date(formData.data + 'T00:00:00').getTime()) / 86400000)
      prazoDias = diff > 0 ? diff : null
    }
    try {
      const { error } = await supabase.from('plantoes').insert([{
        user_id: user.id, hospital: formData.hospital.trim(), data: formData.data,
        valor: parseFloat(formData.valor), status: autoStatus,
        horas: formData.horas ? parseFloat(formData.horas) : 0,
        endereco: formData.endereco?.trim() || null,
        data_prevista_pagamento: formData.data_prevista_pagamento || null,
        prazo_pagamento_dias: prazoDias,
        classificacao: formData.classificacao || null,
        especialidade: formData.especialidade || null
      }]).select()
      if (error) { alert('Erro: ' + error.message); return }
      setShowPlantaoForm(false)
      setFormData({ hospital: '', data: '', valor: '', status: 'pendente', horas: '', endereco: '', cep: '', data_prevista_pagamento: '', prazo_pagamento_dias: '', classificacao: '', especialidade: '' })
      invalidatePlantoes()
    } catch { alert('Erro ao salvar plantão.') }
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

  // ── Calendar rendering data ──
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const calendarDays: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  // Fill remaining slots to complete last row
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

  // Month stats
  const monthPlantoes = plantoes.filter(p => {
    const d = (p.data || '').split('T')[0]
    const prefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    return d.startsWith(prefix) && p.classificacao !== 'folga' && p.classificacao !== 'disponivel'
  })
  const monthRevenue = monthPlantoes.reduce((s, p) => s + (p.valor || 0), 0)
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
              {/* Month stats */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Plantões</p>
                  <p className="text-sm font-bold text-gray-800">{monthPlantoes.length}</p>
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
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => navigateMonth('prev')} className="p-2.5 rounded-xl hover:bg-white border border-gray-200/60 shadow-sm transition-all hover:shadow-md">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900 capitalize">
              {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
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
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="min-h-[90px] md:min-h-[110px] border-b border-r border-gray-50 bg-gray-50/30" />

                const events = getPlantoesForDay(day)
                const dayType = getDayType(events)
                const dateStr = fmt(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
                const isToday = dateStr === todayStr
                const realPlantoes = events.filter(e => e.classificacao !== 'folga' && e.classificacao !== 'disponivel')

                return (
                  <div
                    key={`day-${day}`}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[90px] md:min-h-[110px] border-b border-r border-gray-50 p-1.5 cursor-pointer transition-all duration-150 hover:bg-orange-50/40 relative group ${
                      isToday ? 'bg-orange-50/60 ring-1 ring-inset ring-orange-200' : ''
                    } ${dayType === 'folga' ? 'bg-gray-50' : ''} ${dayType === 'disponivel' ? 'bg-amber-50/40' : ''}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-orange-500 text-white' : 'text-gray-700 group-hover:text-orange-600'
                      }`}>{day}</span>
                      {/* Quick add indicator on hover */}
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </span>
                    </div>

                    {/* Events */}
                    <div className="space-y-0.5 overflow-hidden">
                      {dayType === 'folga' && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-200/80 text-[10px] font-medium text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                          <span className="truncate">Folga</span>
                        </div>
                      )}
                      {dayType === 'disponivel' && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100/80 text-[10px] font-medium text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="truncate">Disponível</span>
                        </div>
                      )}
                      {realPlantoes.slice(0, 2).map(p => (
                        <div key={p.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[10px] font-medium text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="truncate">{p.hospital}</span>
                        </div>
                      ))}
                      {realPlantoes.length > 2 && (
                        <p className="text-[9px] text-gray-400 pl-1">+{realPlantoes.length - 2} mais</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>

        {/* ── Action Modal (Day Click) ── */}
        {showActionModal && selectedDate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setShowActionModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200/60" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                  </h3>
                  <p className="text-xs text-gray-400 capitalize">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
                </div>
                <button onClick={() => setShowActionModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
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
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.hospital}</p>
                          <p className="text-[10px] text-gray-500">{p.horas}h · {p.especialidade || 'Geral'}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-600 ml-2">{formatCurrency(p.valor)}</p>
                      </div>
                    ))}
                  </div>
                )
                return null
              })()}

              <div className="space-y-2">
                <button onClick={handleOpenPlantaoForm} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-800 font-medium text-sm transition-colors">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white text-xs">🏥</span>
                  Adicionar Plantão
                </button>
                <button onClick={() => handleAddStatus('disponivel')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/60 text-amber-800 font-medium text-sm transition-colors">
                  <span className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-white text-xs">✓</span>
                  Marcar Disponível
                </button>
                <button onClick={() => handleAddStatus('folga')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200/60 text-gray-700 font-medium text-sm transition-colors">
                  <span className="w-8 h-8 rounded-lg bg-gray-400 flex items-center justify-center text-white text-xs">☽</span>
                  Marcar Folga
                </button>
                <button onClick={handleClearDay} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 border border-gray-200/60 text-red-600 font-medium text-sm transition-colors">
                  <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-500 text-xs">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </span>
                  Apagar Informação do Dia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Plantão Form Modal ── */}
        {showPlantaoForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200/60 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Novo Plantão</h3>
                <button onClick={() => setShowPlantaoForm(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSavePlantao} className="space-y-4">
                {/* Hospital */}
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

                {/* Date + Value row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Data *</label>
                    <input type="date" name="data" value={formData.data} onChange={handleInputChange}
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Valor (R$) *</label>
                    <input type="number" name="valor" value={formData.valor} onChange={handleInputChange} step="0.01" min="0"
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="0,00" required />
                  </div>
                </div>

                {/* Hours + Specialty */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Duração (h)</label>
                    <input type="number" name="horas" value={formData.horas} onChange={handleInputChange} step="0.5" min="0"
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" placeholder="12" />
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

                {/* CEP + Endereço */}
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

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPlantaoForm(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all">
                    Salvar Plantão
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