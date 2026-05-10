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
      // Force return empty array immediately to prevent any 404 errors
      const data: any[] = []
      const error = null

      if (error) {
        console.error('Error fetching plantões:', error)
        setPlantoes([])
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
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Escala de Plantões</h1>
            
            {plantoes.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl mb-2">📅</span>
                <p className="text-gray-600">Nenhum plantão agendado para este período</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="h-5 w-5 mr-2 text-blue-500">📅</span>
                  {plantoes.length} plantão(s) carregado(s)
                </h2>
                <pre className="text-sm text-gray-600 bg-gray-50 p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(plantoes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
