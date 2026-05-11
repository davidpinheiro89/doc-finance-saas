'use client'

// Cache-breaking comment: Force Vercel rebuild - 2024-05-11
interface Plantao {
  id: string
  usuario_id: string
  hospital: string
  data: string
  valor: number
  status: 'pendente' | 'pago' | 'confirmado' | 'realizado'
  horas?: number
  endereco?: string
  cep: string
  data_prevista_pagamento: string
  prazo_pagamento_dias: string
  classificacao: string
  especialidade: string
  tipo_evento?: 'plantao' | 'folga' | 'disponivel'
  local_favorito_id?: string | null
}

interface HistoryTableProps {
  upcomingPlantoes: Plantao[]
  formatCurrency: (value: number) => string
  formatDate: (date: string) => string
  getStatusColor: (status: string) => string
  handleEditPlantao: (plantao: Plantao) => void
  handleDeletePlantao: (id: string) => void
  deletingId: string | null
}

export default function HistoryTable({ 
  upcomingPlantoes, 
  formatCurrency, 
  formatDate, 
  getStatusColor, 
  handleEditPlantao, 
  handleDeletePlantao, 
  deletingId 
}: HistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Data
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Hospital/Local
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Valor
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Horas
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {upcomingPlantoes.map((plantao) => (
            <tr key={plantao.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="font-semibold text-orange-600">
                  {formatDate(plantao.data)}
                </div>
                {plantao.horas && (
                  <div className="text-xs text-gray-500">{plantao.horas}h</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div>
                  <button
                    onClick={() => {
                      const query = plantao.endereco || plantao.hospital
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
                      window.open(mapsUrl, '_blank')
                    }}
                    className="text-gray-900 hover:text-orange-500 font-medium underline underline-offset-2 hover:underline-offset-4 transition-all duration-200"
                  >
                    {plantao.hospital}
                  </button>
                </div>
                {plantao.endereco && (
                  <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                    {plantao.endereco}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                {formatCurrency(plantao.valor)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {plantao.horas}h
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(plantao.status)}`}>
                  {plantao.status.charAt(0).toUpperCase() + plantao.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditPlantao(plantao)}
                    className="text-orange-500 hover:text-orange-600 p-1 rounded hover:bg-orange-50 transition-colors duration-200"
                    title="Editar plantão"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2H5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeletePlantao(plantao.id)}
                    disabled={deletingId === plantao.id}
                    className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Excluir plantão"
                  >
                    {deletingId === plantao.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-red-500"></div>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 2H6.862a2 2 0 00-1.995-1.858L5 7m5 7v6m0 0-6-6-6h6m0 0-6 6 6" />
                      </svg>
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
