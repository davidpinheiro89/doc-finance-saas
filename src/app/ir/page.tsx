'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import jsPDF from 'jspdf'

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
}

export default function ImpostoRendaPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
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

  // Filter data by selected year
  const getYearlyData = () => {
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59)

    const yearlyPlantoes = plantoes.filter(plantao => {
      const plantaoDate = new Date(plantao.data)
      return plantaoDate >= yearStart && plantaoDate <= yearEnd
    })

    const yearlyDespesas = despesas.filter(despesa => {
      const despesaDate = new Date(despesa.data)
      return despesaDate >= yearStart && despesaDate <= yearEnd
    })

    return { yearlyPlantoes, yearlyDespesas }
  }

  const { yearlyPlantoes, yearlyDespesas } = getYearlyData()

  // Calculate yearly metrics
  const totalReceita = yearlyPlantoes.reduce((sum, p) => sum + (p.valor || 0), 0)
  const totalDespesas = yearlyDespesas.reduce((sum, d) => sum + (d.valor || 0), 0)
  
  // Tax calculations for Brazilian income tax (simplified)
  const deducaoSimplificada = Math.min(totalReceita * 0.20, 16755.98) // 20% or R$ 16.755,98 limit
  const baseCalculo = Math.max(0, totalReceita - deducaoSimplificada)
  
  // Simplified tax calculation (actual rates may vary)
  const impostoDevido = calculateTax(baseCalculo)

  function calculateTax(base: number): number {
    if (base <= 22847.76) return 0
    if (base <= 33919.80) return (base - 22847.76) * 0.075
    if (base <= 45012.60) return 1713.58 + (base - 33919.80) * 0.15
    if (base <= 55976.16) return 4257.57 + (base - 45012.60) * 0.225
    return 6555.61 + (base - 55976.16) * 0.275
  }

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

  const generatePDFReport = () => {
    try {
      // Create new PDF document
      const doc = new jsPDF()
      
      // Add title
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('BEM Plantonista - Relatório Anual de Rendimentos', 105, 20, { align: 'center' })
      
      // Add year reference
      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(`Ano de Referência: ${selectedYear}`, 105, 35, { align: 'center' })
      
      // Add financial data table
      const tableData = [
        ['Descrição', 'Valor (R$)'],
        ['Receita Total', formatCurrency(totalReceita)],
        ['Total de Despesas', formatCurrency(totalDespesas)],
        ['Base de Cálculo', formatCurrency(baseCalculo)],
        ['Imposto Devido', formatCurrency(impostoDevido)]
      ]
      
      // Manual table creation
      let yPosition = 50
      tableData.forEach((row, index) => {
        if (index === 0) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(11)
        }
        doc.text(row[0], 20, yPosition)
        doc.text(row[1], 120, yPosition)
        yPosition += 10
      })
      
      // Add footer note
      const finalY = yPosition + 20
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.text('Nota: Este é um resumo para fins de conferência.', 105, finalY, { align: 'center' })
      doc.text('Para valores oficiais, consulte sua declaração completa.', 105, finalY + 7, { align: 'center' })
      
      // Save the PDF
      const fileName = `relatorio-rendimentos-${selectedYear}.pdf`
      doc.save(fileName)
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Erro ao gerar PDF. Tente novamente.')
    }
  }

  const getYears = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = currentYear; year >= currentYear - 5; year--) {
      years.push(year)
    }
    return years
  }

  // Group despesas by category
  const despesasByCategory = yearlyDespesas.reduce((acc, despesa) => {
    if (!acc[despesa.categoria]) {
      acc[despesa.categoria] = 0
    }
    acc[despesa.categoria] += despesa.valor
    return acc
  }, {} as Record<string, number>)

  // Group plantões by month
  const receitasByMonth = yearlyPlantoes.reduce((acc, plantao) => {
    const month = new Date(plantao.data).getMonth()
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthName = monthNames[month]
    if (!acc[monthName]) {
      acc[monthName] = 0
    }
    acc[monthName] += plantao.valor
    return acc
  }, {} as Record<string, number>)

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
              Imposto de <span className="text-orange-500">Renda</span>
            </h1>
            <p className="text-gray-600 mt-2">Resumo anual para declaração de imposto de renda</p>
          </div>

          {/* Year Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ano de Referência
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="block px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {getYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={generatePDFReport}
                className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Gerar Relatório PDF
              </button>
            </div>
          </div>

          {/* Resumo Financeiro */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Receita Total</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {formatCurrency(totalReceita)}
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  <p className="text-sm font-medium text-gray-600">Base de Cálculo</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-2">
                    {formatCurrency(baseCalculo)}
                  </p>
                </div>
                <div className="bg-yellow-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Imposto Devido</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {formatCurrency(impostoDevido)}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m12 0v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2m12 0H6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Detalhes por Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Despesas por Categoria */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Despesas por Categoria</h3>
              <div className="space-y-3">
                {Object.entries(despesasByCategory).map(([categoria, valor]) => (
                  <div key={categoria} className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="bg-gray-100 rounded-full p-2 mr-3">
                        <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700 capitalize">{categoria}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Receitas por Mês */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Receitas por Mês</h3>
              <div className="space-y-3">
                {Object.entries(receitasByMonth).map(([mes, valor]) => (
                  <div key={mes} className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="bg-green-100 rounded-full p-2 mr-3">
                        <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{mes}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Informações Importantes */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-start">
              <div className="bg-blue-100 rounded-full p-2 mr-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-blue-800 mb-2">Informações Importantes</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Os valores são baseados nos plantões e despesas registrados no sistema</li>
                  <li>• Utilizamos a dedução simplificada de 20% (limitada a R$ 16.755,98)</li>
                  <li>• As alíquotas de imposto seguem a tabela progressiva da Receita Federal</li>
                  <li>• Consulte um contador para orientações específicas sobre sua declaração</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tabela Detalhada */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Detalhamento Anual</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {yearlyPlantoes.map((plantao) => (
                    <tr key={plantao.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Receita
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Plantão - {plantao.hospital}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(plantao.data)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(plantao.valor)}
                      </td>
                    </tr>
                  ))}
                  {yearlyDespesas.map((despesa) => (
                    <tr key={despesa.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Despesa
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {despesa.descricao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(despesa.data)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(despesa.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
