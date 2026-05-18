'use client'

import { useState, useEffect } from 'react'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export default function NotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [requesting, setRequesting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)

    // Check if user previously dismissed this card
    const wasDismissed = localStorage.getItem('bem-plantonista-notif-dismissed')
    if (wasDismissed === 'true') setDismissed(true)
  }, [])

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return
    setRequesting(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PermissionState)
      if (result === 'granted') {
        // Show a test notification
        new Notification('BEM Plantonista 🩺', {
          body: 'Notificações ativadas! Você receberá lembretes de plantões e alertas de pagamento.',
          icon: '/favicon.ico',
        })
      }
    } catch {
      console.error('Erro ao solicitar permissão de notificação')
    } finally {
      setRequesting(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('bem-plantonista-notif-dismissed', 'true')
  }

  // Don't show if: unsupported, already granted, already denied, or dismissed
  if (permission === 'unsupported' || permission === 'granted' || permission === 'denied' || dismissed) {
    return null
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 p-4 md:p-5">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-violet-200/20" />
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/20">
          <svg className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Assistente Pessoal no Celular</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Receba lembretes de plantões e alertas de pagamento direto no seu aparelho.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleRequestPermission}
              disabled={requesting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl shadow-sm shadow-violet-500/20 hover:shadow-md hover:shadow-violet-500/30 transition-all disabled:opacity-60"
            >
              {requesting ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
              Ativar Lembretes
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-xl transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
        {/* Close button */}
        <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-violet-100/60 text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * Status badge component — shows current notification permission state.
 * Use this in a settings/profile page.
 */
export function NotificationStatus() {
  const [permission, setPermission] = useState<PermissionState>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)
  }, [])

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result as PermissionState)
    if (result === 'granted') {
      new Notification('BEM Plantonista 🩺', {
        body: 'Notificações ativadas com sucesso!',
        icon: '/favicon.ico',
      })
    }
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200/60 bg-white">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          permission === 'granted' ? 'bg-emerald-100' :
          permission === 'denied' ? 'bg-red-100' : 'bg-violet-100'
        }`}>
          <svg className={`h-4 w-4 ${
            permission === 'granted' ? 'text-emerald-600' :
            permission === 'denied' ? 'text-red-600' : 'text-violet-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Notificações Push</p>
          <p className="text-[10px] text-gray-500">
            {permission === 'granted' && 'Ativas — você receberá lembretes'}
            {permission === 'denied' && 'Bloqueadas — reative nas configurações do navegador'}
            {permission === 'default' && 'Não configuradas'}
            {permission === 'unsupported' && 'Não suportadas neste navegador'}
          </p>
        </div>
      </div>
      {permission === 'default' && (
        <button onClick={handleRequestPermission}
          className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
          Ativar
        </button>
      )}
      {permission === 'granted' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-100 text-emerald-700 uppercase tracking-wide">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          Ativo
        </span>
      )}
    </div>
  )
}
