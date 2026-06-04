'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import FeedbackModal from './FeedbackModal'
import WhatsNewModal, { useWhatsNew } from './WhatsNewModal'

const ADMIN_EMAIL = 'davidpinheiro89@gmail.com'

interface SidebarProps {
  user?: any
  /** Mobile drawer: controla se está aberto */
  mobileOpen?: boolean
  /** Mobile drawer: callback para fechar */
  onMobileClose?: () => void
}

export default function Sidebar({ user, mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleNavigate = (href: string) => {
    router.push(href)
    onMobileClose?.()
  }

  const subStatus = user?.user_metadata?.subscription_status
  const isAdmin = user?.email === ADMIN_EMAIL

  const [feedbackCount, setFeedbackCount] = useState(0)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const hasNew = useWhatsNew()

  useEffect(() => {
    if (!isAdmin) return
    async function fetchCount() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/feedback', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (res.ok) {
          const json = await res.json()
          setFeedbackCount(json.feedbacks?.length || 0)
        }
      } catch {}
    }
    fetchCount()
  }, [isAdmin])

  const menuItems = [
    { name: 'Início', href: '/dashboard', icon: '🏠' },
    { name: 'Meu desempenho', href: '/analytics', icon: '📊' },
    { name: 'Plantões Realizados', href: '/plantoes-realizados', icon: '⏰' },
    { name: 'Plantões Futuros', href: '/plantoes-futuros', icon: '📅' },
    { name: 'Escala', href: '/escala', icon: '🗓️' },
    { name: 'Financeiro', href: '/financeiro', icon: '💰' },
    { name: 'Imposto de Renda', href: '/ir', icon: '📄' },
    { name: 'Meus Documentos', href: '/documentos', icon: '🛡️' },
    { name: 'Minha Assinatura', href: '/assinatura/minha', icon: '💳', badge: subStatus === 'active' ? 'Ativo' : undefined },
    ...(isAdmin ? [{ name: 'Feedbacks', href: '/admin/feedback', icon: '💬', badge: feedbackCount > 0 ? String(feedbackCount) : undefined }] : []),
  ]

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-center gap-3">
          <svg viewBox="0 0 48 48" className="h-9 w-9 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="#F97316"/>
            <circle cx="42" cy="6" r="10" fill="#FB923C" opacity="0.5"/>
            <circle cx="6" cy="42" r="10" fill="#FB923C" opacity="0.5"/>
            <text x="24" y="32" fontFamily="Arial Black, Impact, sans-serif" fontSize="18" fontWeight="900" fill="white" textAnchor="middle" letterSpacing="1">BEM</text>
          </svg>
          <h1 className="text-lg font-bold whitespace-nowrap">
            <span className="text-orange-500">BEM</span>
            <span className="text-gray-800"> plantonista</span>
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <button
                  onClick={() => handleNavigate(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-base">
                    {item.icon}
                  </span>
                  <span className="truncate text-left">{item.name}</span>
                  {'badge' in item && item.badge && (
                    <span className="ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-600">👤</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">
              {user?.user_metadata?.full_name || 'Médico'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.user_metadata?.crm || 'CRM'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowWhatsNew(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-1">
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">🚀</span>
          <span className="flex-1 text-left">O que há de novo</span>
          {hasNew && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          <span>🚪</span>
          <span>Sair</span>
        </button>
      </div>
      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
    </>
  )

  return (
    <>
      {/* Desktop — sempre visível em md+ */}
      <aside className="hidden md:flex flex-col w-[260px] flex-shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile — drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[9998] md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-[9999] w-[280px] flex flex-col bg-white shadow-xl md:hidden animate-slide-in">
            {/* Botão fechar */}
            <button
              onClick={onMobileClose}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="Fechar menu"
            >
              ✕
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
      {user && <FeedbackModal user={user} />}
    </>
  )
}
