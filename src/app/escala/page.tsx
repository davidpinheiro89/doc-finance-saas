// Forçando novo deploy - Versão Limpa 2.0
'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Sidebar from '../../components/Sidebar'

// Error boundary component
interface ErrorBoundaryState {
  hasError: boolean
}

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
  const [locaisFavoritos, setLocaisFavoritos] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchLocaisFavoritos()
    console.log('Componente montado com sucesso')
  }, [])

  const fetchLocaisFavoritos = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('locais_favoritos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching favorite locations:', error)
        return
      }

      setLocaisFavoritos(data || [])
    } catch (error) {
      console.error('Error fetching favorite locations:', error)
    }
  }

  const checkAuth = async () => {
    try {
      const { data: { user } }: any = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      await fetchPlantoes(user.id)
    } catch (error) {
      console.error('Erro de autenticação:', error)
      
      if ((error as any)?.message?.includes('grant_type=password') || (error as any)?.status === 400) {
        console.error('Erro de grant_type/password detectado')
        router.push('/login')
        return
      }
      
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlantoes = async (userId: string) => {
    try {
      console.log('🔄 INICIANDO BUSCA DE PLANTÕES...')
      
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')

      if (error) {
        console.error('❌ ERRO EXATO DO SUPABASE:', error)
        setPlantoes([])
        setLoading(false)
        return
      }

      console.log('✅ Dados carregados do Supabase:', data?.length || 0, 'registros')
      setPlantoes(data || [])
      setLoading(false)
    } catch (error) {
      console.error('❌ ERRO GERAL NA BUSCA:', error)
      setPlantoes([])
      setLoading(false)
    }
  }

  // Calculate hospital efficiency data
  const getHospitalEfficiencyData = () => {
    if (!plantoes || plantoes.length === 0) return []
    
    // Use ALL plantoes to match Valor Total card (no month filter)
    const allPlantoes = plantoes.filter(p => 
      p.hospital && 
      p.hospital !== '🟢 Disponível' && 
      p.hospital !== '🔴 Folga'
    )
    
    console.log('📊 Plantões totais para gráfico:', allPlantoes.length, 'itens')
    console.log('📊 Plantões detalhados:', allPlantoes)
    
    // Group by hospital and sum values
    const hospitalData = allPlantoes.reduce((acc, plantao) => {
      const hospital = (plantao.hospital || 'Não informado').trim()
      if (!acc[hospital]) {
        acc[hospital] = 0
      }
      acc[hospital] += Number(plantao.valor || 0)
      return acc
    }, {} as Record<string, number>)
    
    console.log('📊 Dados agrupados por hospital:', hospitalData)
    console.dir(hospitalData)
    
    // Convert to chart data format and filter out non-finite values
    const chartData = Object.entries(hospitalData)
      .map(([hospital, totalValue]) => ({
        hospital: hospital.length > 15 ? hospital.substring(0, 15) + '...' : hospital,
        valor: Number(totalValue || 0)
      }))
      .filter(d => isFinite(d.valor) && d.valor > 0) // Remove non-finite values
      .sort((a, b) => b.valor - a.valor)
    
    console.log('Dados Limpos para o Gráfico:', chartData)
    return chartData
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDateYYYYMMDD = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1)
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1)
      }
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
    return plantoes.filter(plantao => {
      const plantaoDate = plantao.data ? plantao.data.split('T')[0] : ''
      return plantaoDate === dateStr
    })
  }

  const handleAddStatus = async (status: 'disponivel' | 'folga') => {
    if (!user) {
      alert('Usuário não autenticado')
      return
    }

    if (!selectedDate) {
      alert('Selecione uma data primeiro.')
      return
    }

    const dateStr = formatDateYYYYMMDD(selectedDate)

    try {
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

      const { data, error } = await supabase
        .from('plantoes')
        .insert([statusData])
        .select()

      if (error) {
        console.error('Erro ao salvar status:', error)
        alert('Erro ao salvar status: ' + error.message)
        return
      }

      console.log('Status salvo com sucesso:', data)
      alert(`✅ ${status === 'disponivel' ? 'Disponível' : 'Folga'} marcado com sucesso!`)
      setShowActionModal(false)
      await fetchPlantoes(user.id)
    } catch (error) {
      console.error('Erro ao salvar status:', error)
      alert('Erro ao salvar status. Tente novamente.')
    }
  }

  const handleStatusChange = async (status: 'disponivel' | 'folga' | 'plantao') => {
    if (status === 'plantao') {
      setShowActionModal(false)
      setShowPlantaoForm(true)
      if (selectedDate) {
        setFormData(prev => ({
          ...prev,
          data: formatDateYYYYMMDD(selectedDate)
        }))
      }
      return
    }

    await handleAddStatus(status)
  }

  const handleSavePlantao = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      alert('Usuário não autenticado')
      return
    }

    try {
      // Validate required fields
      if (!formData.hospital || !formData.data || !formData.valor || !user.id) {
        console.error('Missing required fields:', { hospital: formData.hospital, data: formData.data, valor: formData.valor, userId: user.id })
        alert('Preencha todos os campos obrigatórios.')
        return
      }

      // Implement date automation logic
      const selectedDate = new Date(formData.data)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Auto-determine status based on date comparison
      let autoStatus = formData.status
      if (selectedDate < today) {
        autoStatus = 'realizado'
      } else if (selectedDate >= today) {
        autoStatus = 'pendente'
      }

      const plantaoData = {
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

      console.log('Saving plantão to table "plantoes":', plantaoData)
      const { data, error } = await supabase
        .from('plantoes')
        .insert([plantaoData])
        .select()

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
      alert('✅ Plantão agendado com sucesso!')
      setShowPlantaoForm(false)
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
        local_favorito_id: ''
      })
      
      await fetchPlantoes(user.id)
      
    } catch (error) {
      console.error('Erro ao salvar plantão:', error)
      alert('Erro ao salvar plantão. Tente novamente.')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleHospitalChange = async (value: string) => {
    setFormData(prev => ({ ...prev, hospital: value }))
    
    if (value.length < 2) {
      setHospitalSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('plantoes')
        .select('hospital, endereco, cep')
        .ilike('hospital', `%${value}%`)
        .limit(5)

      if (error) {
        console.error('Error fetching hospital suggestions:', error)
        return
      }

      const uniqueHospitals = data?.reduce((acc: any[], plantao) => {
        const exists = acc.find(h => h.hospital === plantao.hospital)
        if (!exists && plantao.hospital) {
          acc.push({
            hospital: plantao.hospital,
            endereco: plantao.endereco,
            cep: plantao.cep
          })
        }
        return acc
      }, []) || []

      setHospitalSuggestions(uniqueHospitals)
      setShowSuggestions(true)
    } catch (error) {
      console.error('Error searching hospitals:', error)
    }
  }

  const selectHospital = (hospital: any) => {
    setFormData(prev => ({
      ...prev,
      hospital: hospital.hospital,
      endereco: hospital.endereco || '',
      cep: hospital.cep || ''
    }))
    setShowSuggestions(false)
    setHospitalSuggestions([])
  }

  const handleCepLookup = async () => {
    const cep = formData.cep.replace(/\D/g, '')
    
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

  const handleClearDay = async () => {
    if (!selectedDate) {
      alert('Nenhuma data selecionada')
      return
    }

    const dateStr = formatDateYYYYMMDD(selectedDate)
    
    try {
      const { error } = await supabase
        .from('plantoes')
        .delete()
        .eq('data', dateStr)

      if (error) {
        console.error('Error clearing day:', error)
        alert('Erro ao limpar o dia. Tente novamente.')
        return
      }

      console.log('Dia limpo com sucesso')
      alert('✅ Dia limpo com sucesso!')
      setShowActionModal(false)
      await fetchPlantoes(user.id)
    } catch (error) {
      console.error('Error clearing day:', error)
      alert('Erro ao limpar o dia. Tente novamente.')
    }
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Sessão Expirada</h1>
          <p className="text-gray-600 mb-6">Sua sessão expirou. Por favor, faça login novamente.</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Fazer Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50">
        <Sidebar user={user} />
        
        <div className="flex-1 overflow-auto">
          <div className='p-6'>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Escala de Plantões</h1>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-xl">◀</span>
                </button>
                <h2 className="text-xl font-semibold text-gray-800">
                  {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h2>
                <button 
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-xl">▶</span>
                </button>
              </div>
            </div>

            {/* Hospital Efficiency Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Eficiência por Hospital</h3>
              {(() => {
                const efficiencyData = getHospitalEfficiencyData()
                
                if (efficiencyData.length === 0) {
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
                
                console.log('Dados Limpos para o Gráfico:', efficiencyData)
                return (
                  efficiencyData.length > 0 && (
                    <div style={{ width: '100%', height: '300px' }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={efficiencyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="hospital" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 12 }}
                            minTickGap={30}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `R$ ${value}`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Valor Total']}
                            labelStyle={{ color: '#374151' }}
                          />
                          <Legend />
                          <Bar 
                            dataKey="valor" 
                            fill="#f97316" 
                            name="Valor Total (R$)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                )
              })()}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const daysInMonth = getDaysInMonth(currentMonth)
                  const firstDay = getFirstDayOfMonth(currentMonth)
                  const days = []

                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="h-20"></div>)
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const dayPlantoes = getPlantoesForDay(day)
                    const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()

                    days.push(
                      <div
                        key={day}
                        onClick={() => handleDayClick(day)}
                        className={`h-20 border rounded-lg p-2 cursor-pointer transition-colors ${
                          isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-700 mb-1">{day}</div>
                        <div className="space-y-1 list-none">
                          {dayPlantoes.slice(0, 2).map((plantao: any, index: number) => (
                            <div
                              key={plantao.id || index}
                              className={`text-xs px-2 py-0.5 rounded-full truncate ${
                                plantao.tipo_evento === 'plantao' ? 'bg-blue-100 text-blue-700' :
                                plantao.tipo_evento === 'disponivel' ? 'bg-green-100 text-green-700' :
                                plantao.tipo_evento === 'folga' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {plantao.hospital || plantao.tipo_evento}
                            </div>
                          ))}
                          {dayPlantoes.length > 2 && (
                            <div className="text-xs text-gray-500">+{dayPlantoes.length - 2} mais</div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return days
                })()}
              </div>
            </div>

            {showActionModal && selectedDate && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                  <h3 className="text-lg font-semibold mb-4">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleAddStatus('disponivel')}
                      className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🟢</span>
                      <span>Disponível</span>
                    </button>
                    <button
                      onClick={() => handleAddStatus('folga')}
                      className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🔴</span>
                      <span>Folga</span>
                    </button>
                    <button
                      onClick={() => handleStatusChange('plantao')}
                      className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🏥</span>
                      <span>Novo Plantão</span>
                    </button>
                    <button
                      onClick={handleClearDay}
                      className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🗑️</span>
                      <span>Limpar Dia</span>
                    </button>
                    <button
                      onClick={() => setShowActionModal(false)}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPlantaoForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">Agendar Novo Plantão</h3>
                  <form onSubmit={handleSavePlantao} className="space-y-4">
                    {/* Hospital/Local */}
                    <div>
                      <label htmlFor="hospital" className="block text-sm font-medium text-gray-700 mb-2">
                        Hospital/Local
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="hospital"
                          name="hospital"
                          value={formData.hospital}
                          onChange={(e) => handleHospitalChange(e.target.value)}
                          className="w-full block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Nome do hospital"
                          required
                        />
                        {showSuggestions && hospitalSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
                            {hospitalSuggestions.map((hospital, index) => (
                              <div
                                key={index}
                                onClick={() => selectHospital(hospital)}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                              >
                                <div className="font-medium text-gray-900">{hospital.hospital}</div>
                                {hospital.endereco && (
                                  <div className="text-xs text-gray-500">{hospital.endereco}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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

                    {/* Actions */}
                    <div className="flex space-x-2 mt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        Cadastrar Plantão
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPlantaoForm(false)}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}