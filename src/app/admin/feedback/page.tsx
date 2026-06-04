'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import Sidebar from '@/components/Sidebar'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

interface FeedbackItem {
  id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  email: string
}

export default function AdminFeedbackPage() {
  const { user, loading } = useAuthGuard()
  const router = useRouter()
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedComment, setSelectedComment] = useState<FeedbackItem | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace('/dashboard')
      return
    }
    fetchFeedbacks()
  }, [user, loading])

  async function fetchFeedbacks() {
    setFetching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/feedback', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Forbidden')
      const json = await res.json()
      setFeedbacks(json.feedbacks || [])
    } catch {
      setFeedbacks([])
    } finally {
      setFetching(false)
    }
  }

  const filtered = useMemo(() => {
    if (!ratingFilter) return feedbacks
    return feedbacks.filter(f => f.rating === ratingFilter)
  }, [feedbacks, ratingFilter])

  const avgRating = useMemo(() => {
    if (feedbacks.length === 0) return 0
    return feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
  }, [feedbacks])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} className={`h-4 w-4 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'}`} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <Sidebar user={user} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-white/80">
            <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Admin Feedback</h1>
          <div className="w-10" />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Painel de Feedbacks</h1>
          <p className="text-sm text-gray-500 mt-1">Visualize todas as avaliações dos usuários</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total de Feedbacks</p>
            <p className="text-3xl font-bold text-gray-900">{feedbacks.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Média Geral</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
              {renderStars(Math.round(avgRating))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Distribuição</p>
            <div className="flex items-end gap-1 h-10">
              {[1, 2, 3, 4, 5].map(r => {
                const count = feedbacks.filter(f => f.rating === r).length
                const pct = feedbacks.length > 0 ? (count / feedbacks.length) * 100 : 0
                return (
                  <div key={r} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full bg-amber-100 rounded-sm overflow-hidden" style={{ height: `${Math.max(pct, 4)}%`, minHeight: '4px' }}>
                      <div className="h-full bg-amber-400 rounded-sm" style={{ height: '100%' }} />
                    </div>
                    <span className="text-[9px] text-gray-500">{r}★</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600 font-medium">Filtrar:</span>
          <button
            onClick={() => setRatingFilter(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!ratingFilter ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Todos
          </button>
          {[5, 4, 3, 2, 1].map(r => (
            <button
              key={r}
              onClick={() => setRatingFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${ratingFilter === r ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {r}★
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {fetching ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-5">
                <svg className="h-8 w-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Nenhum feedback encontrado</h3>
              <p className="text-sm text-gray-500">Os feedbacks dos usuários aparecerão aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comentário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{renderStars(f.rating)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                        {f.comment ? (
                          <button onClick={() => setSelectedComment(f)} className="text-left truncate block max-w-xs hover:text-orange-600 transition-colors cursor-pointer">{f.comment}</button>
                        ) : (
                          <span className="text-gray-400 italic">Sem comentário</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{f.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Comment Detail Modal */}
      {selectedComment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedComment(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {renderStars(selectedComment.rating)}
                <span className="text-xs text-gray-500">{formatDate(selectedComment.created_at)}</span>
              </div>
              <button onClick={() => setSelectedComment(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-2">{selectedComment.email}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selectedComment.comment || 'Sem comentário'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
