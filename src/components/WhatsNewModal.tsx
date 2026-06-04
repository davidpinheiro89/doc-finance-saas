'use client'

import { useState, useEffect } from 'react'

const UPDATES = [
  {
    id: 'escala-remove-folga',
    date: '04 Jun 2025',
    title: 'Escala inteligente',
    description: 'Ao cadastrar um plantão em dia com folga ou disponível, o sistema remove automaticamente o registro anterior.',
    tag: 'Melhoria',
    tagColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'trial-progress',
    date: '04 Jun 2025',
    title: 'Acompanhe seu trial',
    description: 'A página Minha Assinatura agora mostra quantos dias restam do seu período gratuito com uma barra de progresso.',
    tag: 'Novo',
    tagColor: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'logo-novo',
    date: '04 Jun 2025',
    title: 'Nova identidade visual',
    description: 'O logo do BEM Plantonista foi atualizado para refletir a identidade visual oficial da marca.',
    tag: 'Visual',
    tagColor: 'bg-purple-100 text-purple-700',
  },
]

const STORAGE_KEY = 'bem_seen_updates'

interface WhatsNewModalProps {
  onClose: () => void
}

export default function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  useEffect(() => {
    const seen = UPDATES.map(u => u.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
  }, [])

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">🚀 O que há de novo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Últimas atualizações do BEM Plantonista</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>
        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {UPDATES.map((update) => (
            <div key={update.id} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${update.tagColor}`}>{update.tag}</span>
                <span className="text-xs text-gray-400">{update.date}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{update.title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{update.description}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl transition-all hover:shadow-md active:scale-[0.98]">Entendido!</button>
        </div>
      </div>
    </div>
  )
}

export function useWhatsNew() {
  const [hasNew, setHasNew] = useState(false)
  useEffect(() => {
    const seen: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const unseen = UPDATES.filter(u => !seen.includes(u.id))
    setHasNew(unseen.length > 0)
  }, [])
  return hasNew
}
