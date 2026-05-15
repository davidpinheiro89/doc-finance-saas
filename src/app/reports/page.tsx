'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import jsPDF from 'jspdf'
import type { Plantao } from '@/types/database'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export default function ReportsPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    if (user) {
      fetchPlantoes()
    }
  }, [user, selectedMonth, selectedYear])

  const fetchPlantoes = async () => {
    try {
      const { data, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('user_id', user!.id)
        .order('data', { ascending: false })

      if (error) {
        console.error('Error fetching plantões:', error)
        setPlantoes([])
      } else {
        setPlantoes(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setPlantoes([])
    }
  }

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
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  // 'atrasado' é um status DERIVADO (não persistido). Um plantão está atrasado
  // quando não foi pago e a data + prazo_pagamento_dias já passaram.
  const isOverdue = (p: Plantao) => {
    if (p.status === 'pago' || !p.prazo_pagamento_dias) return false
    const deadline = new Date(p.data)
    deadline.setDate(deadline.getDate() + p.prazo_pagamento_dias)
    return deadline < new Date()
  }

  const generatePDFReport = async () => {
    setGeneratingPDF(true)
    try {
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      
      // Set custom font for better appearance
      pdf.setFont('helvetica')
      
      // Header Section
      pdf.setFontSize(24)
      pdf.setTextColor('#FF6600')
      pdf.text('Relatório de Plantões', pageWidth / 2, 30, { align: 'center' })
      
      // Doctor Info
      pdf.setFontSize(12)
      pdf.setTextColor('#333333')
      const doctorName = user?.user_metadata?.full_name || 'Médico'
      const doctorCRM = user?.user_metadata?.crm || 'CRM não informado'
      pdf.text(`Dr(a): ${doctorName}`, 20, 55)
      pdf.text(`CRM: ${doctorCRM}`, 20, 65)
      
      // Date
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
      pdf.text(`Período: ${monthNames[selectedMonth]} ${selectedYear}`, pageWidth - 20, 55, { align: 'right' })
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 20, 65, { align: 'right' })
      
      // Divider
      pdf.setDrawColor('#FF6600')
      pdf.setLineWidth(0.5)
      pdf.line(20, 75, pageWidth - 20, 75)
      
      // Financial Summary
      pdf.setFontSize(16)
      pdf.setTextColor('#FF6600')
      pdf.text('Resumo Financeiro', 20, 90)
      
      pdf.setFontSize(12)
      pdf.setTextColor('#333333')
      
      // Calculate monthly data
      const monthPlantoes = plantoes.filter(p => {
        const plantaoDate = new Date(p.data)
        return plantaoDate.getMonth() === selectedMonth && plantaoDate.getFullYear() === selectedYear
      })
      
      const totalRevenue = monthPlantoes.reduce((sum, p) => sum + p.valor, 0)
      const totalHours = monthPlantoes.reduce((sum, p) => sum + (p.horas || 0), 0)
      const paidAmount = monthPlantoes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0)
      const pendingAmount = monthPlantoes.filter(p => p.status === 'pendente' || p.status === 'confirmado').reduce((sum, p) => sum + p.valor, 0)
      const overdueAmount = monthPlantoes.filter(isOverdue).reduce((sum, p) => sum + p.valor, 0)
      
      // Summary boxes
      pdf.setFillColor('#FFF3E0')
      pdf.rect(20, 100, 80, 30, 'F')
      pdf.rect(110, 100, 80, 30, 'F')
      
      pdf.setFillColor('#E8F5E8')
      pdf.rect(20, 140, 80, 30, 'F')
      pdf.rect(110, 140, 80, 30, 'F')
      
      if (overdueAmount > 0) {
        pdf.setFillColor('#FEE2E2')
        pdf.rect(20, 180, 80, 30, 'F')
        pdf.rect(110, 180, 80, 30, 'F')
      }
      
      pdf.setTextColor('#333333')
      pdf.setFontSize(10)
      pdf.text('Total Faturado', 25, 110)
      pdf.setFontSize(14)
      pdf.text(formatCurrency(totalRevenue), 25, 120)
      
      pdf.setFontSize(10)
      pdf.text('Total Horas', 115, 110)
      pdf.setFontSize(14)
      pdf.text(`${totalHours.toFixed(1)}h`, 115, 120)
      
      pdf.setFontSize(10)
      pdf.text('Recebido', 25, 150)
      pdf.setFontSize(14)
      pdf.text(formatCurrency(paidAmount), 25, 160)
      
      pdf.setFontSize(10)
      pdf.text('A Receber', 115, 150)
      pdf.setFontSize(14)
      pdf.text(formatCurrency(pendingAmount), 115, 160)
      
      if (overdueAmount > 0) {
        pdf.setFontSize(10)
        pdf.text('Atrasado', 25, 190)
        pdf.setFontSize(14)
        pdf.setTextColor('#EF4444')
        pdf.text(formatCurrency(overdueAmount), 25, 200)
        
        pdf.setFontSize(10)
        pdf.text('Plantões Atrasados', 115, 190)
        pdf.setFontSize(14)
        pdf.setTextColor('#EF4444')
        pdf.text(`${monthPlantoes.filter(isOverdue).length}`, 115, 200)
      }
      
      // Detailed Plantões List
      const startY = overdueAmount > 0 ? 220 : 190
      pdf.setFontSize(16)
      pdf.setTextColor('#FF6600')
      pdf.text('Plantões Detalhados', 20, startY)
      
      // Table headers
      pdf.setFontSize(10)
      pdf.setTextColor('#666666')
      pdf.text('Data', 20, startY + 15)
      pdf.text('Local', 60, startY + 15)
      pdf.text('Horas', 120, startY + 15)
      pdf.text('Valor', 150, startY + 15)
      pdf.text('Status', 180, startY + 15)
      
      // Table line
      pdf.setDrawColor('#DDDDDD')
      pdf.line(20, startY + 20, pageWidth - 20, startY + 20)
      
      // Table data
      pdf.setTextColor('#333333')
      let yPosition = startY + 30
      
      monthPlantoes.forEach((plantao, index) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage()
          yPosition = 30
          
          // Repeat headers on new page
          pdf.setFontSize(10)
          pdf.setTextColor('#666666')
          pdf.text('Data', 20, yPosition)
          pdf.text('Local', 60, yPosition)
          pdf.text('Horas', 120, yPosition)
          pdf.text('Valor', 150, yPosition)
          pdf.text('Status', 180, yPosition)
          
          pdf.setDrawColor('#DDDDDD')
          pdf.line(20, yPosition + 5, pageWidth - 20, yPosition + 5)
          
          yPosition += 15
          pdf.setTextColor('#333333')
        }
        
        pdf.setFontSize(9)
        pdf.text(formatDate(plantao.data), 20, yPosition)
        
        // Truncate long hospital names
        const hospitalName = plantao.hospital.length > 20 ? plantao.hospital.substring(0, 20) + '...' : plantao.hospital
        pdf.text(hospitalName, 60, yPosition)
        
        pdf.text(`${plantao.horas || 0}h`, 120, yPosition)
        pdf.text(formatCurrency(plantao.valor), 150, yPosition)
        
        // Status with color
        const statusText = plantao.status.charAt(0).toUpperCase() + plantao.status.slice(1)
        if (plantao.status === 'pago') {
          pdf.setTextColor('#22C55E')
        } else if (isOverdue(plantao)) {
          pdf.setTextColor('#EF4444')
        } else if (plantao.status === 'confirmado') {
          pdf.setTextColor('#3B82F6')
        } else {
          pdf.setTextColor('#F59E0B')
        }
        pdf.text(statusText, 180, yPosition)
        
        pdf.setTextColor('#333333')
        yPosition += 12
      })
      
      // Footer
      pdf.setFontSize(8)
      pdf.setTextColor('#999999')
      pdf.text('Relatório gerado pelo BEM Plantonista', pageWidth / 2, pageHeight - 10, { align: 'center' })
      
      // Save the PDF
      pdf.save(`relatorio-plantoes-${monthNames[selectedMonth]}-${selectedYear}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
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

  // Calculate metrics for selected period
  const monthPlantoes = plantoes.filter(p => {
    const plantaoDate = new Date(p.data)
    return plantaoDate.getMonth() === selectedMonth && plantaoDate.getFullYear() === selectedYear
  })

  const totalRevenue = monthPlantoes.reduce((sum, p) => sum + p.valor, 0)
  const totalHours = monthPlantoes.reduce((sum, p) => sum + (p.horas || 0), 0)
  const paidAmount = monthPlantoes.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0)
  const pendingAmount = monthPlantoes.filter(p => p.status === 'pendente' || p.status === 'confirmado').reduce((sum, p) => sum + p.valor, 0)
  const overdueAmount = monthPlantoes.filter(isOverdue).reduce((sum, p) => sum + p.valor, 0)

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">BEM</h1>
              <span className="ml-2 text-2xl font-bold text-orange-500">Plantonista</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600 mt-2">Gere relatórios detalhados dos seus plantões</p>
        </div>

        {/* Period Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecionar Período</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
                Mês
              </label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                Ano
              </label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Faturado</p>
                <p className="text-2xl font-bold text-orange-500 mt-2">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Horas</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {totalHours.toFixed(1)}h
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recebido</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {formatCurrency(paidAmount)}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">A Receber</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">
                  {formatCurrency(pendingAmount)}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <svg className="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Report Button */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Gerar Relatório PDF</h3>
              <p className="text-gray-600 mt-1">Baixe um relatório completo em PDF com todos os dados do período selecionado</p>
            </div>
            <button
              onClick={generatePDFReport}
              disabled={generatingPDF || monthPlantoes.length === 0}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{generatingPDF ? 'Gerando...' : 'Baixar Relatório'}</span>
            </button>
          </div>
        </div>

        {/* Plantões Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Plantões do Período</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Horas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthPlantoes.length > 0 ? (
                  monthPlantoes.map((plantao) => (
                    <tr key={plantao.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(plantao.data)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {plantao.hospital}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {plantao.horas ? `${plantao.horas}h` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(plantao.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          plantao.status === 'pago' ? 'bg-green-100 text-green-800' :
                          isOverdue(plantao) ? 'bg-red-100 text-red-800' :
                          plantao.status === 'confirmado' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {plantao.status.charAt(0).toUpperCase() + plantao.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Nenhum plantão encontrado para o período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
