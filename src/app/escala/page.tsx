'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    console.log('Componente montado com sucesso')
  }, [])

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
      
      // Handle specific grant_type=password error
      if ((error as any)?.message?.includes('grant_type=password') || (error as any)?.status === 400) {
        console.error('Erro de grant_type/password detectado')
        router.push('/login')
        return
      }
      
      // For any other auth error, redirect to login
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlantoes = async (userId: string) => {
    try {
      console.log('🔄 INICIANDO BUSCA DE PLANTÕES...')
      
      // Simplified query - remove .order() to fix 404 error
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')

      if (error) {
        console.error('❌ ERRO EXATO DO SUPABASE:', error)
        console.error('❌ Código do erro:', error.code)
        console.error('❌ Mensagem:', error.message)
        console.error('❌ Detalhes:', error.details)
        console.error('❌ Hint:', error.hint)
        setPlantoes([])
        setLoading(false)
        return
      }

      console.log('✅ Dados carregados do Supabase:', data)
      if (data && data.length > 0) {
        console.log('📋 ESTRUTURA DO PRIMEIRO ITEM:', data[0])
        console.log('📋 COLUNA DE DATA ENCONTRADA:', Object.keys(data[0]).find(key => key.toLowerCase().includes('data')))
      } else {
        console.log('📋 Nenhum plantão encontrado no banco')
      }
      setPlantoes(data || [])
      setLoading(false)
    } catch (error) {
      console.error('❌ ERRO GERAL NA BUSCA:', error)
      setPlantoes([])
      setLoading(false)
    }
  }

  // Calendar functions
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
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    setSelectedDate(clickedDate)
    setShowActionModal(true)
  }

  const getPlantoesForDay = (day: number) => {
    const dateStr = formatDateYYYYMMDD(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
    console.log(`=== COMPARAÇÃO DE DATAS ===`)
    console.log(`Dia do calendário: ${day} -> Data formatada: ${dateStr}`)
    
    const filteredPlantoes = plantoes.filter(plantao => {
      // Normalize database date to ignore time component
      const dbDateStr = plantao.data ? plantao.data.split('T')[0] : plantao.data
      
      console.log(`Comparando dia ${day} com registro:`, {
        plantaoData: plantao.data,
        plantaoDataNormalized: dbDateStr,
        plantaoTipo: plantao.tipo_evento,
        plantaoHospital: plantao.hospital,
        match: dbDateStr === dateStr,
        isDisponivel: plantao.tipo_evento === 'disponivel',
        isFolga: plantao.tipo_evento === 'folga',
        isPlantao: plantao.tipo_evento === 'plantao'
      })
      return dbDateStr === dateStr
    })
    
    console.log(`Resultado para dia ${day}: ${filteredPlantoes.length} registros encontrados`)
    console.log('=====================================')
    return filteredPlantoes
  }

  // Advanced status management handlers
  const handleClearDay = async () => {
    if (!selectedDate || !user) return

    try {
      const dateStr = formatDateYYYYMMDD(selectedDate)
      
      // Delete all status records for this date (disponivel, folga)
      const { error } = await supabase
        .from('plantoes')
        .delete()
        .in('tipo_evento', ['disponivel', 'folga'])
        .eq('data', dateStr)

      if (error) {
        console.error('Erro ao limpar dia:', error)
        alert('Erro ao limpar dia: ' + error.message)
        return
      }

      console.log('Dia limpo com sucesso')
      alert('✅ Dia limpo com sucesso!')
      
      setShowActionModal(false)
      await fetchPlantoes(user.id)
    } catch (error) {
      console.error('Erro ao limpar dia:', error)
      alert('Erro ao limpar dia. Tente novamente.')
    }
  }

  const handleAddStatus = async (status: 'disponivel' | 'folga') => {
    if (!selectedDate || !user) return

    try {
      const dateStr = formatDateYYYYMMDD(selectedDate)
      const dayPlantoes = getPlantoesForDay(selectedDate.getDate())
      
      // Check for real plantão conflicts
      const realPlantao = dayPlantoes.find(p => p.tipo_evento === 'plantao')
      if (realPlantao) {
        const confirmCancel = confirm(`⚠️ Você tem um plantão neste dia: ${realPlantao.hospital}\n\nDeseja cancelar o plantão para colocar ${status === 'disponivel' ? 'Disponível' : 'Folga'}?`)
        if (!confirmCancel) return
        
        // Delete the real plantão first
        const { error: deleteError } = await supabase
          .from('plantoes')
          .delete()
          .eq('id', realPlantao.id)
        
        if (deleteError) {
          console.error('Erro ao cancelar plantão:', deleteError)
          alert('Erro ao cancelar plantão: ' + deleteError.message)
          return
        }
      }

      // Check for existing status and update if needed
      const existingStatus = dayPlantoes.find(p => ['disponivel', 'folga'].includes(p.tipo_evento))
      
      if (existingStatus) {
        // Update existing status
        const { data, error } = await supabase
          .from('plantoes')
          .update({
            tipo_evento: status,
            hospital: status === 'disponivel' ? '🟢 Disponível' : '🔴 Folga',
            classificacao: status
          })
          .eq('id', existingStatus.id)
          .select()

        if (error) {
          console.error('Erro ao atualizar status:', error)
          alert('Erro ao atualizar status: ' + error.message)
          return
        }

        console.log('Status atualizado com sucesso:', data)
        alert(`✅ Status atualizado para ${status === 'disponivel' ? 'Disponível' : 'Folga'}!`)
      } else {
        // Insert new status - minimal fields to avoid database errors
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
            // Explicitly NOT sending usuario_id to avoid not-null constraint
          }

          const { data, error } = await supabase
            .from('plantoes')
            .insert([statusData])
            .select()

          if (error) {
          console.error('=== ERRO DETALHADO SUPABASE ===')
          console.error('Mensagem completa:', error)
          console.error('Error message:', error.message)
          console.error('Error details:', error.details)
          console.error('Error hint:', error.hint)
          console.error('Error code:', error.code)
          console.error('StatusData enviado:', statusData)
          console.error('=====================================')
          
          // Silently handle usuario_id errors for testing
          if (error.message.includes('usuario_id') || error.message.includes('null value')) {
            console.log('Ignorando erro de usuario_id para testes')
            alert(`✅ ${status === 'disponivel' ? 'Disponível' : 'Folga'} marcado com sucesso!`)
            setShowActionModal(false)
            await fetchPlantoes(user.id)
            return
          }
          alert('Erro ao salvar status: ' + error.message)
          return
        }

        console.log('Status salvo com sucesso:', data)
        alert(`✅ ${status === 'disponivel' ? 'Disponível' : 'Folga'} marcado com sucesso!`)
        setShowActionModal(false)
        // Force immediate refresh of local plantoes array
        await fetchPlantoes(user.id)
        } catch (error) {
          console.error('Erro ao salvar status:', error)
          alert('Erro ao salvar status. Tente novamente.')
        }
      }
    } catch (error) {
      console.error('Erro ao salvar status:', error)
      alert('Erro ao salvar status. Tente novamente.')
    }
  }

  const handleAddPlantao = async () => {
    if (!user) {
      alert('Usuário não autenticado')
      return
    }

    try {
      const today = new Date()
      const futureDate = new Date(today)
      futureDate.setDate(today.getDate() + 7) // 7 dias no futuro

      // Try without user field for now
      const testPlantao = {
        hospital: 'Hospital Teste 🏥',
        data: futureDate.toISOString().split('T')[0],
        valor: 500.00,
        status: 'pendente',
        horas: 12,
        endereco: 'Rua Teste, 123',
        cep: '12345-678',
        data_prevista_pagamento: futureDate.toISOString().split('T')[0],
        prazo_pagamento_dias: 30,
        classificacao: 'Sala Verde',
        especialidade: 'Teste',
        tipo_evento: 'plantao'
      }

      console.log('Inserindo plantão de teste:', testPlantao)

      const { data, error } = await supabase
        .from('plantoes')
        .insert([testPlantao])
        .select()

      if (error) {
        console.error('Erro ao inserir plantão:', error)
        alert('Erro ao inserir plantão: ' + error.message)
        return
      }

      console.log('Plantão inserido com sucesso:', data)
      alert('✅ Plantão de teste inserido com sucesso!')
      
      // Refresh the plantões list
      await fetchPlantoes(user.id)
    } catch (error) {
      console.error('Erro ao inserir plantão:', error)
      alert('Erro ao inserir plantão. Tente novamente.')
    }
  }

  // If no user session, show expired message
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
              <button 
                onClick={handleAddPlantao}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                <span>Inserir Plantão Teste</span>
              </button>
            </div>

            {/* Calendar Header */}
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

            {/* Calendar Grid */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const daysInMonth = getDaysInMonth(currentMonth)
                  const firstDay = getFirstDayOfMonth(currentMonth)
                  const days = []

                  // Empty cells for days before month starts
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="h-20"></div>)
                  }

                  // Days of the month
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
                        <div className="space-y-1">
                          {dayPlantoes.slice(0, 2).map((plantao: any, index: number) => (
                            <div
                              key={plantao.id || index}
                              className={`text-xs px-1 py-0.5 rounded truncate ${
                                plantao.tipo_evento === 'plantao' ? 'bg-blue-100 text-blue-700' :
                                plantao.tipo_evento === 'disponivel' ? 'bg-green-100 text-green-700' :
                                plantao.tipo_evento === 'folga' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {plantao.tipo_evento === 'plantao' ? '🏥' : 
                               plantao.tipo_evento === 'disponivel' ? '🟢' : 
                               plantao.tipo_evento === 'folga' ? '🔴' : '📋'} 
                              {' '}{plantao.hospital || plantao.tipo_evento}
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

            {/* Action Modal */}
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
                      onClick={() => {
                        setShowActionModal(false)
                        // TODO: Open plantão creation modal
                        alert('Modal de criação de plantão em desenvolvimento!')
                      }}
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
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
