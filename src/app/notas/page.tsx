'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
}

interface Attachment {
  name: string
  url: string
}

export default function NotasPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
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

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (!error && data) setNotes(data)
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
      .insert([{ user_id: user.id, title: 'Nova nota', content: '' }])
      .select()
      .single()
    if (!error && data) {
      await fetchNotes()
      handleSelectNote(data)
    }
  }

  // Autosave with debounce
  const saveNote = useCallback(async (noteId: string, newTitle: string, newContent: string) => {
    setSaving(true)
    const { error } = await supabase
      .from('notes')
      .update({ title: newTitle, content: newContent, updated_at: new Date().toISOString() })
      .eq('id', noteId)
    setSaving(false)
    if (!error) {
      setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      fetchNotes()
    }
  }, [fetchNotes])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!selectedNote) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNote(selectedNote.id, val, content), 1000)
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    if (!selectedNote) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNote(selectedNote.id, title, val), 1000)
  }

  // Delete note
  const handleDeleteNote = async () => {
    if (!selectedNote || !user) return
    if (!confirm('Tem certeza que deseja apagar esta nota?')) return
    await supabase.from('notes').delete().eq('id', selectedNote.id).eq('user_id', user.id)
    // Remove attachments folder
    const { data: files } = await supabase.storage.from('notas-arquivos').list(`${user.id}/${selectedNote.id}`)
    if (files && files.length > 0) {
      await supabase.storage.from('notas-arquivos').remove(files.map(f => `${user.id}/${selectedNote.id}/${f.name}`))
    }
    setSelectedNote(null)
    setTitle('')
    setContent('')
    setAttachments([])
    fetchNotes()
  }

  // Upload PDF
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !selectedNote || !e.target.files?.length) return
    const file = e.target.files[0]
    if (file.type !== 'application/pdf') { alert('Apenas arquivos PDF são permitidos.'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande (máx 10MB).'); return }

    setUploading(true)
    const path = `${user.id}/${selectedNote.id}/${file.name}`
    const { error } = await supabase.storage.from('notas-arquivos').upload(path, file, { upsert: true })
    setUploading(false)
    if (error) { alert('Erro ao enviar arquivo: ' + error.message); return }
    fetchAttachments(selectedNote.id)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Delete attachment
  const handleDeleteAttachment = async (name: string) => {
    if (!user || !selectedNote) return
    await supabase.storage.from('notas-arquivos').remove([`${user.id}/${selectedNote.id}/${name}`])
    fetchAttachments(selectedNote.id)
  }

  // Filter notes
  const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100 w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100">
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
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                      selectedNote?.id === note.id ? 'bg-orange-50 border-l-2 border-l-orange-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">{note.title || 'Sem título'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
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
                    onClick={handleDeleteNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Apagar
                  </button>
                </div>
                {/* Title */}
                <div className="px-6 pt-5">
                  <input
                    type="text"
                    value={title}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Título da nota"
                    className="w-full text-2xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
                  />
                </div>
                {/* Content */}
                <div className="flex-1 px-6 py-4 overflow-y-auto">
                  <textarea
                    value={content}
                    onChange={e => handleContentChange(e.target.value)}
                    placeholder="Comece a escrever..."
                    className="w-full h-full min-h-[300px] text-sm text-gray-700 leading-relaxed bg-transparent border-none outline-none resize-none placeholder-gray-300"
                  />
                </div>
                {/* Attachments */}
                <div className="border-t border-gray-100 bg-white/60 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wide">Anexos (PDF)</h3>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer">
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
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-500 hover:text-blue-600 transition-colors">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                            <button onClick={() => handleDeleteAttachment(att.name)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
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

          {/* Mobile editor (shows when note selected) */}
          {selectedNote && (
            <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button onClick={() => setSelectedNote(null)} className="text-sm font-medium text-orange-600">← Voltar</button>
                <div className="flex items-center gap-2">
                  {saving && <span className="text-xs text-gray-400">Salvando...</span>}
                  {!saving && lastSaved && <span className="text-xs text-gray-400">Salvo às {lastSaved}</span>}
                  <button onClick={handleDeleteNote} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <div className="px-4 pt-4">
                <input
                  type="text"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Título da nota"
                  className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300"
                />
              </div>
              <div className="flex-1 px-4 py-3 overflow-y-auto">
                <textarea
                  value={content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Comece a escrever..."
                  className="w-full h-full min-h-[200px] text-sm text-gray-700 leading-relaxed bg-transparent border-none outline-none resize-none placeholder-gray-300"
                />
              </div>
              {/* Mobile attachments */}
              <div className="border-t border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase text-gray-500">Anexos</h3>
                  <label className="text-xs font-medium text-orange-600 cursor-pointer">
                    {uploading ? 'Enviando...' : '+ Anexar PDF'}
                    <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
                  </label>
                </div>
                {attachments.map(att => (
                  <div key={att.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-1.5">
                    <span className="text-xs text-gray-700 truncate flex-1">{att.name}</span>
                    <div className="flex items-center gap-1">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </a>
                      <button onClick={() => handleDeleteAttachment(att.name)} className="p-1 text-red-400">
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
