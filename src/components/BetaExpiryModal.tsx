'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SESSION_KEY = 'bem_beta_expiry_dismissed'

interface BetaExpiryModalProps {
  subscriptionStatus?: string
  subscriptionEndDate?: string
  subscriptionPlan?: string
}

export default function BetaExpiryModal({
  subscriptionStatus,
  subscriptionEndDate,
  subscriptionPlan,
}: BetaExpiryModalProps) {
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return

    if (subscriptionStatus !== 'active') return
    if (!subscriptionEndDate) return

    // Não mostrar para assinantes pagos (quem tem plano definido via Asaas)
    if (subscriptionPlan && subscriptionPlan !== 'beta') return

    const endDate = new Date(subscriptionEndDate)
    if (endDate <= new Date()) return

    setShow(true)
  }, [subscriptionStatus, subscriptionEndDate, subscriptionPlan])

  if (!show) return null

  const endDate = new Date(subscriptionEndDate!)
  const now = new Date()
  const diffMs = endDate.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  const formattedDate = endDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, 'true')
    setShow(false)
  }

  const handleSubscribe = () => {
    sessionStorage.setItem(SESSION_KEY, 'true')
    router.push('/assinatura')
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-orange-100 mb-4">
            <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Seu período gratuito está encerrando</h2>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            Você tem <span className="font-bold text-orange-600">{daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}</span> de acesso gratuito.
            Para continuar usando o BEM Plantonista após <span className="font-semibold">{formattedDate}</span>, escolha um plano:
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
              <span className="text-sm font-medium text-gray-700">Mensal</span>
              <span className="text-sm font-bold text-gray-900">R$ 39,90/mês</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 rounded-xl border border-orange-200">
              <div>
                <span className="text-sm font-medium text-gray-700">Anual</span>
                <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Mais popular</span>
              </div>
              <span className="text-sm font-bold text-gray-900">R$ 299,00/ano</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={handleSubscribe}
            className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl transition-all hover:shadow-md active:scale-[0.98]"
          >
            Assinar agora
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            Lembrar depois
          </button>
        </div>
      </div>
    </div>
  )
}
