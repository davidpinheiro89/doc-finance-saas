'use client'

import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function AssinaturaPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
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

          <h2 className="text-xl font-bold text-gray-900 mb-2">Assinatura necessária</h2>
          <p className="text-sm text-gray-500 mb-6">
            Para acessar o painel, ative sua assinatura do BEM Plantonista.
          </p>

          {/* Pricing options */}
          <div className="space-y-3 mb-6">
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
            </div>
          </div>

          <a
            href="https://wa.me/5511985904388?text=Ol%C3%A1%2C%20gostaria%20de%20ativar%20minha%20assinatura%20do%20BEM%20Plantonista."
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors shadow-lg shadow-orange-500/25 mb-3"
          >
            Ativar assinatura via WhatsApp
          </a>

          <a
            href="mailto:suporte@bemplantonista.com.br?subject=Ativar%20assinatura"
            className="block w-full py-3 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-700 font-medium transition-colors text-sm"
          >
            Ativar por e-mail
          </a>

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
