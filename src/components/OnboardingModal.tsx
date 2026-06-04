'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface OnboardingModalProps {
  step: number
  setStep: (s: number) => void
  completeOnboarding: () => Promise<void>
  skipOnboarding: () => Promise<void>
}

export default function OnboardingModal({
  step,
  setStep,
  completeOnboarding,
  skipOnboarding,
}: OnboardingModalProps) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleComplete = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
    } finally {
      setSaving(false)
    }
  }

  const handleGoToEscala = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
      router.push('/escala')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={skipOnboarding}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
          title="Fechar"
        >
          ✕
        </button>

        {/* Progress indicator */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-orange-500'
                    : s < step
                    ? 'w-8 bg-orange-300'
                    : 'w-8 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-1.5">
            Passo {step} de 3
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-2">
          {step === 1 && <Step1 onNext={() => setStep(2)} />}
          {step === 2 && (
            <Step2
              onGoToEscala={handleGoToEscala}
              onSkip={() => setStep(3)}
              saving={saving}
            />
          )}
          {step === 3 && (
            <Step3 onComplete={handleComplete} saving={saving} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Step 1: Bem-vindo ── */
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4 mt-2">
        <span className="text-4xl">🩺</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        Bem-vindo ao <span className="text-orange-500">BEM</span> Plantonista!
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        O app feito para médicos que fazem plantões
      </p>
      <p className="text-sm text-gray-600 mt-4 leading-relaxed">
        Gerencie seus plantões, controle finanças, acompanhe despesas e
        tenha uma visão completa do seu desempenho profissional — tudo em
        um só lugar.
      </p>
      <button
        onClick={onNext}
        className="mt-6 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
      >
        Começar →
      </button>
    </div>
  )
}

/* ── Step 2: Cadastre seu primeiro plantão ── */
function Step2({
  onGoToEscala,
  onSkip,
  saving,
}: {
  onGoToEscala: () => void
  onSkip: () => void
  saving: boolean
}) {
  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 mt-2">
        <span className="text-3xl">📅</span>
      </div>
      <h2 className="text-lg font-bold text-gray-900">
        Cadastre seu primeiro plantão
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Leva menos de 1 minuto e você já começa a ver seus dados
      </p>
      <p className="text-sm text-gray-600 mt-4 leading-relaxed">
        Na tela de Escala, toque em qualquer dia do calendário para
        adicionar um plantão com hospital, data e valor.
      </p>
      <button
        onClick={onGoToEscala}
        disabled={saving}
        className="mt-6 w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
      >
        {saving ? 'Abrindo...' : 'Cadastrar agora →'}
      </button>
      <button
        onClick={onSkip}
        className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Fazer depois
      </button>
    </div>
  )
}

/* ── Step 3: Primeiros passos ── */
function Step3({
  onComplete,
  saving,
}: {
  onComplete: () => void
  saving: boolean
}) {
  const checklist = [
    {
      icon: '📋',
      title: 'Cadastre seu primeiro plantão',
      desc: 'Na tela Escala, adicione um plantão com hospital, data e valor.',
    },
    {
      icon: '🎯',
      title: 'Configure suas metas financeiras',
      desc: 'No Dashboard, defina sua meta mensal de faturamento.',
    },
    {
      icon: '🏥',
      title: 'Adicione seus hospitais e clínicas',
      desc: 'Ao criar plantões, salve locais como favoritos para agilizar.',
    },
  ]

  return (
    <div>
      <div className="text-center mb-5 mt-1">
        <div className="mx-auto w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">🚀</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Primeiros passos</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Sugestões para começar a usar o app
        </p>
      </div>

      <div className="space-y-3">
        {checklist.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl"
          >
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-lg">{item.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {item.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        disabled={saving}
        className="mt-6 w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
      >
        {saving ? 'Finalizando...' : 'Ir para o Dashboard →'}
      </button>
    </div>
  )
}
