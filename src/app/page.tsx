'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'

export default function LandingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.user_metadata?.subscription_status === 'active') {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    )
  }

  const problems = [
    { icon: '📋', text: 'Anota plantões em caderninho ou planilha?' },
    { icon: '💸', text: 'Já perdeu pagamento por falta de controle?' },
    { icon: '📊', text: 'Não sabe quanto ganhou no mês passado?' },
    { icon: '🕐', text: 'Gasta horas organizando escala no WhatsApp?' },
  ]

  const modules = [
    {
      icon: '💰',
      title: 'Financeiro Completo',
      desc: 'Controle de plantões, faturamento, horas, status de pagamento e IR estimado. Tudo automático.',
    },
    {
      icon: '📱',
      title: 'Escala + WhatsApp',
      desc: 'Calendário visual de plantões com compartilhamento direto via WhatsApp para colegas.',
    },
    {
      icon: '📄',
      title: 'Carteira Digital',
      desc: 'Documentos médicos organizados em um só lugar: CRM, diplomas, certificados com validade.',
    },
  ]

  const faqs = [
    {
      q: 'Preciso instalar algum aplicativo?',
      a: 'Não. O BEM Plantonista funciona 100% no navegador do celular ou computador. Basta acessar e logar.',
    },
    {
      q: 'Meus dados financeiros estão seguros?',
      a: 'Sim. Usamos Supabase com criptografia e Row Level Security. Apenas você acessa seus dados.',
    },
    {
      q: 'Posso cancelar a qualquer momento?',
      a: 'Sim. Sem fidelidade, sem multa. Cancele quando quiser pelo painel ou por e-mail.',
    },
    {
      q: 'O sistema calcula meu Imposto de Renda?',
      a: 'Sim. Estimamos o IR mensal (carnê-leão) com a tabela progressiva atualizada da Receita Federal.',
    },
    {
      q: 'Funciona para qualquer especialidade médica?',
      a: 'Sim. Qualquer médico plantonista — urgência, UTI, anestesio, clínica, cirurgia — pode usar.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-gray-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-orange-500">BEM</span>
            <span className="text-slate-700"> plantonista</span>
          </h1>
          <a
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
          >
            Já tenho conta →
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-white" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Gerencie seus plantões{' '}
            <span className="text-orange-500">com inteligência</span>
          </h2>
          <p className="mt-5 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Financeiro, escalas e documentos médicos em uma plataforma feita por quem entende a rotina do plantonista.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/register"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all text-base"
            >
              Começar agora por R$29,90/mês
            </a>
            <a
              href="#modulos"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-gray-300 hover:border-gray-400 text-gray-700 font-medium transition-colors text-base"
            >
              Conhecer recursos
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">7 dias de garantia · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Problema ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h3 className="text-2xl sm:text-3xl font-bold text-center mb-3">Se identificou?</h3>
        <p className="text-center text-gray-500 mb-10 max-w-xl mx-auto">
          A maioria dos plantonistas vive essa realidade. Nós criamos a solução.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {problems.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">{p.icon}</span>
              <p className="text-base font-medium text-gray-800">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Módulos ── */}
      <section id="modulos" className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-3">
            Tudo que o plantonista precisa
          </h3>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            Três módulos integrados para simplificar sua vida profissional.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modules.map((m, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 hover:shadow-lg transition-shadow"
              >
                <span className="text-3xl">{m.icon}</span>
                <h4 className="text-lg font-bold mt-4 mb-2">{m.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preços ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h3 className="text-2xl sm:text-3xl font-bold text-center mb-3">Plano único, acesso total</h3>
        <p className="text-center text-gray-500 mb-10 max-w-lg mx-auto">
          Sem planos confusos. Um preço justo com tudo incluso.
        </p>
        <div className="max-w-sm mx-auto bg-white rounded-2xl border-2 border-orange-500 shadow-xl shadow-orange-500/10 overflow-hidden">
          <div className="bg-orange-500 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
            Preço de lançamento
          </div>
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 line-through">R$49,90/mês</p>
            <p className="text-4xl font-extrabold mt-1">
              R$29<span className="text-2xl">,90</span>
              <span className="text-base font-normal text-gray-500">/mês</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-left text-gray-700">
              {[
                'Painel financeiro completo',
                'Calendário de escalas',
                'Compartilhamento via WhatsApp',
                'Carteira de documentos',
                'Estimativa de IR (carnê-leão)',
                'Relatórios e exportação PDF',
                'Suporte por e-mail',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="/register"
              className="mt-8 block w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors shadow-lg shadow-orange-500/25"
            >
              Criar minha conta
            </a>
          </div>
        </div>
      </section>

      {/* ── Garantia ── */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
          <span className="text-4xl">🛡️</span>
          <h3 className="text-xl font-bold mt-4 mb-2">Garantia de 7 dias</h3>
          <p className="text-gray-600 max-w-lg mx-auto">
            Teste sem compromisso. Se não gostar, devolvemos 100% do valor.
            Sem burocracia, sem perguntas.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h3 className="text-2xl sm:text-3xl font-bold text-center mb-10">Perguntas frequentes</h3>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-gray-800">{faq.q}</span>
                <svg
                  className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {faqOpen === i && (
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-lg font-bold">
              <span className="text-orange-400">BEM</span>
              <span className="text-gray-300"> plantonista</span>
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <a href="/termos" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</a>
              <a href="mailto:suporte@bemplantonista.com.br" className="hover:text-white transition-colors">
                suporte@bemplantonista.com.br
              </a>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mt-6">
            © {new Date().getFullYear()} BEM Plantonista. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
