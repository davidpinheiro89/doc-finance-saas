'use client'

import { useState, useEffect } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'

const DISMISS_KEY = 'bem-feedback-dismissed-at'
const DAYS_BEFORE_SHOW = 7
const DISMISS_COOLDOWN_DAYS = 30

interface FeedbackModalProps {
  user: User
}

export default function FeedbackModal({ user }: FeedbackModalProps) {
  const [show, setShow] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    checkShouldShow()
  }, [user])

  async function checkShouldShow() {
    // 1. Check if account is 7+ days old
    const createdAt = new Date(user.created_at)
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreation < DAYS_BEFORE_SHOW) return

    // 2. Check localStorage dismiss cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismiss < DISMISS_COOLDOWN_DAYS) return
    }

    // 3. Check if user already submitted feedback
    const { data } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    if (data && data.length > 0) return

    setShow(true)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  const handleSubmit = async () => {
    if (rating === 0) return
    setSending(true)
    try {
      await supabase.from('user_feedback').insert({
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      })
      setSent(true)
      setTimeout(() => setShow(false), 2000)
    } catch {
      alert('Erro ao enviar feedback.')
    } finally {
      setSending(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm animate-in fade-in zoom-in-95">
        {sent ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Obrigado!</h3>
            <p className="text-sm text-gray-500">Seu feedback nos ajuda a melhorar.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-5">
              <div className="mx-auto w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center mb-3">
                <span className="text-xl">💬</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Como está sendo sua experiência?</h3>
              <p className="text-xs text-gray-500 mt-1">Sua opinião nos ajuda a construir um produto melhor.</p>
            </div>

            {/* Star Rating */}
            <div className="flex justify-center gap-1 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <svg
                    className={`h-8 w-8 transition-colors ${
                      star <= (hovered || rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 fill-gray-300'
                    }`}
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Rating Label */}
            {rating > 0 && (
              <p className="text-center text-xs text-gray-500 -mt-3 mb-4">
                {rating === 1 && 'Péssima'}
                {rating === 2 && 'Ruim'}
                {rating === 3 && 'Regular'}
                {rating === 4 && 'Boa'}
                {rating === 5 && 'Excelente!'}
              </p>
            )}

            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Quer compartilhar algo mais? (opcional)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none mb-4"
            />

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Agora não
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || sending}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
