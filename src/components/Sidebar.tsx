'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabaseClient as supabase } from '@/lib/supabase-client'

interface SidebarProps {
  user?: any
}

/**
 * Sidebar de navegação do BEM Plantonista.
 *
 * Layout:
 *  - Desktop (md+): largura fixa de 260px, sempre visível.
 *  - Mobile: oculta por padrão, controlada via toggle externo (drawer).
 *
 * Estrutura: header com logo + nome, lista de menus, e rodapé com usuário/logout.
 */
export default function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuItems = [
    { name: 'Início', href: '/dashboard', icon: '🏠' },
    { name: 'Meu desempenho', href: '/analytics', icon: '📊' },
    { name: 'Plantões Realizados', href: '/plantoes-realizados', icon: '⏰' },
    { name: 'Plantões Futuros', href: '/plantoes-futuros', icon: '📅' },
    { name: 'Escala', href: '/escala', icon: '�️' },
    { name: 'Financeiro', href: '/financeiro', icon: '💰' },
    { name: 'Imposto de Renda', href: '/ir', icon: '📄' },
  ]

  return (
    <aside className="hidden md:flex flex-col w-[260px] flex-shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Header — logo centralizado */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-center gap-3">
          <div className="bg-orange-500 rounded-lg w-10 h-10 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg leading-none">🏠</span>
          </div>
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
                  onClick={() => router.push(item.href)}
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
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          <span>🚪</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
