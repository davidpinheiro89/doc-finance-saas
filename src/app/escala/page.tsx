// Forçando novo deploy - Versão Limpa 2.0
'use client'

import React, { useState, useEffect } from 'react'
import supabase from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

// Error boundary component
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    console.error('ErrorBoundary caught error:', error)
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: 'red', color: 'white', padding: '20px', minHeight: '100vh' }}>
          <h1>Erro na Aplicação</h1>
          <p>Ocorreu um erro ao carregar a página de escala.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function EscalaPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [plantoes, setPlantoes] = useState<any[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showPlantaoForm, setShowPlantaoForm] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    message: string
    onConfirm: () => void
  } | null>(null)
  const [formData, setFormData] = useState({
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
    local_favorito_id: ''
  })
  const [hospitalSuggestions, setHospitalSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    checkAuth()
    console.log('Componente montado com sucesso')

    const handleSidebarClose = () => setIsSidebarOpen(false)
    window.addEventListener('closeSidebar', handleSidebarClose)
    return () => window.removeEventListener('closeSidebar', handleSidebarClose)
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user } }: any = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      await fetchPlantoes(user.id)
    } catch (error) {
      console.error('Erro de autenticação:', error)
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
        .eq('user_id', userId)

      if (error) { setPlantoes([]); setLoading(false); return }
      setPlantoes(data || [])
      setLoading(false)
    } catch {
      setPlantoes([])
      setLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

  const getFirstDayOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const formatDateYYYYMMDD = (date: Date) =>
    date.toISOString().split('T')[0]

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() + (direction === 'prev' ? -1 : 1))
      return newMonth
    })
  }

  const handleDayClick = (day: number) => {
    const selectedDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    setSelectedDate(selectedDay)
    setShowActionModal(true)
  }

  const getPlantoesForDay = (day: number) => {
    const dateStr = formatDateYYYYMMDD(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
    return plantoes.filter(p => (p.data ? p.data.split('T')[0] : '') === dateStr)
  }

  // ── Helpers para checar o que tem no dia ──
  const getDayPlantoes = (dateStr: string) =>
    plantoes.filter(p => (p.data ? p.data.split('T')[0] : '') === dateStr && p.tipo_evento === 'plantao')

  const getDayStatus = (dateStr: string, tipo: 'disponivel' | 'folga') =>
    plantoes.find(p => (p.data ? p.data.split('T')[0] : '') === dateStr && p.tipo_evento === tipo)

  // ── Modal de confirmação genérico ──
  const askConfirm = (message: string, onConfirm: () => void) => {
    setConfirmConfig({ message, onConfirm })
    setShowConfirmModal(true)
  }

  // ── Salvar disponível ou folga (com lógica de substituição) ──
  const handleAddStatus = async (status: 'disponivel' | 'folga') => {
    if (!user || !selectedDate) return
    const dateStr = formatDateYYYYMMDD(selectedDate)

    const plantoesDoDia = getDayPlantoes(dateStr)
    const temPlantao = plantoesDoDia.length > 0
    const label = status === 'disponivel' ? 'Disponível' : 'Folga'

    const doSave = async () => {
      try {
        // Remove tudo do dia antes de inserir o novo status
        await supabase.from('plantoes').delete().eq('data', dateStr)

        const statusData = {
          data: dateStr,
          tipo_evento: status,
          status: 'confirmado',
          hospital: status === 'disponivel' ? '🟢 Disponível' : '🔴 Folga',
          valor: 0,
          horas: 0,
          endereco: '',
          cep: '',
          data_prevista_pagamento: dateStr,
          prazo_pagamento_dias: 0,
          classificacao: status,
          especialidade: ''
        }

        const { error } = await supabase.from('plantoes').insert([statusData]).select()
        if (error) { alert('Erro ao salvar: ' + error.message); return }

        setShowActionModal(false)
        setShowConfirmModal(false)
        await fetchPlantoes(user.id)
      } catch {
        alert('Erro ao salvar. Tente novamente.')
      }
    }

    if (temPlantao) {
      askConfirm(
        `Já existe um plantão neste dia. Deseja substituir pelo status "${label}"?`,
        doSave
      )
    } else {
      await doSave()
    }
  }

  // ── Iniciar fluxo de adicionar plantão (com lógica de confirmação) ──
  const handleStatusChange = async (status: 'disponivel' | 'folga' | 'plantao') => {
    if (status !== 'plantao') {
      await handleAddStatus(status)
      return
    }

    if (!selectedDate) return
    const dateStr = formatDateYYYYMMDD(selectedDate)
    const plantoesDoDia = getDayPlantoes(dateStr)
    const temDisponivel = getDayStatus(dateStr, 'disponivel')
    const temFolga = getDayStatus(dateStr, 'folga')

    const abrirFormulario = async (limparDia = false) => {
      if (limparDia) {
        await supabase.from('plantoes').delete().eq('data', dateStr)
        await fetchPlantoes(user.id)
      }
      setShowActionModal(false)
      setShowConfirmModal(false)
      setShowPlantaoForm(true)
      setFormData(prev => ({ ...prev, data: dateStr }))
    }

    if (temDisponivel || temFolga) {
      // Substitui disponível/folga direto, sem perguntar
      await abrirFormulario(true)
    } else if (plantoesDoDia.length > 0) {
      // Já tem plantão — pergunta se quer adicionar mais
      askConfirm(
        `Este dia já possui ${plantoesDoDia.length} plantão(ões). Deseja adicionar outro plantão neste dia?`,
        () => abrirFormulario(false)
      )
    } else {
      await abrirFormulario(false)
    }
  }

  const handleSavePlantao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { alert('Usuário não autenticado'); return }

    try {
      if (!formData.hospital || !formData.data || !formData.valor || !user.id) {
        alert('Preencha todos os campos obrigatórios.')
        return
      }

      const selectedDateObj = new Date(formData.data)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const autoStatus = selectedDateObj < today ? 'realizado' : 'pendente'

      const plantaoData = {
        usuario_id: user.id,
        tipo_evento: 'plantao',
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

      const { error } = await supabase.from('plantoes').insert([plantaoData]).select()
      if (error) { alert('Erro ao salvar plantão: ' + error.message); return }

      setShowPlantaoForm(false)
      setFormData({
        hospital: '', data: '', valor: '', status: 'pendente', horas: '',
        endereco: '', cep: '', data_prevista_pagamento: '', prazo_pagamento_dias: '',
        classificacao: '', especialidade: '', local_favorito_id: ''
      })
      await fetchPlantoes(user.id)
    } catch {
      alert('Erro ao salvar plantão. Tente novamente.')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleHospitalChange = async (value: string) => {
    setFormData(prev => ({ ...prev, hospital: value }))
    if (value.length < 2) { setHospitalSuggestions([]); setShowSuggestions(false); return }

    try {
      const { data, error } = await supabase
        .from('plantoes').select('hospital, endereco, cep')
        .ilike('hospital', `%${value}%`).limit(5)

      if (error) return
      const uniqueHospitals = data?.reduce((acc: any[], p) => {
        if (!acc.find((h: any) => h.hospital === p.hospital) && p.hospital)
          acc.push({ hospital: p.hospital, endereco: p.endereco, cep: p.cep })
        return acc
      }, []) || []
      setHospitalSuggestions(uniqueHospitals)
      setShowSuggestions(true)
    } catch { }
  }

  const selectHospital = (hospital: any) => {
    setFormData(prev => ({ ...prev, hospital: hospital.hospital, endereco: hospital.endereco || '', cep: hospital.cep || '' }))
    setShowSuggestions(false)
    setHospitalSuggestions([])
  }

  const handleCepLookup = async () => {
    const cep = formData.cep.replace(/\D/g, '')
    if (cep.length !== 8) { alert('CEP inválido. Digite 8 dígitos.'); return }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()
      if (data.erro) { alert('CEP não encontrado.'); return }
      setFormData(prev => ({ ...prev, endereco: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}` }))
    } catch { alert('Erro ao buscar CEP. Tente novamente.') }
  }

  const handleClearDay = async () => {
    if (!selectedDate) return
    const dateStr = formatDateYYYYMMDD(selectedDate)
    try {
      const { error } = await supabase.from('plantoes').delete().eq('data', dateStr)
      if (error) { alert('Erro ao limpar o dia.'); return }
      setShowActionModal(false)
      await fetchPlantoes(user.id)
    } catch { alert('Erro ao limpar o dia.') }
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Sessão Expirada</h1>
          <p className="text-gray-600 mb-6">Sua sessão expirou. Por favor, faça login novamente.</p>
          <button onClick={() => router.push('/login')} className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Fazer Login
          </button>
        </div>
      </div>
    )
  }

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 border rounded-md">
            <span className="h-6 w-6">☰</span>
          </button>
          <h1 className="text-xl font-bold">Escala de Plantões</h1>
          <button onClick={handleLogout} className="text-gray-600 text-sm">Sair</button>
        </header>

        <Sidebar user={user} isSidebarOpen={isSidebarOpen} />

        <main className="flex-1 p-4 md:p-8 w-full max-w-full overflow-x-hidden">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Escala de Plantões</h1>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center">
              <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <span className="text-xl">◀</span>
              </button>
              <h2 className="text-xl font-semibold text-gray-800">
                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <span className="text-xl">▶</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayPlantoes = getPlantoesForDay(day)
                const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()
                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 border ${isToday ? 'border-orange-400 bg-orange-50' : 'border-transparent'}`}
                  >
                    <span className={`${isToday ? 'bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs' : 'text-gray-700'}`}>
                      {day}
                    </span>
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayPlantoes.slice(0, 3).map((p, idx) => (
                        <span key={idx} className={`w-1.5 h-1.5 rounded-full ${p.tipo_evento === 'disponivel' ? 'bg-green-500' : p.tipo_evento === 'folga' ? 'bg-red-400' : 'bg-blue-500'}`} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legenda */}
            <div className="flex gap-4 mt-4 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Plantão</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Disponível</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Folga</span>
            </div>
          </div>
        </main>

        {/* ── Modal de ações do dia ── */}
        {showActionModal && selectedDate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 md:items-center">
            <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-sm mx-0 md:mx-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  {(() => {
                    const dateStr = formatDateYYYYMMDD(selectedDate)
                    const dayPlantoes = getDayPlantoes(dateStr)
                    if (dayPlantoes.length > 0) {
                      return dayPlantoes.map((p, i) => (
                        <div key={i} className="mt-2 p-2 bg-blue-50 rounded-lg flex justify-between items-center">
                          <span className="text-sm font-medium text-blue-800">{p.hospital}</span>
                          <span className="text-sm text-blue-600">R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))
                    }
                    return null
                  })()}
                </div>
                <button onClick={() => setShowActionModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleStatusChange('plantao')}
                  className="w-full px-4 py-3 bg-green-50 text-green-800 border border-green-200 rounded-xl hover:bg-green-100 transition-colors flex items-center gap-3 font-medium"
                >
                  <span className="text-lg">🏥</span> Adicionar Plantão
                </button>
                <button
                  onClick={() => handleStatusChange('disponivel')}
                  className="w-full px-4 py-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors flex items-center gap-3 font-medium"
                >
                  <span className="text-lg">✏️</span> Marcar Disponível
                </button>
                <button
                  onClick={() => handleStatusChange('folga')}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-3 font-medium"
                >
                  <span className="text-lg">3</span> Marcar Folga
                </button>
                <button
                  onClick={handleClearDay}
                  className="w-full px-4 py-3 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors flex items-center gap-3 font-medium"
                >
                  <span className="text-lg">🗑️</span> Apagar Informação do Dia
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal de confirmação genérico ── */}
        {showConfirmModal && confirmConfig && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-base font-semibold text-gray-800 mb-2">Confirmação</h3>
              <p className="text-sm text-gray-600 mb-6">{confirmConfig.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmConfig.onConfirm}
                  className="flex-1 py-2.5 px-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium text-sm"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Formulário de novo plantão ── */}
        {showPlantaoForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Agendar Novo Plantão</h3>
              <form onSubmit={handleSavePlantao} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hospital/Local</label>
                  <div className="relative">
                    <input type="text" name="hospital" value={formData.hospital}
                      onChange={(e) => handleHospitalChange(e.target.value)}
                      className="w-full block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Nome do hospital" required />
                    {showSuggestions && hospitalSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
                        {hospitalSuggestions.map((h, i) => (
                          <div key={i} onClick={() => selectHospital(h)}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0">
                            <div className="font-medium text-gray-900">{h.hospital}</div>
                            {h.endereco && <div className="text-xs text-gray-500">{h.endereco}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data do Plantão</label>
                  <input type="date" name="data" value={formData.data} onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor (R$)</label>
                  <input type="number" name="valor" value={formData.valor} onChange={handleInputChange}
                    step="0.01" min="0" placeholder="0.00"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duração (Horas)</label>
                  <input type="number" name="horas" value={formData.horas} onChange={handleInputChange}
                    step="0.5" min="0" placeholder="12"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                  <div className="flex space-x-2">
                    <input type="text" name="cep" value={formData.cep} onChange={handleInputChange}
                      maxLength={9} placeholder="00000-000"
                      className="flex-1 block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <button type="button" onClick={handleCepLookup}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors">
                      Buscar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                  <input type="text" name="endereco" value={formData.endereco || ''} onChange={handleInputChange}
                    placeholder="Endereço completo"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prazo de Pagamento (dias)</label>
                  <input type="number" name="prazo_pagamento_dias" value={formData.prazo_pagamento_dias} onChange={handleInputChange}
                    min="1" max="365" placeholder="30"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <p className="text-xs text-gray-500 mt-1">Dias após a data do plantão para pagamento</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Classificação/Setor</label>
                  <select name="classificacao" value={formData.classificacao} onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">Selecione...</option>
                    <option value="Sala Verde">Sala Verde</option>
                    <option value="Sala Amarela">Sala Amarela</option>
                    <option value="Sala Vermelha">Sala Vermelha</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Especialidade</label>
                  <select name="especialidade" value={formData.especialidade} onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">Selecione...</option>
                    <option value="Clínica Médica">Clínica Médica</option>
                    <option value="Pediatria">Pediatria</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div className="flex space-x-2 mt-4">
                  <button type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                    Cadastrar Plantão
                  </button>
                  <button type="button" onClick={() => setShowPlantaoForm(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
