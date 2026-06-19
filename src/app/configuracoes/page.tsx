'use client'

import { useState, useEffect } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useCoresEvento, type CoresEvento } from '@/hooks/useCoresEvento'
import { BLOCK_TYPES, BLOCK_COLORS, type BlockColorKey, type BlockTypeKey } from '@/lib/block-config'

type RegimeTributario = 'pessoa_fisica' | 'simples_nacional' | 'lucro_presumido'

const REGIME_OPTIONS: { key: RegimeTributario; label: string; description: string }[] = [
  { key: 'pessoa_fisica', label: 'Pessoa Física', description: 'Carnê-Leão com tabela progressiva IRPF' },
  { key: 'simples_nacional', label: 'Simples Nacional', description: 'Anexo III/V — alíquota efetiva sobre faturamento' },
  { key: 'lucro_presumido', label: 'Lucro Presumido', description: 'Presunção de 32% + IRPJ 15% + CSLL 9% + PIS/COFINS 3,65%' },
]

export default function ConfiguracoesPage() {
  const { user, loading } = useAuthGuard()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // ── Cores dos Eventos ──
  const { coresEvento, loading: coresLoading, salvarCoresEvento } = useCoresEvento(user?.id)
  const [coresLocal, setCoresLocal] = useState<CoresEvento | null>(null)
  const [coresSaving, setCoresSaving] = useState(false)
  const [coresSaved, setCoresSaved] = useState(false)

  useEffect(() => {
    if (!coresLoading && coresEvento) {
      setCoresLocal({ ...coresEvento })
    }
  }, [coresLoading, coresEvento])

  const handleCorChange = (tipo: BlockTypeKey, cor: BlockColorKey) => {
    if (!coresLocal) return
    setCoresLocal({ ...coresLocal, [tipo]: cor })
    setCoresSaved(false)
  }

  const handleSalvarCores = async () => {
    if (!coresLocal) return
    setCoresSaving(true)
    const ok = await salvarCoresEvento(coresLocal)
    setCoresSaving(false)
    if (ok) {
      setCoresSaved(true)
      setTimeout(() => setCoresSaved(false), 3000)
    }
  }

  // ── Meta Mensal ──
  const [metaMensal, setMetaMensal] = useState<number>(0)
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaSaved, setMetaSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('meta_mensal')
        .eq('user_id', user.id)
        .single()
      if (data?.meta_mensal != null) setMetaMensal(data.meta_mensal)
    }
    fetch()
  }, [user])

  const handleSalvarMeta = async () => {
    if (!user) return
    setMetaSaving(true)
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, meta_mensal: metaMensal }, { onConflict: 'user_id' })
    setMetaSaving(false)
    if (!error) {
      setMetaSaved(true)
      setTimeout(() => setMetaSaved(false), 3000)
    }
  }

  // ── Regime Tributário ──
  const [regime, setRegime] = useState<RegimeTributario>('pessoa_fisica')
  const [regimeSaving, setRegimeSaving] = useState(false)
  const [regimeSaved, setRegimeSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('regime_tributario')
        .eq('user_id', user.id)
        .single()
      if (data?.regime_tributario) setRegime(data.regime_tributario as RegimeTributario)
    }
    fetch()
  }, [user])

  const handleSalvarRegime = async (value: RegimeTributario) => {
    if (!user) return
    setRegime(value)
    setRegimeSaving(true)
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, regime_tributario: value }, { onConflict: 'user_id' })
    setRegimeSaving(false)
    if (!error) {
      setRegimeSaved(true)
      setTimeout(() => setRegimeSaved(false), 3000)
    }
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
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 overflow-auto w-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* ── Cores dos Eventos ── */}
          <section className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Cores dos Eventos</h2>
            <p className="text-sm text-gray-500 mb-6">Defina a cor padrão de cada tipo de evento na sua escala. Ao criar um novo evento, a cor já virá pré-selecionada.</p>

            {coresLoading || !coresLocal ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {BLOCK_TYPES.map(tipo => (
                  <div key={tipo.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-700">{tipo.label}</span>
                    <div className="flex gap-2">
                      {BLOCK_COLORS.map(cor => (
                        <button
                          key={cor.key}
                          type="button"
                          onClick={() => handleCorChange(tipo.key, cor.key)}
                          className={`w-7 h-7 rounded-full ${cor.dot} transition-all ${
                            coresLocal[tipo.key] === cor.key
                              ? 'ring-2 ring-offset-2 ring-orange-400 scale-110'
                              : 'opacity-50 hover:opacity-100 hover:scale-105'
                          }`}
                          title={cor.label}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={handleSalvarCores}
                    disabled={coresSaving}
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {coresSaving ? 'Salvando...' : 'Salvar cores'}
                  </button>
                  {coresSaved && (
                    <span className="text-sm text-emerald-600 font-medium">✓ Salvo</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Meta Mensal ── */}
          <section className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Meta Mensal de Faturamento</h2>
            <p className="text-sm text-gray-500 mb-6">Defina sua meta de faturamento bruto mensal. Será exibida como barra de progresso no dashboard.</p>

            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Valor (R$)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={metaMensal || ''}
                  onChange={(e) => setMetaMensal(parseFloat(e.target.value) || 0)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  placeholder="Ex: 30000"
                />
              </div>
              <button
                onClick={handleSalvarMeta}
                disabled={metaSaving}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {metaSaving ? 'Salvando...' : 'Salvar'}
              </button>
              {metaSaved && (
                <span className="text-sm text-emerald-600 font-medium">✓ Salvo</span>
              )}
            </div>
          </section>

          {/* ── Regime Tributário ── */}
          <section className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Regime Tributário</h2>
            <p className="text-sm text-gray-500 mb-6">Selecione seu regime tributário para cálculos de IR e estimativas de impostos.</p>

            <div className="space-y-3">
              {REGIME_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleSalvarRegime(opt.key)}
                  disabled={regimeSaving}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    regime === opt.key
                      ? 'border-orange-400 bg-orange-50 shadow-sm'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${regime === opt.key ? 'text-orange-700' : 'text-gray-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                    </div>
                    {regime === opt.key && (
                      <svg className="h-5 w-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
              {regimeSaved && (
                <p className="text-sm text-emerald-600 font-medium pt-1">✓ Regime salvo</p>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
