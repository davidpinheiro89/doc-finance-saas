'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { Documento, CategoriaDocumento } from '@/types/database'

const DOC_CATEGORIES: Record<string, { label: string; icon: string }> = {
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
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const isImageUrl = (url: string | null) => {
  if (!url) return false
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i.test(url)
}

const fixFileName = (name: string | null) => {
  if (!name) return 'Documento'
  return name.replace(/(\.pdf){2,}$/i, '.pdf')
}

export default function CarteiraImprimirPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (user) fetchDocs(user.id)
  }, [user])

  const fetchDocs = async (userId: string) => {
    setFetching(true)
    try {
      const { data } = await supabase
        .from('documentos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setDocumentos(data || [])
    } catch { setDocumentos([]) }
    finally { setFetching(false) }
  }

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Médico(a)'
  const crm = user?.user_metadata?.crm || ''
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-gray-500">Preparando impressão...</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 15mm 12mm;
            size: A4;
          }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-before: always;
          }
          .doc-card {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* ── Print Action Bar (hidden in print) ── */}
        <div className="no-print sticky top-0 z-50 bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Carteira Digital — Pré-visualização de Impressão</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/documentos')}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / Salvar como PDF
            </button>
          </div>
        </div>

        {/* ── Document Content (prints this) ── */}
        <div className="max-w-[210mm] mx-auto px-8 py-10">
          {/* Header */}
          <header className="flex items-start justify-between mb-8 pb-6 border-b-2 border-orange-500">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Carteira Digital</h1>
              <p className="text-sm text-gray-500 mt-0.5">Documentos Profissionais</p>
              <div className="mt-4">
                <p className="text-lg font-semibold text-[#0F172A]">{userName}</p>
                {crm && <p className="text-sm text-gray-600">CRM: {crm}</p>}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-orange-500">BEM Plantonista</span>
              </div>
              <p className="text-xs text-gray-400">Gerado em {today}</p>
              <p className="text-xs text-gray-400">{documentos.length} documento(s)</p>
            </div>
          </header>

          {/* Document List */}
          {documentos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">Nenhum documento cadastrado</p>
            </div>
          ) : (
            <div className="space-y-6">
              {documentos.map((doc, idx) => {
                const cat = DOC_CATEGORIES[doc.categoria] || DOC_CATEGORIES.outro
                const isImage = isImageUrl(doc.arquivo_url)

                return (
                  <div key={doc.id} className="doc-card border border-gray-200 rounded-xl overflow-hidden">
                    {/* Doc Header */}
                    <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <span className="text-lg">{cat.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-[#0F172A]">{doc.nome}</h3>
                        <p className="text-xs text-gray-500">{cat.label}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {doc.validade && (
                          <p>Validade: <span className="font-medium">{formatDateBR(doc.validade)}</span></p>
                        )}
                      </div>
                    </div>

                    {/* Doc Content */}
                    {doc.arquivo_url && (
                      <div className="p-4">
                        {isImage ? (
                          <div className="flex justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.arquivo_url}
                              alt={doc.nome}
                              className="max-w-full max-h-[500px] rounded-lg border border-gray-100 object-contain"
                            />
                          </div>
                        ) : (
                          <a href={doc.arquivo_url!} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-4 px-5 py-4 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100/60 transition-colors">
                            <svg className="h-8 w-8 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#0F172A] truncate">{fixFileName(doc.arquivo_nome)}</p>
                              <p className="text-xs text-orange-600 mt-0.5">Clique para abrir o documento</p>
                            </div>
                            <svg className="h-4 w-4 text-orange-400 flex-shrink-0 no-print" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {doc.notas && (
                      <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-500"><span className="font-medium">Obs:</span> {doc.notas}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <footer className="mt-10 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              Documento gerado automaticamente pelo <span className="font-semibold text-orange-500">BEM Plantonista</span>
            </p>
            <p className="text-[10px] text-gray-300 mt-1">
              Este documento é uma compilação digital dos registros profissionais do médico.
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}
