'use client'

import { useState } from 'react'
import type { OnboardingProfile } from '@/hooks/useOnboarding'

interface OnboardingModalProps {
  step: number
  setStep: (s: number) => void
  saveProfile: (profile: OnboardingProfile) => Promise<void>
  completeOnboarding: () => Promise<void>
  skipOnboarding: () => Promise<void>
}

const ESPECIALIDADES = [
  'Clínica Médica',
  'Emergência',
  'UTI',
  'Cardiologia',
  'Pediatria',
  'Cirurgia Geral',
  'Anestesiologia',
  'Ortopedia',
  'Ginecologia',
  'Outro',
]

const PLANTOES_OPTIONS = [
  { value: '1-4', label: '1 a 4 plantões' },
  { value: '5-8', label: '5 a 8 plantões' },
  { value: '9-12', label: '9 a 12 plantões' },
  { value: '13+', label: '13 ou mais' },
]

export default function OnboardingModal({
  step,
  setStep,
  saveProfile,
  completeOnboarding,
  skipOnboarding,
}: OnboardingModalProps) {
  const [profile, setProfile] = useState<OnboardingProfile>({
    especialidade: '',
    valor_medio_plantao: '',
    plantoes_por_mes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await saveProfile(profile)
      setStep(3)
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      await completeOnboarding()
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
              profile={profile}
              setProfile={setProfile}
              onSave={handleSaveProfile}
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

/* ── Step 2: Configure seu perfil ── */
function Step2({
  profile,
  setProfile,
  onSave,
  onSkip,
  saving,
}: {
  profile: OnboardingProfile
  setProfile: (p: OnboardingProfile) => void
  onSave: () => void
  onSkip: () => void
  saving: boolean
}) {
  return (
    <div>
      <div className="text-center mb-5 mt-1">
        <div className="mx-auto w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">⚙️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900">
          Configure seu perfil
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Opcional — você pode preencher depois
        </p>
      </div>

      <div className="space-y-4">
        {/* Especialidade */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Especialidade
          </label>
          <select
            value={profile.especialidade}
            onChange={(e) =>
              setProfile({ ...profile, especialidade: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          >
            <option value="">Selecione...</option>
            {ESPECIALIDADES.map((esp) => (
              <option key={esp} value={esp}>
                {esp}
              </option>
            ))}
          </select>
        </div>

        {/* Valor médio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor médio por plantão (R$)
          </label>
          <input
            type="number"
            placeholder="Ex: 1200"
            value={profile.valor_medio_plantao}
            onChange={(e) =>
              setProfile({ ...profile, valor_medio_plantao: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          />
        </div>

        {/* Plantões por mês */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantos plantões faz por mês?
          </label>
          <select
            value={profile.plantoes_por_mes}
            onChange={(e) =>
              setProfile({ ...profile, plantoes_por_mes: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          >
            <option value="">Selecione...</option>
            {PLANTOES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
        >
          Pular
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {saving ? 'Salvando...' : 'Salvar e Continuar'}
        </button>
      </div>
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
