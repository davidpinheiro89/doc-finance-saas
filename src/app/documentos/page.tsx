'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { Documento, CategoriaDocumento } from '@/types/database'

// ── Document category config ──
const DOC_CATEGORIES: {
  key: CategoriaDocumento
  label: string
  icon: string
  description: string
}[] = [
  { key: 'crm', label: 'CRM', icon: '🏥', description: 'Registro no Conselho Regional de Medicina' },
  { key: 'diploma', label: 'Diploma', icon: '🎓', description: 'Diploma de graduação em Medicina' },
  { key: 'residencia', label: 'Residência Médica', icon: '📋', description: 'Certificado de residência médica' },
  { key: 'titulo_especialista', label: 'Título de Especialista', icon: '🏆', description: 'Título de especialista (AMB/SBE)' },
  { key: 'rg', label: 'RG', icon: '🪪', description: 'Documento de identidade' },
  { key: 'cpf', label: 'CPF', icon: '📄', description: 'Cadastro de Pessoa Física' },
  { key: 'pis', label: 'PIS/PASEP', icon: '📑', description: 'Programa de Integração Social' },
  { key: 'comprovante_endereco', label: 'Comprovante de Endereço', icon: '🏠', description: 'Comprovante de residência atualizado' },
  { key: 'certidao_negativa', label: 'Certidão Negativa', icon: '✅', description: 'Certidão negativa ético-profissional' },
  { key: 'alvara', label: 'Alvará / Licença', icon: '📜', description: 'Alvará de funcionamento ou licença' },
  { key: 'outro', label: 'Outro', icon: '📎', description: 'Outros documentos profissionais' },
]

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDateBR = (iso: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function DocumentosPage() {
  const { user, loading } = useAuthGuard()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<CategoriaDocumento>('crm')
  const [uploadName, setUploadName] = useState('')
  const [uploadValidade, setUploadValidade] = useState('')
  const [uploadNotas, setUploadNotas] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [shareMode, setShareMode] = useState(false)
  const [selectedForShare, setSelectedForShare] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) fetchDocumentos(user.id)
  }, [user])

  const fetchDocumentos = async (userId: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) { console.error('Erro ao buscar documentos:', error); setDocumentos([]); return }
      setDocumentos(data || [])
    } catch { setDocumentos([]) }
    finally { setIsLoading(false) }
  }

  const handleOpenUpload = (category: CategoriaDocumento) => {
    const cat = DOC_CATEGORIES.find(c => c.key === category)
    setUploadCategory(category)
    setUploadName(cat?.label || '')
    setUploadValidade('')
    setUploadNotas('')
    setSelectedFile(null)
    setShowUploadModal(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 10 MB')
      return
    }
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!user || !selectedFile) { alert('Selecione um arquivo.'); return }
    if (!uploadName.trim()) { alert('Informe o nome do documento.'); return }

    setUploading(true)
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop() || 'pdf'
      const filePath = `${user.id}/${Date.now()}_${uploadCategory}.${fileExt}`

      const { error: storageError } = await supabase.storage
        .from('documentos')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (storageError) {
        alert('Erro no upload: ' + storageError.message)
        return
      }

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath)

      // 3. Insert metadata row
      const { error: dbError } = await supabase.from('documentos').insert({
        user_id: user.id,
        nome: uploadName.trim(),
        categoria: uploadCategory,
        arquivo_url: urlData.publicUrl,
        arquivo_nome: selectedFile.name,
        arquivo_tipo: selectedFile.type,
        arquivo_tamanho: selectedFile.size,
        validade: uploadValidade || null,
        notas: uploadNotas.trim() || null,
      })

      if (dbError) {
        alert('Erro ao salvar documento: ' + dbError.message)
        return
      }

      setShowUploadModal(false)
      await fetchDocumentos(user.id)
    } catch {
      alert('Erro ao enviar documento. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: Documento) => {
    if (!user) return
    if (!confirm(`Excluir "${doc.nome}"? Esta ação não pode ser desfeita.`)) return

    setDeletingId(doc.id)
    try {
      // Delete from storage if URL exists
      if (doc.arquivo_url) {
        const path = doc.arquivo_url.split('/documentos/')[1]
        if (path) {
          await supabase.storage.from('documentos').remove([decodeURIComponent(path)])
        }
      }
      // Delete row
      await supabase.from('documentos').delete().eq('id', doc.id).eq('user_id', user.id)
      await fetchDocumentos(user.id)
    } catch {
      alert('Erro ao excluir documento.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleShareWhatsApp = () => {
    const selected = documentos.filter(d => selectedForShare.has(d.id))
    if (selected.length === 0) { alert('Selecione pelo menos um documento.'); return }

    const userName = user?.user_metadata?.full_name || 'Dr(a).'
    const crm = user?.user_metadata?.crm || ''

    let msg = `📋 *Documentos Profissionais*\n`
    msg += `👨‍⚕️ *${userName}*${crm ? ` — CRM ${crm}` : ''}\n`
    msg += `━━━━━━━━━━━━━━━━━━━\n\n`

    selected.forEach((doc, i) => {
      const cat = DOC_CATEGORIES.find(c => c.key === doc.categoria)
      msg += `${cat?.icon || '📎'} *${doc.nome}*\n`
      if (doc.validade) msg += `   📅 Validade: ${formatDateBR(doc.validade)}\n`
      if (doc.arquivo_url) msg += `   🔗 ${doc.arquivo_url}\n`
      if (i < selected.length - 1) msg += `\n`
    })

    msg += `\n━━━━━━━━━━━━━━━━━━━\n`
    msg += `✅ Enviado via *BEM Plantonista*`

    const encoded = encodeURIComponent(msg)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
    setShareMode(false)
    setSelectedForShare(new Set())
  }

  const toggleShareSelect = (id: string) => {
    setSelectedForShare(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group documents by category
  const docsByCategory = useMemo(() => {
    const map = new Map<string, Documento[]>()
    documentos.forEach(d => {
      const arr = map.get(d.categoria) || []
      arr.push(d)
      map.set(d.categoria, arr)
    })
    return map
  }, [documentos])

  // Check if a document has expired
  const isExpired = (validade: string | null) => {
    if (!validade) return false
    const today = new Date().toISOString().split('T')[0]
    return validade.split('T')[0] < today
  }

  const isExpiringSoon = (validade: string | null) => {
    if (!validade) return false
    const today = new Date()
    const exp = new Date(validade.split('T')[0] + 'T00:00:00')
    const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000)
    return diffDays >= 0 && diffDays <= 30
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
          <h1 className="text-lg font-bold text-gray-900">Meus Documentos</h1>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
          {/* ── Header Premium ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 md:p-8 text-white">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full bg-orange-500/10" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold">Carteira Digital</h1>
                  <p className="text-sm text-slate-300">Seus documentos profissionais em um cofre seguro</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Criptografia AES-256
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  {documentos.length} documento(s)
                </span>
              </div>
            </div>
          </div>

          {/* ── Actions bar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleOpenUpload('outro')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-sm shadow-orange-500/20 hover:shadow-md hover:shadow-orange-500/30 transition-all active:scale-[0.98]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Novo Documento
            </button>
            <button onClick={() => { setShareMode(!shareMode); setSelectedForShare(new Set()) }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all active:scale-[0.98] ${
                shareMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-white'
              }`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              {shareMode ? 'Cancelar' : 'Compartilhar'}
            </button>
            {shareMode && selectedForShare.size > 0 && (
              <button onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                Enviar via WhatsApp ({selectedForShare.size})
              </button>
            )}
          </div>

          {/* ── Documents Grid ── */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200/60 bg-white p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-200" />
                    <div className="flex-1">
                      <div className="h-4 w-24 rounded bg-gray-200 mb-1" />
                      <div className="h-3 w-40 rounded bg-gray-100" />
                    </div>
                  </div>
                  <div className="h-8 rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DOC_CATEGORIES.map(cat => {
                const docs = docsByCategory.get(cat.key) || []
                const hasDoc = docs.length > 0
                const latestDoc = docs[0]

                return (
                  <div key={cat.key} className={`group relative rounded-2xl border bg-white p-5 transition-all hover:shadow-md ${
                    hasDoc ? 'border-gray-200/60' : 'border-dashed border-gray-300/80'
                  }`}>
                    {/* Share checkbox */}
                    {shareMode && hasDoc && (
                      <button onClick={() => toggleShareSelect(latestDoc.id)}
                        className={`absolute top-3 right-3 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedForShare.has(latestDoc.id)
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-gray-300 hover:border-emerald-400'
                        }`}>
                        {selectedForShare.has(latestDoc.id) && (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                    )}

                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                        hasDoc ? 'bg-orange-50' : 'bg-gray-100'
                      }`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-semibold ${hasDoc ? 'text-gray-900' : 'text-gray-500'}`}>{cat.label}</h3>
                        <p className="text-[10px] text-gray-400 leading-tight">{cat.description}</p>
                      </div>
                    </div>

                    {hasDoc ? (
                      <div className="space-y-2">
                        {docs.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50/80 border border-gray-100">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{doc.arquivo_nome || doc.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {doc.arquivo_tamanho && (
                                  <span className="text-[10px] text-gray-400">{formatFileSize(doc.arquivo_tamanho)}</span>
                                )}
                                {doc.validade && (
                                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                                    isExpired(doc.validade) ? 'text-red-600' :
                                    isExpiringSoon(doc.validade) ? 'text-amber-600' : 'text-gray-400'
                                  }`}>
                                    {isExpired(doc.validade) ? '⚠️' : isExpiringSoon(doc.validade) ? '⏳' : '📅'}
                                    {isExpired(doc.validade) ? 'Expirado' : `Val. ${formatDateBR(doc.validade)}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {doc.arquivo_url && (
                                <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition-colors" title="Abrir">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              )}
                              <button onClick={() => handleDelete(doc)} disabled={deletingId === doc.id}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40" title="Excluir">
                                {deletingId === doc.id
                                  ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
                                  : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                }
                              </button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => handleOpenUpload(cat.key)}
                          className="w-full py-2 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50/60 rounded-lg transition-colors">
                          + Atualizar documento
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleOpenUpload(cat.key)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-gray-400 hover:text-orange-600 border border-dashed border-gray-200 hover:border-orange-300 rounded-xl transition-all hover:bg-orange-50/40 active:bg-orange-100/40">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        Enviar {cat.label}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Upload Modal — Drawer on mobile ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 md:px-4" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-md w-full p-6 pb-8 md:pb-6 border border-gray-200/60 animate-[slideUp_0.25s_ease-out]" onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="md:hidden flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Enviar Documento</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de Documento</label>
                <select value={uploadCategory} onChange={(e) => {
                  const val = e.target.value as CategoriaDocumento
                  setUploadCategory(val)
                  const cat = DOC_CATEGORIES.find(c => c.key === val)
                  if (cat) setUploadName(cat.label)
                }}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-white">
                  {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nome do Documento *</label>
                <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  placeholder="Ex: CRM - Dr. João" />
              </div>

              {/* Validade */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Data de Validade (opcional)</label>
                <input type="date" value={uploadValidade} onChange={(e) => setUploadValidade(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Observações (opcional)</label>
                <input type="text" value={uploadNotas} onChange={(e) => setUploadNotas(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  placeholder="Ex: Registro ativo até 2028" />
              </div>

              {/* File input */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Arquivo (PDF, imagem) *</label>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed rounded-xl text-sm transition-all ${
                    selectedFile
                      ? 'border-emerald-300 bg-emerald-50/50 text-emerald-700'
                      : 'border-gray-200 hover:border-orange-300 text-gray-500 hover:text-orange-600 hover:bg-orange-50/40'
                  }`}>
                  {selectedFile ? (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className="truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-gray-400">({formatFileSize(selectedFile.size)})</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      Selecionar arquivo
                    </>
                  )}
                </button>
                <p className="text-[10px] text-gray-400 mt-1">Máximo: 10 MB · PDF, JPG, PNG</p>
              </div>

              {/* Submit */}
              <button onClick={handleUpload} disabled={uploading || !selectedFile}
                className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-sm shadow-orange-500/20 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Salvar Documento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
