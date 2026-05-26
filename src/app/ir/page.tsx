'use client'

import { useState, useEffect } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import jsPDF from 'jspdf'
import type { Plantao, Despesa } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { isFolga } from '@/lib/folga-utils'

export default function ImpostoRendaPage() {
  const { user, loading } = useAuthGuard()
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    if (user) fetchData(user.id)
  }, [user])

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

  // Exclui folgas e remove duplicatas por id
  const seen = new Set<string>()
  const remunerados = yearlyPlantoes.filter(p => {
    if (isFolga(p)) return false
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  // Calculate yearly metrics
  const totalReceita = remunerados.reduce((sum, p) => sum + (p.valor || 0), 0)
  const totalDespesas = yearlyDespesas.reduce((sum, d) => sum + (d.valor || 0), 0)

  // ── Tabela Progressiva Mensal IRPF (vigente desde fev/2024) ──
  // Aplicada via carnê-leão para profissionais autônomos PF
  function calculateMonthlyTax(monthlyBase: number): number {
    if (monthlyBase <= 2259.20) return 0
    if (monthlyBase <= 2826.65) return monthlyBase * 0.075 - 169.44
    if (monthlyBase <= 3751.05) return monthlyBase * 0.15 - 381.44
    if (monthlyBase <= 4664.68) return monthlyBase * 0.225 - 662.77
    return monthlyBase * 0.275 - 896.00
  }

  // Agrupa receita por mês e calcula imposto mensal (carnê-leão)
  const monthlyIncome: Record<string, number> = {}
  remunerados.forEach(p => {
    const month = (p.data || '').split('T')[0].slice(0, 7) // YYYY-MM
    if (month) monthlyIncome[month] = (monthlyIncome[month] || 0) + (p.valor || 0)
  })

  let impostoDevido = 0
  let totalDeducao = 0
  const monthlyBreakdown = Object.entries(monthlyIncome)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, income]) => {
      const deducao = income * 0.20 // Dedução simplificada de 20%
      const base = Math.max(0, income - deducao)
      const tax = Math.max(0, calculateMonthlyTax(base))
      totalDeducao += deducao
      impostoDevido += tax
      return { month, income, deducao, base, tax }
    })

  // Limita dedução simplificada ao teto anual de R$16.754,34
  const deducaoSimplificada = Math.min(totalDeducao, 16754.34)
  const baseCalculo = Math.max(0, totalReceita - deducaoSimplificada)
  const aliquotaEfetiva = totalReceita > 0 ? (impostoDevido / totalReceita) * 100 : 0

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // Split puro da string YYYY-MM-DD para evitar conversão UTC (off-by-one no fuso UTC-3)
    if (!dateString) return ''
    const [year, month, day] = dateString.split('T')[0].split('-')
    if (year && month && day) return `${day}/${month}/${year}`
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
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      
      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 p-4 bg-white border-b sticky top-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <span className="h-6 w-6">☰</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Imposto de Renda</h1>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 hidden md:block">
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

          {/* Breakdown do Cálculo */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cálculo do Imposto — {selectedYear}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Receita Bruta (plantões)</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(totalReceita)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Despesas registradas</span>
                <span className="text-sm font-bold text-red-600">- {formatCurrency(totalDespesas)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Dedução simplificada (20%, máx. R$16.754,34/ano)</span>
                <span className="text-sm font-bold text-orange-600">- {formatCurrency(deducaoSimplificada)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between items-center py-2">
                <span className="text-sm font-semibold text-gray-800">Base de Cálculo anual</span>
                <span className="text-lg font-bold text-yellow-600">{formatCurrency(baseCalculo)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-semibold text-gray-800">Alíquota Efetiva</span>
                <span className="text-lg font-bold text-blue-600">{aliquotaEfetiva.toFixed(2)}%</span>
              </div>
              <div className="border-t-2 border-gray-300 pt-3 flex justify-between items-center py-2">
                <span className="text-base font-bold text-gray-900">Imposto Devido (carnê-leão)</span>
                <span className="text-2xl font-extrabold text-blue-700">{formatCurrency(impostoDevido)}</span>
              </div>
            </div>
          </div>

          {/* Resumo Mensal — Carnê-Leão */}
          {monthlyBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Detalhamento Mensal (Carnê-Leão)</h3>
                <p className="text-xs text-gray-500 mt-1">Tabela progressiva aplicada mês a mês com dedução simplificada de 20%</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Receita</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dedução 20%</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Faixa</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Imposto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthlyBreakdown.map(row => {
                      const [y, m] = row.month.split('-')
                      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                      const monthLabel = `${monthNames[parseInt(m) - 1]}/${y}`
                      const faixa = row.base <= 2259.20 ? 'Isento'
                        : row.base <= 2826.65 ? '7,5%'
                        : row.base <= 3751.05 ? '15%'
                        : row.base <= 4664.68 ? '22,5%'
                        : '27,5%'
                      return (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{monthLabel}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{formatCurrency(row.income)}</td>
                          <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(row.deducao)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700 font-medium">{formatCurrency(row.base)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              faixa === 'Isento' ? 'bg-green-100 text-green-700'
                                : faixa === '7,5%' ? 'bg-yellow-100 text-yellow-700'
                                : faixa === '15%' ? 'bg-orange-100 text-orange-700'
                                : faixa === '22,5%' ? 'bg-red-100 text-red-700'
                                : 'bg-red-200 text-red-800'
                            }`}>{faixa}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-blue-700">{formatCurrency(row.tax)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-sm text-gray-900">TOTAL</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(totalReceita)}</td>
                      <td className="px-4 py-3 text-sm text-right text-orange-700">{formatCurrency(deducaoSimplificada)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(baseCalculo)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-sm text-right text-blue-800">{formatCurrency(impostoDevido)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                  <li>• Utilizamos a dedução simplificada de 20% (limitada a R$ 16.754,34/ano)</li>
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
                  {remunerados.map((plantao) => (
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
