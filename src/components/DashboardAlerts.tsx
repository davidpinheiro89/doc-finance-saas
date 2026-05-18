'use client'

import { useMemo } from 'react'
import type { PlantaoListItem } from '@/lib/queries/plantoes'
import { todayLocalISO } from '@/lib/date-utils'

interface DashboardAlertsProps {
  plantoes: PlantaoListItem[]
  getSmartStatus: (p: PlantaoListItem) => string
  isLoading?: boolean
}

export default function DashboardAlerts({ plantoes, getSmartStatus, isLoading }: DashboardAlertsProps) {
  const todayStr = todayLocalISO()

  // Tomorrow's date string
  const tomorrowStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Plantões scheduled for tomorrow
  const tomorrowPlantoes = useMemo(() => {
    return plantoes.filter(p => {
      const d = (p.data || '').split('T')[0]
      return d === tomorrowStr && p.classificacao !== 'folga' && p.classificacao !== 'disponivel'
    })
  }, [plantoes, tomorrowStr])

  // Overdue plantões (atrasado status)
  const overduePlantoes = useMemo(() => {
    return plantoes.filter(p => getSmartStatus(p) === 'atrasado')
  }, [plantoes, getSmartStatus])

  if (isLoading || (tomorrowPlantoes.length === 0 && overduePlantoes.length === 0)) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Tomorrow's events alert */}
      {tomorrowPlantoes.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/60 p-4 md:p-5">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-sky-200/20" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-sky-500/20">
              <svg className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Próximo Evento: {tomorrowPlantoes.length === 1
                  ? <span className="text-sky-700">{tomorrowPlantoes[0].hospital}</span>
                  : <span className="text-sky-700">{tomorrowPlantoes.length} plantões</span>
                } amanhã
              </p>
              {tomorrowPlantoes.length === 1 ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  {tomorrowPlantoes[0].horas ? `${tomorrowPlantoes[0].horas}h` : ''}
                  {tomorrowPlantoes[0].especialidade && tomorrowPlantoes[0].especialidade !== tomorrowPlantoes[0].classificacao
                    ? ` · ${tomorrowPlantoes[0].especialidade}` : ''}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {tomorrowPlantoes.slice(0, 3).map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 border border-sky-200/60 text-[10px] font-medium text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      {p.hospital}
                    </span>
                  ))}
                  {tomorrowPlantoes.length > 3 && (
                    <span className="text-[10px] text-gray-400 font-medium self-center">+{tomorrowPlantoes.length - 3} mais</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overdue payments alert */}
      {overduePlantoes.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/60 p-4 md:p-5">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-red-200/20" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-red-500/20">
              <svg className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Fluxo de Caixa: <span className="text-red-600">{overduePlantoes.length} plantão(ões)</span> com repasse atrasado
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Lembre-se de efetuar a cobrança junto ao hospital/contratante.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {overduePlantoes.slice(0, 4).map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 border border-red-200/60 text-[10px] font-medium text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {p.hospital}
                  </span>
                ))}
                {overduePlantoes.length > 4 && (
                  <span className="text-[10px] text-gray-400 font-medium self-center">+{overduePlantoes.length - 4} mais</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
