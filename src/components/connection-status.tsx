'use client'

import { useState, useEffect } from 'react'
import { syncService } from '@/lib/sync-service'

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState({
    pendingItems: 0,
    isSyncing: false
  })

  useEffect(() => {
    // Set initial status
    setIsOnline(syncService.getConnectionStatus())

    // Listen for connection changes
    const unsubscribe = syncService.addConnectionListener((online) => {
      setIsOnline(online)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    // Check sync status periodically
    const interval = setInterval(() => {
      const status = syncService.getSyncStatus()
      setSyncStatus({
        pendingItems: status.pendingItems,
        isSyncing: status.syncInProgress
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = () => {
    if (syncStatus.isSyncing) return 'bg-yellow-500'
    if (!isOnline) return 'bg-red-500'
    if (syncStatus.pendingItems > 0) return 'bg-orange-500'
    return 'bg-green-500'
  }

  const getStatusTitle = () => {
    if (syncStatus.isSyncing) return 'Sincronizando...'
    if (!isOnline) return 'Offline'
    if (syncStatus.pendingItems > 0) return `${syncStatus.pendingItems} itens pendentes`
    return 'Sincronizado'
  }

  return (
    <div className="relative">
      <div
        className={`w-3 h-3 rounded-full ${getStatusColor()} transition-colors duration-300`}
        title={getStatusTitle()}
      />
      {syncStatus.isSyncing && (
        <div className="absolute -top-1 -right-1">
          <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {syncStatus.pendingItems > 0 && !syncStatus.isSyncing && (
        <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {syncStatus.pendingItems > 9 ? '9+' : syncStatus.pendingItems}
        </div>
      )}
    </div>
  )
}
