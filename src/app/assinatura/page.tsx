'use client'

import { useState } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function AssinaturaPage() {
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null)
  const [error, setError] = useState('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    const cleanCpf = cpf.replace(/\D/g, '')
    if (cleanCpf.length < 11) {
      setError('Informe um CPF válido para prosseguir.')
      return
    }
    setError('')
    setLoadingPlan(plan)
    try {
      const { data: { session: sess } } = await supabase.auth.getSession()
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sess?.access_token ? { Authorization: `Bearer ${sess.access_token}` } : {}),
        },
        body: JSON.stringify({ cpfCnpj: cleanCpf, plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao iniciar checkout.')
        return
      }
      if (data.invoiceUrl) {
        window.location.href = data.invoiceUrl
      } else {
        setError('Checkout criado mas link de pagamento não disponível. Entre em contato pelo WhatsApp.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            <span className="text-orange-500">BEM</span>
            <span className="text-slate-700"> plantonista</span>
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mb-5">
            <svg className="h-7 w-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Ative sua assinatura</h2>
          <p className="text-sm text-gray-500 mb-6">
            Escolha seu plano e comece a usar o BEM Plantonista agora.
          </p>

          {/* CPF Input */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 text-left">CPF (necessário para o pagamento)</label>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 text-center tracking-wider"
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* Pricing options */}
          <div className="space-y-3 mb-5">
            {/* Plano Mensal */}
            <div className="bg-orange-50 border border-orange-200/60 rounded-xl p-5 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Mensal</span>
                <span className="text-[10px] text-gray-400">Primeiros 3 meses</span>
              </div>
              <p className="text-3xl font-extrabold text-gray-900">
                R$29<span className="text-xl">,90</span>
                <span className="text-sm font-normal text-gray-500">/mês</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Após 3 meses: R$49,90/mês</p>
              <p className="text-[10px] text-orange-600 font-medium mt-1">Garantia de 7 dias · Cancele quando quiser</p>
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={loadingPlan !== null}
                className="mt-3 w-full py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loadingPlan === 'monthly' ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Processando...</>
                ) : (
                  'Assinar por R$29,90/mês'
                )}
              </button>
            </div>

            {/* Plano Anual */}
            <div className="relative bg-emerald-50 border-2 border-emerald-400 rounded-xl p-5 text-left">
              <span className="absolute -top-2.5 right-4 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">Melhor valor</span>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Anual</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Economia de ~50%</span>
              </div>
              <p className="text-3xl font-extrabold text-gray-900">
                R$299<span className="text-xl">,00</span>
                <span className="text-sm font-normal text-gray-500">/ano</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Equivale a R$24,92/mês</p>
              <button
                onClick={() => handleCheckout('annual')}
                disabled={loadingPlan !== null}
                className="mt-3 w-full py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loadingPlan === 'annual' ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Processando...</>
                ) : (
                  'Assinar por R$299,00/ano'
                )}
              </button>
            </div>
          </div>

          {/* Secondary option */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <p className="text-xs text-gray-400 mb-2">Prefere ativar de outra forma?</p>
            <a
              href="https://wa.me/5511985904388?text=Ol%C3%A1%2C%20gostaria%20de%20ativar%20minha%20assinatura%20do%20BEM%20Plantonista."
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
            >
              Ativar via WhatsApp
            </a>
          </div>

          <button
            onClick={handleLogout}
            className="mt-5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
