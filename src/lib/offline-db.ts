// IndexedDB service for offline storage
interface PlantaoData {
  id: string
  hospital: string
  endereco?: string
  data: string
  valor: number
  status: 'pendente' | 'pago' | 'confirmado' | 'realizado'
  data_prevista_pagamento?: string
  horas?: number
  prazo_pagamento_dias?: number
  user_id: string
  _created?: number
  _updated?: number
  _synced?: boolean
  _operation?: 'create' | 'update' | 'delete'
}

interface SyncQueueItem {
  id: string
  operation: 'create' | 'update' | 'delete'
  data: PlantaoData
  timestamp: number
  retries?: number
}

class OfflineDB {
  private db: IDBDatabase | null = null
  private readonly dbName = 'BEMPlantonistaDB'
  // Version 2: rename index `usuario_id` -> `user_id` to align with the
  // normalized Supabase schema (migration 003). Older clients with v1 are
  // upgraded transparently via onupgradeneeded.
  private readonly version = 2

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const tx = (event.target as IDBOpenDBRequest).transaction!

        // ----- plantoes store -----
        let plantoesStore: IDBObjectStore
        if (!db.objectStoreNames.contains('plantoes')) {
          plantoesStore = db.createObjectStore('plantoes', { keyPath: 'id' })
          plantoesStore.createIndex('user_id', 'user_id', { unique: false })
          plantoesStore.createIndex('data', 'data', { unique: false })
          plantoesStore.createIndex('_synced', '_synced', { unique: false })
        } else {
          plantoesStore = tx.objectStore('plantoes')

          // Upgrade v1 -> v2: rename usuario_id index to user_id and migrate
          // existing rows so they carry the new field name.
          if (plantoesStore.indexNames.contains('usuario_id')) {
            plantoesStore.deleteIndex('usuario_id')
          }
          if (!plantoesStore.indexNames.contains('user_id')) {
            plantoesStore.createIndex('user_id', 'user_id', { unique: false })
          }

          const cursorReq = plantoesStore.openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (!cursor) return
            const row = cursor.value as Record<string, any>
            if (row.user_id == null && row.usuario_id != null) {
              row.user_id = row.usuario_id
              delete row.usuario_id
              cursor.update(row)
            }
            cursor.continue()
          }
        }

        // ----- sync queue store -----
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async getPlantoes(userId: string): Promise<PlantaoData[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['plantoes'], 'readonly')
      const store = transaction.objectStore('plantoes')
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async savePlantao(plantao: PlantaoData): Promise<void> {
    if (!this.db) await this.init()
    
    // Add metadata
    const plantaoWithMeta = {
      ...plantao,
      _created: plantao._created || Date.now(),
      _updated: Date.now(),
      _synced: false,
      _operation: (plantao.id ? 'update' : 'create') as 'create' | 'update' | 'delete'
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['plantoes'], 'readwrite')
      const store = transaction.objectStore('plantoes')
      const request = store.put(plantaoWithMeta)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        // Add to sync queue
        this.addToSyncQueue(plantaoWithMeta._operation!, plantaoWithMeta)
        resolve()
      }
    })
  }

  async deletePlantao(id: string, userId: string): Promise<void> {
    if (!this.db) await this.init()
    
    // First get the plantao to add to sync queue
    const plantao = await this.getPlantaoById(id)
    if (!plantao) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['plantoes', 'syncQueue'], 'readwrite')
      
      // Delete from plantoes store
      const plantoesStore = transaction.objectStore('plantoes')
      const deleteRequest = plantoesStore.delete(id)

      deleteRequest.onerror = () => reject(deleteRequest.error)
      deleteRequest.onsuccess = () => {
        // Add to sync queue
        this.addToSyncQueue('delete' as const, { ...plantao, _operation: 'delete' as const })
        resolve()
      }
    })
  }

  private async getPlantaoById(id: string): Promise<PlantaoData | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['plantoes'], 'readonly')
      const store = transaction.objectStore('plantoes')
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  public async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: PlantaoData): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')
      
      const syncItem: SyncQueueItem = {
        id: `${operation}_${data.id}_${Date.now()}`,
        operation,
        data,
        timestamp: Date.now(),
        retries: 0
      }

      const request = store.put(syncItem)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly')
      const store = transaction.objectStore('syncQueue')
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async markAsSynced(plantaoId: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['plantoes'], 'readwrite')
      const store = transaction.objectStore('plantoes')
      const request = store.get(plantaoId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const plantao = request.result
        if (plantao) {
          plantao._synced = true
          plantao._updated = Date.now()
          const updateRequest = store.put(plantao)
          
          updateRequest.onerror = () => reject(updateRequest.error)
          updateRequest.onsuccess = () => resolve()
        } else {
          resolve()
        }
      }
    })
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

export const offlineDB = new OfflineDB()
export type { PlantaoData, SyncQueueItem }
