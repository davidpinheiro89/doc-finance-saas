import { supabase } from './supabase'
import { offlineDB, PlantaoData, SyncQueueItem } from './offline-db'

class SyncService {
  private isOnline: boolean = navigator.onLine
  private syncInProgress: boolean = false
  private listeners: ((online: boolean) => void)[] = []

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this))
      window.addEventListener('offline', this.handleOffline.bind(this))
    }
  }

  private handleOnline() {
    this.isOnline = true
    this.notifyListeners()
    this.startSync()
  }

  private handleOffline() {
    this.isOnline = false
    this.notifyListeners()
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline))
  }

  public getConnectionStatus(): boolean {
    return this.isOnline
  }

  public addConnectionListener(listener: (online: boolean) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  public async startSync(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return

    this.syncInProgress = true
    console.log('Starting sync process...')

    try {
      const syncQueue = await offlineDB.getSyncQueue()
      
      // Sort by timestamp to sync in order
      const sortedQueue = syncQueue.sort((a, b) => a.timestamp - b.timestamp)
      
      for (const item of sortedQueue) {
        try {
          await this.processSyncItem(item)
          await offlineDB.removeFromSyncQueue(item.id)
        } catch (error) {
          console.error('Failed to sync item:', item.id, error)
          
          // Increment retry count
          item.retries = (item.retries || 0) + 1
          
          // Remove from queue if too many retries
          if (item.retries >= 3) {
            await offlineDB.removeFromSyncQueue(item.id)
            console.warn('Removed item from sync queue after 3 retries:', item.id)
          } else {
            // Update retry count and continue
            await offlineDB.addToSyncQueue(item.operation, item.data)
          }
        }
      }

      console.log('Sync process completed')
    } catch (error) {
      console.error('Sync process failed:', error)
    } finally {
      this.syncInProgress = false
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const { operation, data } = item

    switch (operation) {
      case 'create':
        await this.syncCreate(data)
        break
      case 'update':
        await this.syncUpdate(data)
        break
      case 'delete':
        await this.syncDelete(data.id)
        break
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  private async syncCreate(data: PlantaoData): Promise<void> {
    const { data: result, error } = await supabase
      .from('plantoes')
      .insert({
        id: data.id,
        hospital: data.hospital,
        endereco: data.endereco,
        data: data.data,
        valor: data.valor,
        status: data.status,
        data_prevista_pagamento: data.data_prevista_pagamento,
        horas: data.horas,
        prazo_pagamento_dias: data.prazo_pagamento_dias,
        usuario_id: data.usuario_id
      })
      .select()
      .single()

    if (error) throw error
    
    // Mark as synced in local DB
    await offlineDB.markAsSynced(data.id)
  }

  private async syncUpdate(data: PlantaoData): Promise<void> {
    const { error } = await supabase
      .from('plantoes')
      .update({
        hospital: data.hospital,
        endereco: data.endereco,
        data: data.data,
        valor: data.valor,
        status: data.status,
        data_prevista_pagamento: data.data_prevista_pagamento,
        horas: data.horas,
        prazo_pagamento_dias: data.prazo_pagamento_dias
      })
      .eq('id', data.id)
      .eq('usuario_id', data.usuario_id)

    if (error) throw error
    
    // Mark as synced in local DB
    await offlineDB.markAsSynced(data.id)
  }

  private async syncDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('plantoes')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  public async syncFromServer(usuarioId: string): Promise<void> {
    if (!this.isOnline) return

    try {
      // Fetch all plantões from server
      const { data: serverPlantoes, error } = await supabase
        .from('plantoes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('data', { ascending: false })

      if (error) throw error

      // Get local plantões
      const localPlantoes = await offlineDB.getPlantoes(usuarioId)

      // Merge server data with local data
      const mergedPlantoes = this.mergePlantoes(serverPlantoes || [], localPlantoes)

      // Update local storage
      for (const plantao of mergedPlantoes) {
        await this.savePlantaoLocal(plantao)
      }

      // Clean up sync queue for successfully synced items
      await this.cleanupSyncQueue(mergedPlantoes)
    } catch (error) {
      console.error('Failed to sync from server:', error)
    }
  }

  private mergePlantoes(server: any[], local: PlantaoData[]): PlantaoData[] {
    const mergedMap = new Map<string, PlantaoData>()

    // Add server data first
    server.forEach(plantao => {
      mergedMap.set(plantao.id, {
        ...plantao,
        _synced: true,
        _created: Date.now(),
        _updated: Date.now()
      })
    })

    // Add or override with local data that hasn't been synced
    local.forEach(plantao => {
      if (!plantao._synced) {
        mergedMap.set(plantao.id, plantao)
      }
    })

    return Array.from(mergedMap.values())
  }

  private async savePlantaoLocal(plantao: PlantaoData): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BEMPlantonistaDB', 1)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['plantoes'], 'readwrite')
        const store = transaction.objectStore('plantoes')
        const putRequest = store.put(plantao)

        putRequest.onerror = () => reject(putRequest.error)
        putRequest.onsuccess = () => resolve()
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  private async cleanupSyncQueue(plantoes: PlantaoData[]): Promise<void> {
    const syncQueue = await offlineDB.getSyncQueue()
    
    for (const item of syncQueue) {
      const plantaoExists = plantoes.some(p => p.id === item.data.id)
      
      if (plantaoExists && item.operation === 'delete') {
        // Plantão was recreated on server, remove delete from queue
        await offlineDB.removeFromSyncQueue(item.id)
      } else if (plantaoExists && item.data._synced) {
        // Plantão is synced, remove from queue
        await offlineDB.removeFromSyncQueue(item.id)
      }
    }
  }

  public async createPlantaoOffline(plantao: PlantaoData): Promise<void> {
    // Generate temporary ID if not provided
    if (!plantao.id) {
      plantao.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // Save to local storage
    await offlineDB.savePlantao(plantao)

    // Try to sync if online
    if (this.isOnline) {
      await this.startSync()
    }
  }

  public async updatePlantaoOffline(plantao: PlantaoData): Promise<void> {
    // Save to local storage
    await offlineDB.savePlantao(plantao)

    // Try to sync if online
    if (this.isOnline) {
      await this.startSync()
    }
  }

  public async deletePlantaoOffline(id: string, usuarioId: string): Promise<void> {
    // Get the plantao first to ensure it exists
    const plantao = await offlineDB.getPlantoes(usuarioId)
    const plantaoToDelete = plantao.find(p => p.id === id)
    
    if (!plantaoToDelete) return

    // Delete from local storage
    await offlineDB.deletePlantao(id, usuarioId)

    // Try to sync if online
    if (this.isOnline) {
      await this.startSync()
    }
  }

  public async getPlantoesOffline(usuarioId: string): Promise<PlantaoData[]> {
    // Always try to sync from server first if online
    if (this.isOnline) {
      await this.syncFromServer(usuarioId)
    }

    // Return from local storage
    return await offlineDB.getPlantoes(usuarioId)
  }

  public getSyncStatus(): {
    isOnline: boolean
    syncInProgress: boolean
    pendingItems: number
  } {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingItems: 0 // Will be updated when we implement the queue count
    }
  }
}

export const syncService = new SyncService()
