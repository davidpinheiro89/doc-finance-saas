'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

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
  user_id: string
  recorrente?: boolean
}

export default function FinanceiroPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showEditExpense, setShowEditExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Despesa | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)) // YYYY-MM format
  const [selectedYear, setSelectedYear] = useState<number>(2026)
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
        .eq('user_id', userId)

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
        .eq('user_id', userId)
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
      if (newExpense.recorrente && newExpense.data) {
        const recurringDate = new Date(newExpense.data)
        const currentMonth = recurringDate.getMonth()
        const currentYear = recurringDate.getFullYear()
        const expensesToInsert = []
        
        // Only create from current month forward (not retroactive)
        for (let i = 0; i < (12 - currentMonth); i++) {
          const expenseDate = new Date(currentYear, currentMonth + i, 1)
          expensesToInsert.push({
            descricao: `${newExpense.descricao} - ${expenseDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
            valor: parseFloat(newExpense.valor),
            data: expenseDate.toISOString().split('T')[0],
            categoria: newExpense.categoria,
            recorrente: true,
            user_id: user.id
          })
        }

        const { error: recurringError } = await supabase
          .from('despesas')
          .insert(expensesToInsert)

        if (recurringError) {
          console.error('Error adding recurring expenses:', recurringError)
          alert('Erro ao adicionar despesas recorrentes: ' + recurringError.message)
          return
        }
      } else {
        const { error } = await supabase
          .from('despesas')
          .insert({
            descricao: newExpense.descricao,
            valor: parseFloat(newExpense.valor),
            data: newExpense.data,
            categoria: newExpense.categoria,
            recorrente: false,
            user_id: user.id
          })

        if (error) {
          console.error('Error adding despesa:', error)
          alert('Erro ao adicionar despesa: ' + error.message)
          return
        }
      }

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

  const handleEditExpense = (despesa: Despesa) => {
    setEditingExpense(despesa)
    setShowEditExpense(true)
  }

  const handleUpdateExpense = async () => {
    if (!editingExpense) return

    try {
      const { error } = await supabase
        .from('despesas')
        .update({
          descricao: editingExpense.descricao,
          valor: editingExpense.valor,
          data: editingExpense.data,
          categoria: editingExpense.categoria,
          recorrente: editingExpense.recorrente
        })
        .eq('id', editingExpense.id)

      if (error) {
        console.error('Error updating despesa:', error)
        alert('Erro ao atualizar despesa: ' + error.message)
        return
      }

      setShowEditExpense(false)
      setEditingExpense(null)
      await fetchDespesas(user.id)
    } catch (error) {
      console.error('Error updating despesa:', error)
      alert('Erro ao atualizar despesa. Tente novamente.')
    }
  }

  const handleDeleteExpense = async (despesa: Despesa) => {
    let deleteOption = 'single'
    
    if (despesa.recorrente) {
      const selected = confirm(`Deseja:\n\n1. Excluir apenas esta despesa\n2. Excluir todas as despesas futuras semelhantes\n\nClique OK para excluir todas, ou CANCELAR para excluir apenas esta.`)
      deleteOption = selected ? 'all' : 'single'
    } else {
      if (!confirm('Tem certeza que deseja excluir esta despesa?')) {
        return
      }
    }

    try {
      if (deleteOption === 'all' && despesa.recorrente) {
        const baseDescription = despesa.descricao.split(' - ')[0]
        const { error } = await supabase
          .from('despesas')
          .delete()
          .eq('user_id', user.id)
          .like('descricao', `${baseDescription}%`)
          .eq('recorrente', true)

        if (error) {
          console.error('Error deleting recurring expenses:', error)
          alert('Erro ao excluir despesas recorrentes: ' + error.message)
          return
        }
      } else {
        const { error } = await supabase
          .from('despesas')
          .delete()
          .eq('id', despesa.id)

        if (error) {
          console.error('Error deleting despesa:', error)
          alert('Erro ao excluir despesa: ' + error.message)
          return
        }
      }

      await fetchDespesas(user.id)
    } catch (error) {
      console.error('Error deleting despesa:', error)
      alert('Erro ao excluir despesa. Tente novamente.')
    }
  }

  // Filter plantões by selected month/year
  const filteredPlantoes = plantoes.filter(p => {
    if (selectedMonth === 'todos') {
      return p.data.startsWith(selectedYear + '-')
    }
    return p.data.startsWith(selectedYear + '-' + selectedMonth.slice(5))
  })
  
  const totalRecebido = filteredPlantoes
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0)
  
  const totalAReceber = filteredPlantoes
    .filter(p => p.status !== 'pago')
    .reduce((sum, p) => sum + (p.valor || 0), 0)
  
  // Filter expenses by selected month/year
  const filteredDespesas = despesas.filter(d => {
    if (selectedMonth === 'todos') {
      return d.data.startsWith(selectedYear + '-')
    }
    return d.data.startsWith(selectedMonth)
  })
  
  const totalDespesas = filteredDespesas.reduce((sum, d) => sum + (d.valor || 0), 0)
  
  const despesasFixas = filteredDespesas.filter(d => ['alimentacao', 'material', 'outros'].includes(d.categoria))
  const despesasVariaveis = filteredDespesas.filter(d => ['transporte'].includes(d.categoria))
  
  const totalDespesasFixas = despesasFixas.reduce((sum, d) => sum + (d.valor || 0), 0)
  const totalDespesasVariaveis = despesasVariaveis.reduce((sum, d) => sum + (d.valor || 0), 0)
  
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
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  <span className="text-orange-500">Financeiro</span>
                </h1>
                <p className="text-gray-600 mt-2">Gestão financeira e controle de despesas</p>
              </div>
              
              {/* Intelligent Insight Card */}
              {selectedMonth !== 'todos' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Insight do Mês</h3>
                      <div className="space-y-2">
                        {(() => {
                          const monthlyBalance = totalRecebido - totalDespesas
                          const fixedCostsCoverage = totalRecebido > 0 ? (totalRecebido / totalDespesasFixas) * 100 : 0
                          const neededPlantoes = monthlyBalance < 0 ? Math.ceil(Math.abs(monthlyBalance) / 1200) : 0
                          
                          if (monthlyBalance < 0) {
                            return (
                              <div>
                                <p className="text-red-600 font-medium">
                                  ⚠️ Faltam <span className="font-bold">{formatCurrency(Math.abs(monthlyBalance))}</span> para cobrir seus custos fixos este mês.
                                </p>
                                <p className="text-gray-600 text-sm">
                                  Faltam aproximadamente <span className="font-bold">{neededPlantoes}</span> plantões de 12h.
                                </p>
                              </div>
                            )
                          } else {
                            return (
                              <div>
                                <p className="text-green-600 font-medium">
                                  ✅ Custos fixos quitados! Você já garantiu seu 'break-even' este mês.
                                </p>
                                <p className="text-gray-600 text-sm">
                                  Cobertura dos custos fixos: <span className="font-bold">{fixedCostsCoverage.toFixed(1)}%</span>
                                </p>
                              </div>
                            )
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Month/Year Selector */}
              <div className="flex items-center space-x-4">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                >
                  <option value="todos">Todos</option>
                  {Array.from({length: 12}, (_, i) => {
                    const date = new Date(selectedYear, i, 1)
                    const value = date.toISOString().slice(0, 7)
                    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  })}
                </select>
                
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cards de Resumo Financeiro */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Custos Fixos/Recorrentes */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Custos Fixos/Recorrentes</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">
                    {formatCurrency(totalDespesasFixas)}
                  </p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Despesas Variáveis */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Despesas Variáveis</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatCurrency(totalDespesasVariaveis)}
                  </p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5 2z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Gráfico de Rosca */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Distribuição de Gastos</p>
                  <p className="text-lg font-semibold text-gray-800">Fixos vs Variáveis</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.054a.054.054 0 00-7.071l8.485 8.485a.054.054 0 00-7.071 8.485 8.485a.054.054 0 00-7.071 8.485 8.485a.054.054 0 00-7.071z" />
                  </svg>
                </div>
              </div>
              
              {/* Gráfico de Donut */}
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Fixos', value: totalDespesasFixas, fill: '#fb923c' },
                      { name: 'Variáveis', value: totalDespesasVariaveis, fill: '#dc2626' }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${percent.toFixed(0)}%`}
                  >
                    <Tooltip />
                  </Pie>
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: any, entry: any) => {
                      const entryName = entry?.payload?.name || entry?.name || 'Desconhecido'
                      const entryValue = typeof value === 'number' ? value : 0
                      return `${entryName}: ${formatCurrency(entryValue)}`
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Cards de Resumo Financeiro */}
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
                    </select>
                  </div>
                </div>
                
                {/* Checkbox for recurring expenses */}
                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newExpense.recorrente}
                      onChange={(e) => setNewExpense({...newExpense, recorrente: e.target.checked})}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Repetir mensalmente (Custo Fixo)</span>
                  </label>
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
              {filteredDespesas.length === 0 ? (
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
                    {filteredDespesas.map((despesa) => (
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
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditExpense(despesa)}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(despesa)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Edit Expense Modal */}
          {showEditExpense && editingExpense && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Editar Despesa</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição *
                    </label>
                    <input
                      type="text"
                      value={editingExpense.descricao}
                      onChange={(e) => setEditingExpense({...editingExpense, descricao: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingExpense.valor}
                      onChange={(e) => setEditingExpense({...editingExpense, valor: parseFloat(e.target.value)})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data *
                    </label>
                    <input
                      type="date"
                      value={editingExpense.data}
                      onChange={(e) => setEditingExpense({...editingExpense, data: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria
                    </label>
                    <select
                      value={editingExpense.categoria}
                      onChange={(e) => setEditingExpense({...editingExpense, categoria: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="transporte">Transporte</option>
                      <option value="alimentacao">Alimentação</option>
                      <option value="material">Material Médico</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  
                  {/* Checkbox for recurring expenses */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingExpense.recorrente || false}
                        onChange={(e) => setEditingExpense({...editingExpense, recorrente: e.target.checked})}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Repetir mensalmente (Custo Fixo)</span>
                    </label>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowEditExpense(false)
                      setEditingExpense(null)
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateExpense}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Atualizar Despesa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}