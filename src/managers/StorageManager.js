import { devLogger } from '@/utils/devTools.js'

// Storage types
export const STORAGE_TYPES = {
  LOCAL: 'localStorage',
  INDEXED: 'indexedDB',
  SESSION: 'sessionStorage'
}

// Storage keys
export const STORAGE_KEYS = {
  GAME_STATE: 'wordnet_game_state',
  USER_SETTINGS: 'wordnet_user_settings',
  HIGH_SCORES: 'wordnet_high_scores',
  WORD_CACHE: 'wordnet_word_cache',
  CATEGORIES: 'wordnet_categories',
  USER_PROGRESS: 'wordnet_user_progress'
}

export class StorageManager {
  constructor () {
    this.preferredStorage = this.detectBestStorage()
    this.dbName = 'WordnetGameDB'
    this.dbVersion = 1
    this.db = null
    
    // Storage limits (in bytes)
    this.localStorageLimit = 5 * 1024 * 1024 // 5MB
    this.indexedDBLimit = 50 * 1024 * 1024 // 50MB
    
    this.init()
  }
  
  async init () {
    devLogger.storage(`StorageManager: Initializing with ${this.preferredStorage}`)
    
    if (this.preferredStorage === STORAGE_TYPES.INDEXED) {
      await this.initIndexedDB()
    }
    
    // Test storage availability
    await this.testStorageAvailability()
    
    devLogger.storage('StorageManager: Initialized successfully')
  }
  
  detectBestStorage () {
    const useIndexedDB = import.meta.env.VITE_USE_INDEXED_DB === 'true'
    const useLocalStorage = import.meta.env.VITE_USE_LOCAL_STORAGE === 'true'
    
    if (useIndexedDB && this.isIndexedDBAvailable()) {
      return STORAGE_TYPES.INDEXED
    }
    
    if (useLocalStorage && this.isLocalStorageAvailable()) {
      return STORAGE_TYPES.LOCAL
    }
    
    // Fallback detection
    if (this.isIndexedDBAvailable()) {
      return STORAGE_TYPES.INDEXED
    }
    
    if (this.isLocalStorageAvailable()) {
      return STORAGE_TYPES.LOCAL
    }
    
    console.warn('StorageManager: No storage methods available')
    return null
  }
  
  isLocalStorageAvailable () {
    try {
      const test = 'test'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch (e) {
      return false
    }
  }
  
  isIndexedDBAvailable () {
    try {
      return 'indexedDB' in window && indexedDB !== null
    } catch (e) {
      return false
    }
  }
  
  async initIndexedDB () {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      
      request.onerror = () => {
        console.error('StorageManager: IndexedDB failed to open')
        reject(request.error)
      }
      
      request.onsuccess = () => {
        this.db = request.result
        devLogger.storage('StorageManager: IndexedDB opened successfully')
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Create object stores
        if (!db.objectStoreNames.contains('gameData')) {
          const gameStore = db.createObjectStore('gameData', { keyPath: 'key' })
          gameStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
        
        if (!db.objectStoreNames.contains('wordCache')) {
          const wordStore = db.createObjectStore('wordCache', { keyPath: 'category' })
          wordStore.createIndex('lastUpdated', 'lastUpdated', { unique: false })
        }
        
        devLogger.storage('StorageManager: IndexedDB schema created')
      }
    })
  }
  
  async testStorageAvailability () {
    try {
      const testKey = 'storage_test'
      const testData = { test: true, timestamp: Date.now() }
      
      await this.save(testKey, testData)
      const loaded = await this.load(testKey)
      
      if (loaded && loaded.test === true) {
        await this.remove(testKey)
        devLogger.storage('StorageManager: Storage test passed')
        return true
      } else {
        throw new Error('Storage test failed - data mismatch')
      }
    } catch (error) {
      console.error('StorageManager: Storage test failed:', error)
      return false
    }
  }
  
  // Generic save method
  async save (key, data) {
    try {
      const serializedData = {
        key,
        data,
        timestamp: Date.now(),
        version: this.dbVersion
      }
      
      switch (this.preferredStorage) {
        case STORAGE_TYPES.INDEXED:
          return await this.saveToIndexedDB(key, serializedData)
          
        case STORAGE_TYPES.LOCAL:
          return await this.saveToLocalStorage(key, serializedData)
          
        default:
          console.error('StorageManager: No storage method available')
          return false
      }
    } catch (error) {
      console.error(`StorageManager: Failed to save "${key}":`, error)
      return false
    }
  }
  
  // Generic load method
  async load (key) {
    try {
      let result = null
      
      switch (this.preferredStorage) {
        case STORAGE_TYPES.INDEXED:
          result = await this.loadFromIndexedDB(key)
          break
          
        case STORAGE_TYPES.LOCAL:
          result = await this.loadFromLocalStorage(key)
          break
          
        default:
          console.error('StorageManager: No storage method available')
          return null
      }
      
      if (result && result.data) {
        devLogger.storage(`StorageManager: Loaded "${key}" from ${this.preferredStorage}`)
        return result.data
      }
      
      return null
    } catch (error) {
      console.error(`StorageManager: Failed to load "${key}":`, error)
      return null
    }
  }
  
  // Generic remove method
  async remove (key) {
    try {
      switch (this.preferredStorage) {
        case STORAGE_TYPES.INDEXED:
          return await this.removeFromIndexedDB(key)
          
        case STORAGE_TYPES.LOCAL:
          return await this.removeFromLocalStorage(key)
          
        default:
          return false
      }
    } catch (error) {
      console.error(`StorageManager: Failed to remove "${key}":`, error)
      return false
    }
  }
  
  // LocalStorage methods
  async saveToLocalStorage (key, data) {
    try {
      const serialized = JSON.stringify(data)
      
      // Check size limit
      if (serialized.length > this.localStorageLimit) {
        console.error(`StorageManager: Data too large for localStorage (${serialized.length} bytes)`)
        return false
      }
      
      localStorage.setItem(key, serialized)
      devLogger.storage(`StorageManager: Saved "${key}" to localStorage (${serialized.length} bytes)`)
      return true
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        devLogger.storage('StorageManager: localStorage quota exceeded, attempting cleanup')
        await this.cleanupLocalStorage()
        
        // Retry once
        try {
          localStorage.setItem(key, JSON.stringify(data))
          return true
        } catch (retryError) {
          console.error('StorageManager: localStorage save failed after cleanup:', retryError)
          return false
        }
      }
      throw error
    }
  }
  
  async loadFromLocalStorage (key) {
    try {
      const serialized = localStorage.getItem(key)
      if (!serialized) return null
      
      return JSON.parse(serialized)
    } catch (error) {
      console.error(`StorageManager: Failed to parse localStorage data for "${key}":`, error)
      // Remove corrupted data
      localStorage.removeItem(key)
      return null
    }
  }
  
  async removeFromLocalStorage (key) {
    localStorage.removeItem(key)
    return true
  }
  
  // IndexedDB methods
  async saveToIndexedDB (key, data) {
    if (!this.db) {
      console.error('StorageManager: IndexedDB not initialized')
      return false
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['gameData'], 'readwrite')
      const store = transaction.objectStore('gameData')
      const request = store.put(data)
      
      request.onsuccess = () => {
        devLogger.storage(`StorageManager: Saved "${key}" to IndexedDB`)
        resolve(true)
      }
      
      request.onerror = () => {
        console.error(`StorageManager: IndexedDB save failed for "${key}":`, request.error)
        reject(request.error)
      }
    })
  }
  
  async loadFromIndexedDB (key) {
    if (!this.db) {
      console.error('StorageManager: IndexedDB not initialized')
      return null
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['gameData'], 'readonly')
      const store = transaction.objectStore('gameData')
      const request = store.get(key)
      
      request.onsuccess = () => {
        resolve(request.result || null)
      }
      
      request.onerror = () => {
        console.error(`StorageManager: IndexedDB load failed for "${key}":`, request.error)
        reject(request.error)
      }
    })
  }
  
  async removeFromIndexedDB (key) {
    if (!this.db) {
      console.error('StorageManager: IndexedDB not initialized')
      return false
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['gameData'], 'readwrite')
      const store = transaction.objectStore('gameData')
      const request = store.delete(key)
      
      request.onsuccess = () => {
        devLogger.storage(`StorageManager: Removed "${key}" from IndexedDB`)
        resolve(true)
      }
      
      request.onerror = () => {
        console.error(`StorageManager: IndexedDB remove failed for "${key}":`, request.error)
        reject(request.error)
      }
    })
  }
  
  // Specialized methods for game data
  async saveGameState (state) {
    return await this.save(STORAGE_KEYS.GAME_STATE, state)
  }
  
  async loadGameState () {
    return await this.load(STORAGE_KEYS.GAME_STATE)
  }
  
  async saveUserSettings (settings) {
    return await this.save(STORAGE_KEYS.USER_SETTINGS, settings)
  }
  
  async loadUserSettings () {
    return await this.load(STORAGE_KEYS.USER_SETTINGS)
  }
  
  async saveHighScores (scores) {
    return await this.save(STORAGE_KEYS.HIGH_SCORES, scores)
  }
  
  async loadHighScores () {
    const scores = await this.load(STORAGE_KEYS.HIGH_SCORES)
    return scores || []
  }
  
  async saveWordCache (category, words) {
    const cacheData = {
      category,
      words,
      lastUpdated: Date.now(),
      version: 1
    }
    
    if (this.preferredStorage === STORAGE_TYPES.INDEXED && this.db) {
      // Use specialized word cache store
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['wordCache'], 'readwrite')
        const store = transaction.objectStore('wordCache')
        const request = store.put(cacheData)
        
        request.onsuccess = () => {
          devLogger.storage(`StorageManager: Cached words for category "${category}"`)
          resolve(true)
        }
        
        request.onerror = () => {
          reject(request.error)
        }
      })
    } else {
      return await this.save(`${STORAGE_KEYS.WORD_CACHE}_${category}`, cacheData)
    }
  }
  
  async loadWordCache (category) {
    if (this.preferredStorage === STORAGE_TYPES.INDEXED && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['wordCache'], 'readonly')
        const store = transaction.objectStore('wordCache')
        const request = store.get(category)
        
        request.onsuccess = () => {
          const result = request.result
          if (result && this.isCacheValid(result)) {
            resolve(result.words)
          } else {
            resolve(null)
          }
        }
        
        request.onerror = () => {
          reject(request.error)
        }
      })
    } else {
      const cacheData = await this.load(`${STORAGE_KEYS.WORD_CACHE}_${category}`)
      return (cacheData && this.isCacheValid(cacheData)) ? cacheData.words : null
    }
  }
  
  isCacheValid (cacheData) {
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    return (Date.now() - cacheData.lastUpdated) < maxAge
  }
  
  // Cleanup methods
  async cleanupLocalStorage () {
    const keysToRemove = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('wordnet_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key))
          if (data && data.timestamp) {
            const age = Date.now() - data.timestamp
            if (age > (7 * 24 * 60 * 60 * 1000)) { // 7 days
              keysToRemove.push(key)
            }
          }
        } catch (error) {
          // Remove corrupted entries
          keysToRemove.push(key)
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    devLogger.storage(`StorageManager: Cleaned up ${keysToRemove.length} localStorage entries`)
  }
  
  async cleanupIndexedDB () {
    if (!this.db) return
    
    const transaction = this.db.transaction(['gameData'], 'readwrite')
    const store = transaction.objectStore('gameData')
    const index = store.index('timestamp')
    
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days
    const range = IDBKeyRange.upperBound(cutoff)
    
    let deletedCount = 0
    
    return new Promise((resolve) => {
      const request = index.openCursor(range)
      
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          devLogger.storage(`StorageManager: Cleaned up ${deletedCount} IndexedDB entries`)
          resolve(deletedCount)
        }
      }
    })
  }
  
  // Clear all game data
  async clearAll () {
    try {
      if (this.preferredStorage === STORAGE_TYPES.INDEXED && this.db) {
        const transaction = this.db.transaction(['gameData', 'wordCache'], 'readwrite')
        const gameStore = transaction.objectStore('gameData')
        const wordStore = transaction.objectStore('wordCache')
        
        await Promise.all([
          new Promise(resolve => {
            const request = gameStore.clear()
            request.onsuccess = () => resolve()
          }),
          new Promise(resolve => {
            const request = wordStore.clear()
            request.onsuccess = () => resolve()
          })
        ])
      } else {
        // Clear localStorage entries
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key)
        })
        
        // Clear category-specific word caches
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key && key.startsWith('wordnet_')) {
            localStorage.removeItem(key)
          }
        }
      }
      
      devLogger.storage('StorageManager: Cleared all game data')
      return true
    } catch (error) {
      console.error('StorageManager: Failed to clear all data:', error)
      return false
    }
  }
  
  // Get storage usage information
  async getStorageInfo () {
    const info = {
      preferredStorage: this.preferredStorage,
      available: this.preferredStorage !== null,
      usage: 0,
      limit: 0
    }
    
    if (this.preferredStorage === STORAGE_TYPES.LOCAL) {
      // Estimate localStorage usage
      let usage = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('wordnet_')) {
          usage += localStorage.getItem(key).length
        }
      }
      
      info.usage = usage
      info.limit = this.localStorageLimit
    } else if (this.preferredStorage === STORAGE_TYPES.INDEXED) {
      info.limit = this.indexedDBLimit
      // IndexedDB usage estimation is complex, approximate
      info.usage = info.limit * 0.1 // Assume 10% usage
    }
    
    return info
  }
  
  // Debug information
  getDebugInfo () {
    return {
      preferredStorage: this.preferredStorage,
      isLocalStorageAvailable: this.isLocalStorageAvailable(),
      isIndexedDBAvailable: this.isIndexedDBAvailable(),
      dbInitialized: this.db !== null,
      dbVersion: this.dbVersion
    }
  }
}