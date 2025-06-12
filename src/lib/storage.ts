import type { TimelineData } from '@/stores/timelineStore'

// Storage configuration
const STORAGE_CONFIG = {
  dataDir: 'timeline-data',
  timelinesDir: 'timelines',
  imagesDir: 'images',
  exportsDir: 'exports',
  settingsFile: 'settings.json'
}

// Storage interface for different environments
interface StorageAdapter {
  writeFile(path: string, data: string): Promise<void>
  readFile(path: string): Promise<string>
  deleteFile(path: string): Promise<void>
  listFiles(dir: string): Promise<string[]>
  exists(path: string): Promise<boolean>
  createDir(path: string): Promise<void>
  writeImage(path: string, base64Data: string): Promise<void>
  readImage(path: string): Promise<string>
}

// Browser-based storage using IndexedDB
class BrowserStorageAdapter implements StorageAdapter {
  private dbName = 'TimelineStorage'
  private version = 1
  private db: IDBDatabase | null = null

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

        // Create object stores
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' })
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'path' })
        }
      }
    })
  }

  async writeFile(path: string, data: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      const request = store.put({ path, data, updatedAt: new Date() })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async readFile(path: string): Promise<string> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const request = store.get(path)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data)
        } else {
          reject(new Error(`File not found: ${path}`))
        }
      }
    })
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      const request = store.delete(path)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async listFiles(dir: string): Promise<string[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const request = store.getAllKeys()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const keys = request.result as string[]
        const filteredKeys = keys
          .filter(key => key.startsWith(dir))
          .map(key => key.replace(dir + '/', ''))
        resolve(filteredKeys)
      }
    })
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.readFile(path)
      return true
    } catch {
      return false
    }
  }

  async createDir(): Promise<void> {
    // IndexedDB doesn't need explicit directory creation
    return Promise.resolve()
  }

  async writeImage(path: string, base64Data: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite')
      const store = transaction.objectStore('images')
      const request = store.put({ path, data: base64Data, updatedAt: new Date() })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async readImage(path: string): Promise<string> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly')
      const store = transaction.objectStore('images')
      const request = store.get(path)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data)
        } else {
          reject(new Error(`Image not found: ${path}`))
        }
      }
    })
  }
}

// File system storage adapter (for Node.js/Electron environments)
class FileSystemStorageAdapter implements StorageAdapter {
  private basePath: string

  constructor(basePath: string = './timeline-data') {
    this.basePath = basePath
  }

  async writeFile(path: string, data: string): Promise<void> {
    // This would use Node.js fs module in a real implementation
    // For now, fall back to localStorage
    localStorage.setItem(path, data)
  }

  async readFile(path: string): Promise<string> {
    const data = localStorage.getItem(path)
    if (!data) throw new Error(`File not found: ${path}`)
    return data
  }

  async deleteFile(path: string): Promise<void> {
    localStorage.removeItem(path)
  }

  async listFiles(dir: string): Promise<string[]> {
    const keys = Object.keys(localStorage)
    return keys
      .filter(key => key.startsWith(dir))
      .map(key => key.replace(dir + '/', ''))
  }

  async exists(path: string): Promise<boolean> {
    return localStorage.getItem(path) !== null
  }

  async createDir(): Promise<void> {
    // No-op for localStorage
  }

  async writeImage(path: string, base64Data: string): Promise<void> {
    localStorage.setItem(`image-${path}`, base64Data)
  }

  async readImage(path: string): Promise<string> {
    const data = localStorage.getItem(`image-${path}`)
    if (!data) throw new Error(`Image not found: ${path}`)
    return data
  }
}

// Storage manager
class StorageManager {
  private adapter: StorageAdapter

  constructor() {
    // Choose adapter based on environment
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.adapter = new BrowserStorageAdapter()
    } else {
      this.adapter = new FileSystemStorageAdapter()
    }
  }

  async init(): Promise<void> {
    if (this.adapter instanceof BrowserStorageAdapter) {
      await this.adapter.init()
    }

    // Create directory structure
    await this.adapter.createDir(STORAGE_CONFIG.dataDir)
    await this.adapter.createDir(`${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.timelinesDir}`)
    await this.adapter.createDir(`${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.imagesDir}`)
    await this.adapter.createDir(`${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.exportsDir}`)
  }

  // Timeline operations (user-specific)
  async saveTimeline(timeline: TimelineData, userId?: string): Promise<void> {
    const userPrefix = userId ? `${userId}-` : ''
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.timelinesDir}/${userPrefix}${timeline.id}.json`
    const data = JSON.stringify(timeline, null, 2)
    await this.adapter.writeFile(path, data)
  }

  async loadTimeline(id: string, userId?: string): Promise<TimelineData> {
    const userPrefix = userId ? `${userId}-` : ''
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.timelinesDir}/${userPrefix}${id}.json`
    console.log('Storage: Loading timeline from path:', path)
    const data = await this.adapter.readFile(path)
    console.log('Storage: Timeline data loaded successfully, length:', data.length)
    return JSON.parse(data) as TimelineData
  }

  async deleteTimeline(id: string, userId?: string): Promise<void> {
    const userPrefix = userId ? `${userId}-` : ''
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.timelinesDir}/${userPrefix}${id}.json`
    console.log('Storage: Deleting timeline file at path:', path)
    await this.adapter.deleteFile(path)
    console.log('Storage: Timeline file deleted successfully')
  }

  async listTimelines(userId?: string): Promise<string[]> {
    const dir = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.timelinesDir}`
    const userPrefix = userId ? `${userId}-` : ''
    console.log('Storage: Listing timelines in directory:', dir, 'for user:', userId)
    const files = await this.adapter.listFiles(dir)
    console.log('Storage: Raw files found:', files)
    const filtered = files
      .filter(file => file.endsWith('.json') && file.startsWith(userPrefix))
      .map(file => file.replace('.json', '').replace(userPrefix, ''))
    console.log('Storage: Filtered timeline IDs:', filtered)
    return filtered
  }

  async timelineExists(id: string, userId?: string): Promise<boolean> {
    const userPrefix = userId ? `${userId}-` : ''
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.timelinesDir}/${userPrefix}${id}.json`
    return await this.adapter.exists(path)
  }

  // Image operations
  async saveImage(filename: string, base64Data: string): Promise<void> {
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.imagesDir}/${filename}`
    await this.adapter.writeImage(path, base64Data)
  }

  async loadImage(filename: string): Promise<string> {
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.imagesDir}/${filename}`
    return await this.adapter.readImage(path)
  }

  async deleteImage(filename: string): Promise<void> {
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.imagesDir}/${filename}`
    await this.adapter.deleteFile(path)
  }

  // Settings operations
  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.settingsFile}`
    const data = JSON.stringify(settings, null, 2)
    await this.adapter.writeFile(path, data)
  }

  async loadSettings(): Promise<Record<string, unknown>> {
    const path = `${STORAGE_CONFIG.dataDir}/${STORAGE_CONFIG.settingsFile}`
    try {
      const data = await this.adapter.readFile(path)
      return JSON.parse(data)
    } catch {
      return {} // Return empty settings if file doesn't exist
    }
  }

  // Export/Import operations
  async exportTimeline(timeline: TimelineData): Promise<Blob> {
    const exportData = {
      ...timeline,
      exportedAt: new Date(),
      version: '1.0'
    }

    // Include images in export
    const imagesData: Record<string, string> = {}
    for (const event of timeline.events) {
      if (event.image) {
        try {
          imagesData[event.image] = await this.loadImage(event.image)
        } catch (error) {
          console.warn(`Failed to load image ${event.image}:`, error)
        }
      }
    }

    const fullExport = {
      timeline: exportData,
      images: imagesData
    }

    return new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' })
  }

  async importTimeline(file: File): Promise<TimelineData> {
    const text = await file.text()
    const importData = JSON.parse(text)

    let timeline: TimelineData
    let images: Record<string, string> = {}

    // Handle different export formats
    if (importData.timeline && importData.images) {
      // Full export with images
      timeline = importData.timeline
      images = importData.images
    } else {
      // Timeline only
      timeline = importData
    }

    // Generate new ID to avoid conflicts
    timeline.id = this.generateId()
    timeline.updatedAt = new Date()

    // Import images
    for (const [filename, base64Data] of Object.entries(images)) {
      try {
        await this.saveImage(filename, base64Data)
      } catch (error) {
        console.warn(`Failed to import image ${filename}:`, error)
      }
    }

    return timeline
  }

  // Utility methods
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  async getStorageInfo(): Promise<{
    totalTimelines: number
    totalImages: number
    storageSize: number
  }> {
    const timelines = await this.listTimelines()

    // This is a simplified version - in a real implementation,
    // you'd calculate actual storage usage
    return {
      totalTimelines: timelines.length,
      totalImages: 0, // Would need to count images
      storageSize: 0  // Would need to calculate total size
    }
  }
}

// Export singleton instance
export const storageManager = new StorageManager()

// Export types and utilities
export type { StorageAdapter, TimelineData }
export { STORAGE_CONFIG }
