'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface Plantao {
  id: string
  hospital: string
  data: string
  valor: number
  status: 'pendente' | 'pago' | 'confirmado'
  horas?: number
}

interface Despesa {
  id: string
  descricao: string
  valor: number
  data: string
  categoria: string
  usuario_id: string
}

export default function FinanceiroPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState<{
    descricao: string;
    valor: string;
    data: string;
    categoria: string;
    recorrente: boolean;
  }>({
    descricao: '',
    valor: '',
    data: '',
    categoria: 'transporte',
    recorrente: false
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
      await fetchData(user.id)
    } catch (error) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (userId: string) => {
    await Promise.all([
      fetchPlantoes(userId),
      fetchDespesas(userId)
    ])
  }

  const fetchPlantoes = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('usuario_id', userId)

      if (error) {
        console.error('Error fetching plantões:', error)
        setPlantoes([])
        return
      }

      setPlantoes(data || [])
    } catch (error) {
      console.error('Error fetching plantões:', error)
      setPlantoes([])
    }
  }

  const fetchDespesas = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('despesas')
        .select('*')
        .eq('usuario_id', userId)
        .order('data', { ascending: false })

      if (error) {
        console.error('Error fetching despesas:', error)
        setDespesas([])
        return
      }

      setDespesas(data || [])
    } catch (error) {
      console.error('Error fetching despesas:', error)
      setDespesas([])
    }
  }

  const handleAddExpense = async () => {
    if (!newExpense.descricao || !newExpense.valor || !newExpense.data) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    try {
      // If it's a recurring expense, create monthly expenses for the next 12 months
      if (newExpense.recorrente && newExpense.data) {
        const recurringDate = new Date(newExpense.data)
        const expensesToInsert = []
        
        for (let i = 0; i < 12; i++) {
          const expenseDate = new Date(recurringDate.getFullYear(), recurringDate.getMonth() + i, 1)
          expensesToInsert.push({
            descricao: `${newExpense.descricao} - ${expenseDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
            valor: parseFloat(newExpense.valor),
            data: expenseDate.toISOString().split('T')[0],
            categoria: 'recorrente',
            usuario_id: user.id
          })
        }

        // Insert all recurring expenses at once
        const { error: recurringError } = await supabase
          .from('despesas')
          .insert(expensesToInsert)

        if (recurringError) {
          console.error('Error adding recurring expenses:', recurringError)
          alert('Erro ao adicionar despesas recorrentes: ' + recurringError.message)
          return
        }
      } else {
        // Regular single expense
        const { error } = await supabase
          .from('despesas')
          .insert({
            descricao: newExpense.descricao,
            valor: parseFloat(newExpense.valor),
            data: newExpense.data,
            categoria: newExpense.categoria,
            usuario_id: user.id
          })

        if (error) {
          console.error('Error adding despesa:', error)
          alert('Erro ao adicionar despesa: ' + error.message)
          return
        }
      }

      // Reset form and refresh data
      setNewExpense({
        descricao: '',
        valor: '',
        data: '',
        categoria: 'transporte',
        recorrente: false
      })
      setShowAddExpense(false)
      await fetchDespesas(user.id)
    } catch (error) {
      console.error('Error adding despesa:', error)
      alert('Erro ao adicionar despesa. Tente novamente.')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('despesas')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting despesa:', error)
        alert('Erro ao excluir despesa: ' + error.message)
        return
      }

      await fetchDespesas(user.id)
    } catch (error) {
      console.error('Error deleting despesa:', error)
      alert('Erro ao excluir despesa. Tente novamente.')
    }
  }

  // Calculate financial metrics
  const totalRecebido = plantoes
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0)
  
  const totalAReceber = plantoes
    .filter(p => p.status !== 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0)
  
  const totalDespesas = despesas.reduce((sum, d) => sum + (d.valor || 0), 0)
  
  // Simple tax calculation (assuming 15% for medical services in Brazil)
  const impostos = totalRecebido * 0.15
  const lucroLiquido = totalRecebido - totalDespesas - impostos

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">
              <span className="text-orange-500">Financeiro</span>
            </h1>
            <p className="text-gray-600 mt-2">Gestão financeira e controle de despesas</p>
          </div>

          {/* Cards de Resumo Financeiro */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recebido</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {formatCurrency(totalRecebido)}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">A Receber</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">
                    {formatCurrency(totalAReceber)}
                  </p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Despesas Totais</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatCurrency(totalDespesas)}
                  </p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Impostos (15%)</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-2">
                    {formatCurrency(impostos)}
                  </p>
                </div>
                <div className="bg-yellow-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m12 0v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2m12 0H6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Lucro Líquido</p>
                  <p className={`text-2xl font-bold mt-2 ${lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(lucroLiquido)}
                  </p>
                </div>
                <div className={`${lucroLiquido >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full p-3`}>
                  <svg className={`h-6 w-6 ${lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Despesas */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Gerenciar Despesas</h3>
              <button
                onClick={() => setShowAddExpense(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                + Nova Despesa
              </button>
            </div>

            {/* Modal para Adicionar Despesa */}
            {showAddExpense && (
              <div className="p-6 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição *
                    </label>
                    <input
                      type="text"
                      value={newExpense.descricao}
                      onChange={(e) => setNewExpense({...newExpense, descricao: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Ex: Uber para hospital"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newExpense.valor}
                      onChange={(e) => setNewExpense({...newExpense, valor: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data *
                    </label>
                    <input
                      type="date"
                      value={newExpense.data}
                      onChange={(e) => setNewExpense({...newExpense, data: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria
                    </label>
                    <select
                      value={newExpense.categoria}
                      onChange={(e) => setNewExpense({...newExpense, categoria: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="transporte">Transporte</option>
                      <option value="alimentacao">Alimentação</option>
                      <option value="material">Material Médico</option>
                      <option value="outros">Outros</option>
                      <option value="recorrente">Repetir mensalmente</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowAddExpense(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddExpense}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Adicionar Despesa
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Despesas */}
            <div className="overflow-x-auto">
              {despesas.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                  <p className="text-gray-500">Nenhuma despesa registrada</p>
                  <p className="text-sm text-gray-400 mt-2">Adicione suas despesas para controlar melhor seu financeiro</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Categoria
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {despesas.map((despesa) => (
                      <tr key={despesa.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(despesa.data)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {despesa.descricao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            {despesa.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(despesa.valor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDeleteExpense(despesa.id)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
