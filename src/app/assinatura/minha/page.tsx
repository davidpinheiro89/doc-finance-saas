'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export default function MinhaAssinaturaPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
    </div>
  )

  const subStatus = user?.user_metadata?.subscription_status || 'inactive'
  const subPlan = user?.user_metadata?.subscription_plan || 'beta'
  const subEndDate = user?.user_metadata?.subscription_end_date || null
  const isActive = subStatus === 'active'

  // --- Trial calculation ---
  const TRIAL_DAYS = 30
  const createdAt = user?.created_at ? new Date(user.created_at) : null
  const today = new Date()
  const diffMs = createdAt ? today.getTime() - createdAt.getTime() : 0
  const daysUsed = createdAt ? Math.min(Math.floor(diffMs / (1000 * 60 * 60 * 24)), TRIAL_DAYS) : 0
  const daysLeft = Math.max(TRIAL_DAYS - daysUsed, 0)
  const trialProgress = Math.min((daysUsed / TRIAL_DAYS) * 100, 100)
  const trialExpired = daysLeft === 0
  const isBetaOrFree = subPlan === 'beta' || subPlan === 'free' || !isActive

  const planLabel = (() => {
    switch (subPlan) {
      case 'mensal': return 'Mensal'
      case 'anual': return 'Anual'
      case 'beta': return 'Beta Gratuito'
      default: return 'Beta Gratuito'
    }
  })()

  const formatDate = (iso: string | null) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch { return null }
  }

  const progressColor =
    trialProgress >= 90 ? 'bg-red-500' :
    trialProgress >= 70 ? 'bg-amber-500' :
    'bg-orange-500'

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 overflow-auto w-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100">
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Minha Assinatura</h1>
                <p className="text-xs text-gray-500">Gerencie seu plano do BEM Plantonista</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Card: Trial */}
          {isBetaOrFree && (
            <div className={`rounded-2xl border shadow-sm overflow-hidden ${
              trialExpired
                ? 'bg-red-50 border-red-200'
                : 'bg-white border-gray-200/60'
            }`}>
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  {trialExpired ? '⚠️ Trial encerrado' : '⏳ Período de trial'}
                </h2>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  trialExpired
                    ? 'bg-red-100 text-red-600 border-red-200'
                    : daysLeft <= 5
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-orange-100 text-orange-700 border-orange-100'
                }`}>
                  {trialExpired ? 'Expirado' : `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{daysUsed} dia{daysUsed !== 1 ? 's' : ''} utilizados</span>
                    <span>{TRIAL_DAYS} dias no total</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${progressColor}`}
                      style={{ width: `${trialProgress}%` }}
                    />
                  </div>
                </div>

                {trialExpired ? (
                  <p className="text-sm text-red-600 font-medium">
                    Seu trial de 30 dias encerrou. Assine agora para continuar usando o BEM Plantonista.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Você tem acesso gratuito a todas as funcionalidades durante o trial.{' '}
                    {daysLeft <= 7 && (
                      <span className="font-semibold text-amber-600">
                        Seu trial termina em breve — garanta seu plano!
                      </span>
                    )}
                  </p>
                )}

                <button
                  onClick={() => router.push('/assinatura')}
                  className={`w-full py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all active:scale-[0.98] ${
                    trialExpired
                      ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/20 hover:shadow-lg'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/20 hover:shadow-lg'
                  }`}
                >
                  {trialExpired ? 'Assinar agora' : 'Ver planos e assinar'}
                </button>
              </div>
            </div>
          )}

          {/* Card: Plano Atual */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Plano Atual</h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Plano</span>
                <span className="text-sm font-semibold text-gray-900">{planLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-semibold ${isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Validade</span>
                <span className="text-sm font-medium text-gray-700">
                  {formatDate(subEndDate) || (isActive ? '30 dias a partir do cadastro' : '--')}
                </span>
              </div>
              {subPlan === 'beta' && isActive && (
                <div className="mt-2 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl">
                  <p className="text-xs text-orange-700">
                    Você está no <span className="font-bold">plano Beta Gratuito</span>. Aproveite para explorar todas as funcionalidades!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card: Upgrade */}
          {isBetaOrFree && isActive && !trialExpired && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200/60 shadow-sm overflow-hidden">
              <div className="px-6 py-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
                    <span className="text-white text-lg">⭐</span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900">Gostou do BEM Plantonista?</h2>
                </div>
                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                  Após o período beta, continue com acesso completo por apenas{' '}
                  <span className="font-bold text-orange-600">R$ 29,90/mês</span> ou{' '}
                  <span className="font-bold text-emerald-600">R$ 299,00/ano</span> (economia de ~37%).
                </p>
                <button
                  onClick={() => router.push('/assinatura')}
                  className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  Ver planos
                </button>
              </div>
            </div>
          )}

          {/* Card: Suporte */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Suporte</h2>
              <p className="text-xs text-gray-500 mt-0.5">Dúvidas sobre sua assinatura?</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <a
                href="https://wa.me/5511985904388?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20minha%20assinatura%20do%20BEM%20Plantonista."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition-colors"
              >
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Falar pelo WhatsApp
              </a>
              <a
                href="mailto:suporte@bemplantonista.com.br?subject=D%C3%BAvida%20sobre%20assinatura"
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200/60 rounded-xl transition-colors"
              >
                <svg className="h-5 w-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                suporte@bemplantonista.com.br
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}