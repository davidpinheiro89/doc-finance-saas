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
      // Try with usuario_id first (more common in Portuguese systems)
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('usuario_id', userId)
        .order('data', { ascending: true })

      if (error) {
        console.error('Error fetching plantões with usuario_id:', error)
        
        // Try without user filter for now to test basic functionality
        const { data: allData, error: allError } = await supabase
          .from('plantoes')
          .select('*')
          .order('data', { ascending: true })

        if (allError) {
          console.error('Error fetching all plantões:', allError)
          setPlantoes([])
          return
        }

        console.log('Todos os dados carregados do Supabase:', allData)
        setPlantoes(allData || [])
        return
      }

      console.log('Dados carregados do Supabase:', data)
      setPlantoes(data || [])
      
      // Force loading state to false after data loads
      setLoading(false)
    } catch (error) {
      console.error('Error fetching plantões:', error)
      setPlantoes([])
      setLoading(false)
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

      // First try with usuario_id
      const testPlantao = {
        usuario_id: user.id,
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

      console.log('Inserindo plantão de teste com usuario_id:', testPlantao)

      const { data, error } = await supabase
        .from('plantoes')
        .insert([testPlantao])
        .select()

      if (error) {
        console.error('Erro ao inserir plantão com usuario_id:', error)
        
        // If usuario_id fails, try without user field temporarily
        const testPlantaoNoUser = {
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

        console.log('Tentando inserir sem campo de usuário:', testPlantaoNoUser)

        const { data: dataNoUser, error: errorNoUser } = await supabase
          .from('plantoes')
          .insert([testPlantaoNoUser])
          .select()

        if (errorNoUser) {
          console.error('Erro ao inserir plantão sem usuário:', errorNoUser)
          alert('Erro ao inserir plantão: ' + errorNoUser.message)
          return
        }

        console.log('Plantão inserido sem usuário com sucesso:', dataNoUser)
        alert('✅ Plantão de teste inserido com sucesso (sem usuário)!')
        
        // Refresh the plantões list
        await fetchPlantoes(user.id)
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
            
            {plantoes.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl mb-2">📅</span>
                <p className="text-gray-600 mb-4">Nenhum plantão agendado para este período</p>
                <p className="text-sm text-gray-500">Clique no botão "Inserir Plantão Teste" acima para adicionar um plantão fictício</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="h-5 w-5 mr-2 text-blue-500">📅</span>
                  {plantoes.length} plantão(s) carregado(s)
                </h2>
                <div className="space-y-3">
                  {plantoes.map((plantao: any, index: number) => (
                    <div key={plantao.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <span>🏥</span>
                            {plantao.hospital}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            📅 {plantao.data} | ⏰ {plantao.horas}h | 💰 R$ {plantao.valor}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            📍 {plantao.endereco} | 🏷️ {plantao.classificacao}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          plantao.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                          plantao.status === 'confirmado' ? 'bg-blue-100 text-blue-800' :
                          plantao.status === 'realizado' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {plantao.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
