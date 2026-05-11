'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SidebarProps {
  user?: any
}

export default function Sidebar({ user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
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
  }, [])

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
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-lg border border-gray-200 md:hidden"
        >
          <span className="h-6 w-6">☰</span>
        </button>
      )}

      {/* Desktop Sidebar */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 fixed md:relative h-full z-[9999] ${
        isMobile ? (isCollapsed ? 'translate-x-0' : '-translate-x-full') : ''
      } ${isMobile ? 'w-64' : (isCollapsed ? 'w-20' : 'w-64')}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${isCollapsed && !isMobile ? 'justify-center' : ''}`}>
              <div className="bg-orange-500 rounded-lg p-2">
                <span className="h-6 w-6 text-white">🏠</span>
              </div>
              {(!isCollapsed || isMobile) && (
                <h1 className="ml-3 text-xl font-bold">
                  <span className="text-orange-500">BEM</span>
                  <span className="text-gray-800"> plantonista</span>
                </h1>
              )}
            </div>
            {!isMobile && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
              >
                <span className="h-5 w-5">❌</span>
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
                      className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
                        isActive
                          ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex-shrink-0">{item.icon}</div>
                      <span className="ml-3">{item.name}</span>
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
            className="mt-3 w-full flex items-center justify-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200"
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
