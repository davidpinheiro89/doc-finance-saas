'use client'

import { useState } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import Sidebar from '@/components/Sidebar'

const PRICE_OPTIONS = [
  { value: 'sim_29_90', label: 'Sim, R$29,90/mês com certeza' },
  { value: 'sim_49_90', label: 'Sim, pagaria R$49,90/mês (preço normal)' },
  { value: 'prefiro_anual', label: 'Prefiro o plano anual R$299,00/ano' },
  { value: 'talvez', label: 'Talvez, preciso usar mais' },
  { value: 'nao_pagaria', label: 'Não pagaria por enquanto' },
]

const FEATURE_OPTIONS = [
  { value: 'financeiro', label: 'Painel Financeiro' },
  { value: 'escala', label: 'Calendário de Escalas' },
  { value: 'documentos', label: 'Carteira Digital' },
  { value: 'ir', label: 'Estimativa de IR' },
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'whatsapp', label: 'Compartilhamento WhatsApp' },
]

export default function FeedbackPage() {
  const { user, loading } = useAuthGuard()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [priceOption, setPriceOption] = useState('')
  const [favoriteFeature, setFavoriteFeature] = useState('')
  const [missingFeature, setMissingFeature] = useState('')
  const [nps, setNps] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!user || !priceOption) return
    setSending(true)
    try {
      await supabase.from('feedback').insert({
        user_id: user.id,
        price_option: priceOption,
        favorite_feature: favoriteFeature || null,
        missing_feature: missingFeature.trim() || null,
        nps,
        comment: comment.trim() || null,
      })
      setSent(true)
    } catch {
      alert('Erro ao enviar feedback. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
    </div>
  )

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-50/80">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 py-3 flex items-center gap-3 md:hidden">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Feedback</h1>
        </div>

        <div className="max-w-xl mx-auto px-4 md:px-8 py-6 md:py-10">
          {sent ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Obrigado pelo feedback!</h2>
              <p className="text-sm text-gray-500 mb-6">Sua opinião nos ajuda a melhorar o BEM Plantonista.</p>
              <button onClick={() => setSent(false)} className="text-sm text-orange-600 hover:underline">
                Enviar outro feedback
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Sua opinião importa</h1>
                <p className="text-sm text-gray-500 mt-1">Ajude-nos a construir o melhor produto para médicos plantonistas.</p>
              </div>

              <div className="space-y-8">
                {/* Preço */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Você pagaria pelo BEM Plantonista? *
                  </label>
                  <div className="space-y-2">
                    {PRICE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setPriceOption(opt.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                          priceOption === opt.value
                            ? 'border-orange-400 bg-orange-50 text-orange-800 font-medium ring-1 ring-orange-400'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Funcionalidade favorita */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Qual funcionalidade você mais usa?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {FEATURE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFavoriteFeature(opt.value)}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          favoriteFeature === opt.value
                            ? 'border-orange-400 bg-orange-50 text-orange-800 ring-1 ring-orange-400'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* O que falta */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                    O que falta no BEM Plantonista?
                  </label>
                  <input
                    type="text"
                    value={missingFeature}
                    onChange={e => setMissingFeature(e.target.value)}
                    placeholder="Ex: integração com hospital, app nativo..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>

                {/* NPS */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    De 0 a 10, o quanto recomendaria a um colega?
                  </label>
                  <div className="flex gap-1.5">
                    {Array.from({ length: 11 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setNps(i)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                          nps === i
                            ? i <= 6 ? 'bg-red-500 text-white' : i <= 8 ? 'bg-yellow-500 text-white' : 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">Nada provável</span>
                    <span className="text-[10px] text-gray-400">Com certeza</span>
                  </div>
                </div>

                {/* Comentário livre */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                    Algo mais que queira compartilhar?
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    placeholder="Sugestões, críticas, elogios..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={sending || !priceOption}
                  className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-sm shadow-orange-500/20 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Feedback'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
