'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'

interface Note {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  hasAttachments?: boolean
}

interface Attachment {
  name: string
  url: string
}

export default function NotasPage() {
  const { user, loading } = useAuthGuard()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [focusTitle, setFocusTitle] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRefMobile = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleInputMobileRef = useRef<HTMLInputElement>(null)

  // Clear debounce on unmount and when selectedNote changes
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [selectedNote?.id])

  // AutoFocus title on new note
  useEffect(() => {
    if (focusTitle) {
      titleInputRef.current?.focus()
      titleInputMobileRef.current?.focus()
      setFocusTitle(false)
    }
  }, [focusTitle])

  // Fetch notes with attachment count
  const fetchNotes = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (!error && data) {
      // Check attachments for each note (batch)
      const notesWithAttachments = await Promise.all(
        data.map(async (note) => {
          const { data: files } = await supabase.storage
            .from('notas-arquivos')
            .list(`${user.id}/${note.id}`, { limit: 1 })
          const hasAttachments = !!(files && files.filter(f => f.name !== '.emptyFolderPlaceholder').length > 0)
          return { ...note, hasAttachments }
        })
      )
      setNotes(notesWithAttachments)
    }
  }, [user])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  // Fetch attachments for selected note
  const fetchAttachments = useCallback(async (noteId: string) => {
    if (!user) return
    const { data, error } = await supabase.storage
      .from('notas-arquivos')
      .list(`${user.id}/${noteId}`)
    if (!error && data) {
      const files = data
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => ({
          name: f.name,
          url: supabase.storage.from('notas-arquivos').getPublicUrl(`${user.id}/${noteId}/${f.name}`).data.publicUrl,
        }))
      setAttachments(files)
    } else {
      setAttachments([])
    }
  }, [user])

  // Select note
  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setTitle(note.title)
    setContent(note.content)
    setLastSaved(null)
    fetchAttachments(note.id)
  }

  // Create new note
  const handleNewNote = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('notes')
      .insert([{ user_id: user.id, title: '', content: '' }])
      .select()
      .single()
    if (!error && data) {
      const newNote = { ...data, hasAttachments: false }
      setNotes(prev => [newNote, ...prev])
      handleSelectNote(newNote)
      setFocusTitle(true)
    }
  }

  // Autosave: optimistic update + only refetch list when title changes
  const saveNote = useCallback(async (noteId: string, newTitle: string, newContent: string, titleChanged: boolean) => {
    setSaving(true)
    const now = new Date().toISOString()
    // Optimistic update
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, title: newTitle, content: newContent, updated_at: now } : n
    ))
    const { error } = await supabase
      .from('notes')
      .update({ title: newTitle, content: newContent, updated_at: now })
      .eq('id', noteId)
    setSaving(false)
    if (!error) {
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      // Only refetch from server when title changes (affects sort order)
      if (titleChanged) fetchNotes()
    }
  }, [fetchNotes])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!selectedNote) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNote(selectedNote.id, val, content, true), 1000)
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    if (!selectedNote) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNote(selectedNote.id, title, val, false), 1000)
  }

  // Delete note (custom modal)
  const handleDeleteNote = async () => {
    if (!selectedNote || !user) return
    await supabase.from('notes').delete().eq('id', selectedNote.id).eq('user_id', user.id)
    const { data: files } = await supabase.storage.from('notas-arquivos').list(`${user.id}/${selectedNote.id}`)
    if (files && files.length > 0) {
      await supabase.storage.from('notas-arquivos').remove(files.map(f => `${user.id}/${selectedNote.id}/${f.name}`))
    }
    setNotes(prev => prev.filter(n => n.id !== selectedNote.id))
    setSelectedNote(null)
    setTitle('')
    setContent('')
    setAttachments([])
    setShowDeleteModal(false)
  }

  // Upload PDF
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !selectedNote || !e.target.files?.length) return
    const file = e.target.files[0]
    if (file.type !== 'application/pdf') { alert('Apenas arquivos PDF são permitidos.'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande (máx 10MB).'); return }

    setUploading(true)
    const sanitizedName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
    const path = `${user.id}/${selectedNote.id}/${sanitizedName}`
    const { error } = await supabase.storage.from('notas-arquivos').upload(path, file, { upsert: true })
    setUploading(false)
    if (error) { alert('Erro ao enviar arquivo: ' + error.message); return }
    fetchAttachments(selectedNote.id)
    // Mark note as having attachments
    setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, hasAttachments: true } : n))
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (fileInputRefMobile.current) fileInputRefMobile.current.value = ''
  }

  // Delete attachment
  const handleDeleteAttachment = async (name: string) => {
    if (!user || !selectedNote) return
    await supabase.storage.from('notas-arquivos').remove([`${user.id}/${selectedNote.id}/${name}`])
    fetchAttachments(selectedNote.id)
  }

  // Filter notes (memoized)
  const filteredNotes = useMemo(
    () => notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase())),
    [notes, search]
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Apagar nota</h2>
              <p className="text-sm text-gray-500 mt-1">Tem certeza que deseja apagar esta nota? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                aria-label="Cancelar exclusão"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteNote}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                aria-label="Confirmar exclusão da nota"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100" aria-label="Abrir menu">
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Minhas Notas</h1>
                <p className="text-xs text-gray-500">Anotações e documentos do plantão</p>
              </div>
            </div>
            <button
              onClick={handleNewNote}
              aria-label="Criar nova nota"
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-md shadow-orange-500/20 hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Nova Nota
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: notes list */}
          <div className="w-full md:w-80 flex-shrink-0 border-r border-gray-200/60 bg-white flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  placeholder="Buscar nota..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Buscar notas por título"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                />
              </div>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotes.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-400">Nenhuma nota encontrada</p>
                </div>
              ) : (
                filteredNotes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    aria-current={selectedNote?.id === note.id ? 'true' : undefined}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                      selectedNote?.id === note.id ? 'bg-orange-50 border-l-2 border-l-orange-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate flex-1">{note.title || 'Sem título'}</p>
                      {note.hasAttachments && (
                        <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {note.content ? note.content.slice(0, 60) + (note.content.length > 60 ? '...' : '') : 'Nota vazia'}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-1">
                      {new Date(note.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="hidden md:flex flex-1 flex-col overflow-hidden">
            {selectedNote ? (
              <>
                {/* Editor header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white/60">
                  <div className="flex items-center gap-3">
                    {saving && <span className="text-xs text-gray-400">Salvando...</span>}
                    {!saving && lastSaved && <span className="text-xs text-gray-400">Salvo às {lastSaved}</span>}
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    aria-label="Apagar nota"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Apagar
                  </button>
                </div>
                {/* Title */}
                <div className="px-6 pt-5">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Título da nota"
                    aria-label="Título da nota"
                    className="w-full text-2xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
                  />
                </div>
                {/* Content */}
                <div className="flex-1 px-6 py-4 overflow-y-auto">
                  <textarea
                    value={content}
                    onChange={e => handleContentChange(e.target.value)}
                    placeholder="Comece a escrever..."
                    aria-label="Conteúdo da nota"
                    className="w-full h-full min-h-[300px] text-sm text-gray-700 leading-relaxed bg-transparent border-none outline-none resize-none placeholder-gray-300"
                  />
                </div>
                {/* Attachments */}
                <div className="border-t border-gray-100 bg-white/60 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wide">Anexos (PDF)</h3>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer" aria-label="Anexar arquivo PDF">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      {uploading ? 'Enviando...' : 'Anexar PDF'}
                      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
                    </label>
                  </div>
                  {attachments.length === 0 ? (
                    <p className="text-xs text-gray-400">Nenhum anexo</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map(att => (
                        <div key={att.name} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>
                            <span className="text-xs text-gray-700 truncate">{att.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-500 hover:text-blue-600 transition-colors" aria-label={`Baixar ${att.name}`}>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                            <button onClick={() => handleDeleteAttachment(att.name)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" aria-label={`Remover ${att.name}`}>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-50 flex items-center justify-center">
                    <svg className="h-8 w-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <p className="text-sm text-gray-500">Selecione uma nota ou crie uma nova</p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile editor (shows when note selected) — slide-in animation */}
          {selectedNote && (
            <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col animate-[slideIn_0.2s_ease-out]">
              <style jsx>{`
                @keyframes slideIn {
                  from { transform: translateX(100%); }
                  to { transform: translateX(0); }
                }
              `}</style>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button onClick={() => setSelectedNote(null)} className="text-sm font-medium text-orange-600" aria-label="Voltar para lista de notas">← Voltar</button>
                <div className="flex items-center gap-2">
                  {saving && <span className="text-xs text-gray-400">Salvando...</span>}
                  {!saving && lastSaved && <span className="text-xs text-gray-400">Salvo às {lastSaved}</span>}
                  <button onClick={() => setShowDeleteModal(true)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Apagar nota">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <div className="px-4 pt-4">
                <input
                  ref={titleInputMobileRef}
                  type="text"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Título da nota"
                  aria-label="Título da nota"
                  className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
                />
              </div>
              <div className="flex-1 px-4 py-3 overflow-y-auto">
                <textarea
                  value={content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Comece a escrever..."
                  aria-label="Conteúdo da nota"
                  className="w-full h-full min-h-[200px] pb-32 text-sm text-gray-700 leading-relaxed bg-transparent border-none outline-none resize-none placeholder-gray-300"
                />
              </div>
              {/* Mobile attachments */}
              <div className="border-t border-gray-100 px-4 py-3 pb-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase text-gray-500">Anexos</h3>
                  <label className="text-xs font-medium text-orange-600 cursor-pointer" aria-label="Anexar arquivo PDF">
                    {uploading ? 'Enviando...' : '+ Anexar PDF'}
                    <input ref={fileInputRefMobile} type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
                  </label>
                </div>
                {attachments.map(att => (
                  <div key={att.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-1.5">
                    <span className="text-xs text-gray-700 truncate flex-1">{att.name}</span>
                    <div className="flex items-center gap-1">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500" aria-label={`Baixar ${att.name}`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </a>
                      <button onClick={() => handleDeleteAttachment(att.name)} className="p-1 text-red-400" aria-label={`Remover ${att.name}`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
