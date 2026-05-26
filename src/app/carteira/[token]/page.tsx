'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'

// Client anon para acesso público (sem auth)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PublicDoc {
  id: string
  nome: string
  categoria: string
  arquivo_url: string | null
  validade: string | null
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  crm: { label: 'CRM', icon: '🏥' },
  diploma: { label: 'Diploma', icon: '🎓' },
  residencia: { label: 'Residência Médica', icon: '📋' },
  titulo_especialista: { label: 'Título de Especialista', icon: '🏆' },
  rg: { label: 'RG', icon: '🪪' },
  cpf: { label: 'CPF', icon: '📄' },
  pis: { label: 'PIS/PASEP', icon: '📑' },
  comprovante_endereco: { label: 'Comprovante de Endereço', icon: '🏠' },
  certidao_negativa: { label: 'Certidão Negativa', icon: '✅' },
  alvara: { label: 'Alvará / Licença', icon: '📜' },
  contrato_pj: { label: 'Contratos PJ com Hospitais', icon: '🏥' },
  outro: { label: 'Outro', icon: '📎' },
}

const formatDateBR = (iso: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function CarteiraPublicaPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [doctorName, setDoctorName] = useState('')
  const [crm, setCrm] = useState('')
  const [documentos, setDocumentos] = useState<PublicDoc[]>([])

  useEffect(() => {
    if (token) fetchCarteira()
  }, [token])

  const fetchCarteira = async () => {
    setLoading(true)
    try {
      // Chamar RPC que valida token + expiração e retorna documentos (SECURITY DEFINER, bypassa RLS)
      const { data: docs, error } = await supabase
        .rpc('get_carteira_publica', { p_token: token })

      if (error) {
        // Se o token não é UUID válido, o Postgres retorna erro
        setNotFound(true)
        return
      }

      if (!docs || docs.length === 0) {
        // Pode ser token inválido, expirado, ou sem documentos.
        // Verificar se o link existe para dar mensagem correta.
        const { data: link } = await supabase
          .from('carteira_publica')
          .select('expires_at')
          .eq('token', token)
          .single()

        if (!link) { setNotFound(true); return }
        if (new Date(link.expires_at) < new Date()) { setExpired(true); return }

        // Link válido, mas o médico não tem documentos
        setDocumentos([])
        return
      }

      setDocumentos(docs)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-gray-500">Carregando carteira...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Link não encontrado</h1>
        <p className="text-sm text-gray-500">Este link de carteira digital não existe ou foi removido.</p>
      </div>
    </div>
  )

  if (expired) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⏰</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Link expirado</h1>
        <p className="text-sm text-gray-500">Este link de carteira digital expirou. Solicite um novo link ao profissional.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Carteira Digital</h1>
            <p className="text-xs text-gray-500">Documentos profissionais verificados</p>
          </div>
        </div>
      </header>

      {/* Documents */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
            <p className="text-sm font-semibold text-gray-700">{documentos.length} documento(s) disponível(is)</p>
          </div>

          <div className="divide-y divide-gray-100">
            {documentos.map(doc => {
              const cat = CATEGORY_LABELS[doc.categoria] || CATEGORY_LABELS.outro
              return (
                <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg flex-shrink-0">
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{cat.label}</span>
                      {doc.validade && (
                        <span className="text-[10px] text-gray-400">· Val. {formatDateBR(doc.validade)}</span>
                      )}
                    </div>
                  </div>
                  {doc.arquivo_url && (
                    <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                      Abrir
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-6">
          Compartilhado via <span className="font-medium text-orange-500">BEM Plantonista</span>
        </p>
      </main>
    </div>
  )
}
