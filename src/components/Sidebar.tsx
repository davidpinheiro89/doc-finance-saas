'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'

interface SidebarProps {
  user?: any
  isSidebarOpen?: boolean
}

export default function Sidebar({ user, isSidebarOpen }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true) // Start closed on mobile
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, []) // Empty dependency array ensures Sidebar is independent

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuItems = [
    {
      name: 'Início',
      href: '/dashboard',
      icon: <span className="h-5 w-5">🏠</span>,
    },
    {
      name: 'Meu desempenho',
      href: '/analytics',
      icon: <span className="h-5 w-5">📊</span>,
    },
    {
      name: 'Plantões Realizados',
      href: '/plantoes-realizados',
      icon: <span className="h-5 w-5">⏰</span>,
    },
    {
      name: 'Plantões Futuros',
      href: '/plantoes-futuros',
      icon: <span className="h-5 w-5">📅</span>,
    },
    {
      name: 'Escala',
      href: '/escala',
      icon: <span className="h-5 w-5">📅</span>,
    },
    {
      name: 'Financeiro',
      href: '/financeiro',
      icon: <span className="h-5 w-5">💰</span>,
    },
    {
      name: 'Imposto de Renda',
      href: '/ir',
      icon: <span className="h-5 w-5">📄</span>,
    },
  ]

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[99998] md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      
      {/* Block scroll when sidebar is open */}
      {isMobile && !isCollapsed && (
        <style jsx>{`
          body {
            overflow: hidden;
          }
        `}</style>
      )}

      {/* Desktop Sidebar */}
      <div data-sidebar-mobile className={`bg-white border-r border-gray-200 transition-all duration-300 fixed h-full relative z-[99999] hidden md:block ${
        isMobile ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full') : ''
      } ${isMobile ? 'max-w-[80%] w-[80%]' : (isCollapsed ? 'w-20' : 'w-64')}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-center relative">
            <div className="flex items-center">
              <div className="bg-orange-500 rounded-lg p-2 flex items-center justify-center">
                <span className="text-white text-lg leading-none">🏠</span>
              </div>
              {(!isCollapsed || isMobile) && (
                <h1 className="ml-3 text-xl font-bold whitespace-nowrap">
                  <span className="text-orange-500">BEM</span>
                  <span className="text-gray-800"> plantonista</span>
                </h1>
              )}
            </div>
            {/* Botão de fechar — visível apenas em mobile */}
            {isMobile && (
              <button
                onClick={() => {
                  setIsCollapsed(true)
                  if (typeof window !== 'undefined') {
                    const event = new CustomEvent('closeSidebar')
                    window.dispatchEvent(event)
                  }
                }}
                className="md:hidden absolute right-0 text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 pointer-events-auto cursor-pointer"
                aria-label="Fechar menu"
              >
                <span className="h-5 w-5">✕</span>
              </button>
            )}
          </div>
        </div>

      {/* Navigation */}
      <nav className="p-4 flex flex-col">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <button
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 pointer-events-auto cursor-pointer font-medium ${
                    isActive
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>
                  <span className="truncate">{item.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="bg-gray-200 rounded-full p-2">
            <span className="h-5 w-5 text-gray-600">👤</span>
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-700 truncate">
                {user?.user_metadata?.full_name || 'Médico'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.user_metadata?.crm || 'CRM'}
              </p>
            </div>
          )}
        </div>
        {(!isCollapsed || isMobile) && (
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200 pointer-events-auto cursor-pointer"
          >
            <span className="h-4 w-4">🚪</span>
            <span className="ml-2">Sair</span>
          </button>
        )}
      </div>
    </div>
    </>
  )
}
