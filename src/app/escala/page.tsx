'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

// Shared delete function for both pages
const deletePlantaoEvent = async (id: string, userId: string, setPlantoes: React.Dispatch<React.SetStateAction<any[]>>) => {
  if (!confirm('Tem certeza que deseja apagar este plantão? Esta ação não pode ser desfeita.')) {
    return
  }

  try {
    const { error } = await supabase
      .from('plantoes')
        .delete()
        .eq('id', id)

    if (error) {
      console.error('Error deleting plantão:', error)
      alert('Erro ao apagar plantão: ' + error.message)
      return
    }

    // Update local state immediately for visual feedback
    setPlantoes((prev: any[]) => prev.filter((p: any) => p.id !== id))
    
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
  horas?: number | undefined
  endereco?: string
  cep: string
  data_prevista_pagamento: string
  prazo_pagamento_dias: number | undefined
  classificacao: string
  especialidade: string
  tipo_evento?: 'plantao' | 'folga' | 'disponivel'
  local_favorito_id?: string | null
}

export default function EscalaPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plantoes, setPlantoes] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showDayMenu, setShowDayMenu] = useState(false)
  const [selectedDayEvents, setSelectedDayEvents] = useState<Plantao[]>([])
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
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
    local_favorito_id: null as string | null
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
        .or('tipo_evento.eq.plantao,tipo_evento.is.null')
        .order('data', { ascending: true })

      if (error) {
        console.error('Error fetching plantões:', error)
        setPlantoes([])
        return
      }

      console.log('Dados carregados do Supabase:', data)
      setPlantoes(data || [])
    } catch (error) {
      console.error('Error fetching plantões:', error)
      setPlantoes([])
    }
  }

  const handleDayClick = (date: Date, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuPosition({ x: rect.left, y: rect.bottom })
    
    const dayEvents = getPlantoesByDate(date)
    setSelectedDayEvents(dayEvents)
    
    // Show menu for all days - allow selecting favorite locations
    setShowDayMenu(true)
    
    // If clicking on a day with existing plantões, check if it's a favorite location
    if (dayEvents.length > 0) {
      const favoriteLocation = dayEvents.find(p => p.local_favorito_id)
      if (favoriteLocation) {
        // Pre-select the favorite location in the form
        setFormData(prev => ({
          ...prev,
          local_favorito_id: favoriteLocation.local_favorito_id,
          hospital: favoriteLocation.nome,
          endereco: favoriteLocation.endereco || ''
        }))
      }
    }
  }

  const handleAddPlantao = () => {
    setShowDayMenu(false)
    router.push('/dashboard')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSavePlantao = async () => {
    if (!formData.hospital || !formData.endereco) {
      alert('Por favor, preencha o Hospital/Local para salvar como favorito.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('plantoes')
        .insert({
          usuario_id: user.id,
          hospital: formData.hospital,
          data: formData.data,
          valor: parseFloat(formData.valor) || 0,
          status: formData.status,
          horas: parseFloat(formData.horas) || null,
          endereco: formData.endereco,
          cep: formData.cep,
          data_prevista_pagamento: formData.data_prevista_pagamento,
          prazo_pagamento_dias: formData.prazo_pagamento_dias ? parseInt(formData.prazo_pagamento_dias) : null,
          classificacao: formData.classificacao,
          especialidade: formData.especialidade,
          tipo_evento: 'plantao'
        })

      if (error) {
        console.error('Error saving plantão:', error)
        alert('Erro ao salvar plantão. Tente novamente.')
        return
      }

      alert('Plantão salvo com sucesso!')
      
      // Update local state immediately for visual feedback
      setPlantoes(prev => {
        const newPlantao = {
          id: data?.[0]?.id || '',
          usuario_id: user.id,
          hospital: formData.hospital,
          data: formData.data,
          valor: parseFloat(formData.valor) || 0,
          status: formData.status,
          horas: parseFloat(formData.horas) || undefined,
          endereco: formData.endereco,
          cep: formData.cep,
          data_prevista_pagamento: formData.data_prevista_pagamento,
          prazo_pagamento_dias: formData.prazo_pagamento_dias ? parseInt(formData.prazo_pagamento_dias) : undefined,
          classificacao: formData.classificacao,
          especialidade: formData.especialidade,
          tipo_evento: 'plantao'
        }
        return [...prev, newPlantao]
          .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
      })
      
      // Clear form
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
        local_favorito_id: null as string | null
      })
      
      setShowDayMenu(false)
    } catch (error) {
      console.error('Error saving plantão:', error)
      alert('Erro ao salvar plantão. Tente novamente.')
    }
  }

  // Helper function to format date as pure YYYY-MM-DD without timezone issues
  const formatDateYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to format date as pure YYYY-MM-DD without timezone issues
  const formatDateYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Shared delete function for both pages
  const deletePlantaoEvent = async (id: string, userId: string, setPlantoes: any) => {
    console.log('deletePlantaoEvent called with ID:', id)
    
    if (!confirm('Tem certeza que deseja apagar este plantão? Esta ação não pode ser desfeita.')) {
      console.log('User cancelled deletion')
      return
    }

    try {
      console.log('Attempting to delete plantão with ID:', id)
      const { error } = await supabase
        .from('plantoes')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting plantão:', error)
        alert('Erro ao apagar plantão: ' + error.message)
        return
      }

      console.log('Plantão deleted successfully from database')
      
      // Update local state immediately for visual feedback
      setPlantoes(prev => {
        console.log('Previous plantões count:', prev.length)
        const updated = prev.filter(p => p.id !== id)
        console.log('After filtering plantões count:', updated.length)
        return updated
      })
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting plantão:', error)
      return { success: false, error }
    }
  }

  const handleClearDay = async () => {
    if (!confirm('Deseja limpar este dia? Todos os eventos serão removidos.')) {
      return
    }

    const dateStr = formatDateYYYYMMDD(selectedDate)
    const { data, error } = await supabase
      .from('plantoes')
      .select('*')
      .eq('usuario_id', user.id)

      if (error) {
        alert('Erro ao limpar dia. Tente novamente.')
      } else {
        alert('Dia limpo com sucesso!');
      }
    } catch (error) {
      console.error('Error clearing day:', error)
      alert('Erro ao limpar dia. Tente novamente.')
    }
  }

  const getPlantoesByDate = (date: Date) => {
    const dateStr = formatDateYYYYMMDD(date)
    return plantoes.filter((plantao: any) => plantao.data === dateStr)
  }

  const getEventTypeColor = (tipo_evento?: string) => {
    switch (tipo_evento) {
      case 'folga': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'disponivel': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'plantao': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-white text-gray-800 border-gray-200'
    }
  }

  const getClassificationColor = (classificacao?: string) => {
    switch (classificacao) {
      case 'Sala Verde': return 'bg-green-100 text-green-800 border-green-200'
      case 'Sala Amarela': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Sala Vermelha': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'realizado': return 'bg-green-500'
      case 'confirmado': return 'bg-blue-500'
      case 'pendente': return 'bg-yellow-500'
      case 'pago': return 'bg-purple-500'
      default: return 'bg-gray-500'
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
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-3xl font-bold text-gray-800">
                  Escala de Plantões
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{user?.user_metadata?.full_name || 'Médico'}</span>
                  <span className="ml-2 text-xs text-gray-500">{user?.user_metadata?.crm || 'CRM'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Calendar View */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Calendário de Plantões</h2>
              
              {/* Month Navigation */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <h3 className="text-lg font-medium text-gray-800">
                  {selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h3>
                
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Weekdays */}
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                
                {/* Calendar Days */}
                {Array.from({ length: 35 }, (_, i) => {
                  const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i - selectedDate.getDay() + 1)
                  const isCurrentMonth = date.getMonth() === selectedDate.getMonth()
                  const isToday = date.toDateString() === new Date().toDateString()
                  const dayPlantoes = getPlantoesByDate(date)
                  
                  return (
                    <div
                      key={i}
                      className={`
                        group border rounded-lg p-2 min-h-[80px] cursor-pointer transition-colors
                        ${isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 text-gray-400'}
                        ${isToday ? 'ring-2 ring-orange-500' : ''}
                      `}
                      onClick={(e) => {
                        if (isCurrentMonth) {
                          handleDayClick(date, e)
                        }
                      }}
                    >
                      <div className="text-sm font-medium mb-1">{date.getDate()}</div>
                      
                      {dayPlantoes.length > 0 ? (
                        <div className="space-y-1">
                          {dayPlantoes.slice(0, 2).map(plantao => (
                            <div
                              key={plantao.id}
                              className={`text-xs p-1 rounded border truncate ${
                                plantao.tipo_evento === 'folga' ? 'bg-gray-400 text-white border-gray-500' :
                                plantao.tipo_evento === 'disponivel' ? 'bg-blue-500 text-white border-blue-600' :
                                (plantao.tipo_evento === 'plantao' || !plantao.tipo_evento) ? 
                                  (plantao.classificacao === 'Sala Verde' ? 'bg-green-100 text-green-800 border-green-200' :
                                   plantao.classificacao === 'Sala Amarela' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                   plantao.classificacao === 'Sala Vermelha' ? 'bg-red-100 text-red-800 border-red-200' :
                                   'bg-orange-100 text-orange-800 border-orange-200') :
                                'bg-white text-gray-800 border-gray-200'
                              }`}
                              title={`${plantao.hospital} - ${plantao.classificacao || ''} - ${plantao.especialidade || ''}`}
                            >
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(plantao.status)}`}></div>
                                <span className="truncate">{plantao.hospital}</span>
                              </div>
                            </div>
                          ))}
                          {dayPlantoes.length > 2 && (
                            <div className="text-xs text-gray-500">+{dayPlantoes.length - 2} mais</div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            Clique para adicionar
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Selected Date Details */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Plantões em {selectedDate.toLocaleDateString('pt-BR')}
            </h3>
            
            {getPlantoesByDate(selectedDate).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum plantão agendado para esta data.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getPlantoesByDate(selectedDate).map(plantao => (
                  <div key={plantao.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-800">{plantao.hospital}</h4>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(plantao.status)}`}></div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-2">
                          {plantao.classificacao && (
                            <span className={`px-2 py-1 rounded-full text-xs border ${getClassificationColor(plantao.classificacao)}`}>
                              {plantao.classificacao}
                            </span>
                          )}
                          {plantao.especialidade && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-xs">
                              {plantao.especialidade}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          <p>Duração: {plantao.horas || 0}h</p>
                          <p>Valor: R$ {plantao.valor?.toFixed(2) || '0.00'}</p>
                          {plantao.endereco && <p>Endereço: {plantao.endereco}</p>}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs text-white ${getStatusColor(plantao.status)}`}>
                          {plantao.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Day Selection Menu */}
      {showDayMenu && (
        <div 
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50"
          style={{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }}
        >
          <div className="space-y-2">
            <button
              onClick={handleAddPlantao}
              className="w-full text-left px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors duration-200"
            >
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m1.41 1.41L17 17l-4-4v16" />
                </svg>
                Cadastrar Plantão
              </div>
            </button>
            
                        
            <button
              onClick={handleClearDay}
              className="w-full text-left px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
            >
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Limpar Dia
              </div>
            </button>
            
            <button
              onClick={() => setShowDayMenu(false)}
              className="w-full text-left px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
            >
              Cancelar
            </button>
          </div>
        </div>
        )}
        
        {/* Close menu when clicking outside */}
        {showDayMenu && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDayMenu(false)}
          />
        )}
    </div>
  )
}
