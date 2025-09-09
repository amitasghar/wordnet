import { devLogger } from '@/utils/devTools.js'

// Asset types enumeration
export const ASSET_TYPES = {
  IMAGE: 'image',
  AUDIO: 'audio',
  JSON: 'json',
  TEXT: 'text',
  FONT: 'font'
}

// Asset loading priorities
export const PRIORITY = {
  CRITICAL: 0,    // Must load before game starts
  HIGH: 1,        // Load in first batch
  MEDIUM: 2,      // Load in background
  LOW: 3          // Load when needed
}

export class AssetManager {
  constructor (game) {
    this.game = game
    this.loadQueue = []
    this.loadedAssets = new Map()
    this.loadingProgress = 0
    this.isLoading = false
    this.loadingErrors = []
    
    // Event listeners
    this.listeners = new Map()
    
    // Memory management
    this.memoryLimit = 50 * 1024 * 1024 // 50MB limit for word game
    this.currentMemoryUsage = 0
    this.assetSizes = new Map()
    
    // Batch loading configuration
    this.batchSize = 5
    this.currentBatch = []
    
    devLogger.asset('AssetManager: Initialized')
  }
  
  // Queue an asset for loading
  queueAsset (type, key, path, priority = PRIORITY.MEDIUM, config = {}) {
    if (this.isAssetLoaded(key)) {
      devLogger.asset(`AssetManager: Asset "${key}" already loaded`)
      return false
    }
    
    const asset = {
      type,
      key,
      path,
      priority,
      config,
      timestamp: Date.now(),
      loaded: false,
      error: null,
      size: 0
    }
    
    this.loadQueue.push(asset)
    this.sortQueueByPriority()
    
    devLogger.asset(`AssetManager: Queued ${type} asset "${key}" with priority ${priority}`)
    return true
  }
  
  // Sort queue by priority (critical first)
  sortQueueByPriority () {
    this.loadQueue.sort((a, b) => a.priority - b.priority)
  }
  
  // Load all queued assets
  async loadQueuedAssets () {
    if (this.isLoading) {
      devLogger.asset('AssetManager: Already loading assets')
      return false
    }
    
    if (this.loadQueue.length === 0) {
      devLogger.asset('AssetManager: No assets to load')
      return true
    }
    
    this.isLoading = true
    this.loadingErrors = []
    this.emit('loadstart', { totalAssets: this.loadQueue.length })
    
    devLogger.asset(`AssetManager: Starting to load ${this.loadQueue.length} assets`)
    
    try {
      // Load critical assets first
      await this.loadAssetsByPriority(PRIORITY.CRITICAL)
      
      // Load high priority assets
      await this.loadAssetsByPriority(PRIORITY.HIGH)
      
      // Load medium and low priority assets in batches
      await this.loadRemainingAssets()
      
      this.isLoading = false
      this.emit('loadcomplete', { 
        loadedAssets: this.loadedAssets.size,
        errors: this.loadingErrors.length 
      })
      
      devLogger.asset(`AssetManager: Completed loading. ${this.loadedAssets.size} assets loaded, ${this.loadingErrors.length} errors`)
      return true
      
    } catch (error) {
      this.isLoading = false
      console.error('AssetManager: Failed to load assets:', error)
      this.emit('loaderror', { error })
      return false
    }
  }
  
  // Load assets by specific priority
  async loadAssetsByPriority (priority) {
    const assetsToLoad = this.loadQueue.filter(asset => 
      asset.priority === priority && !asset.loaded
    )
    
    if (assetsToLoad.length === 0) return
    
    devLogger.asset(`AssetManager: Loading ${assetsToLoad.length} assets with priority ${priority}`)
    
    for (const asset of assetsToLoad) {
      await this.loadSingleAsset(asset)
    }
  }
  
  // Load remaining assets in batches
  async loadRemainingAssets () {
    const remainingAssets = this.loadQueue.filter(asset => !asset.loaded)
    
    for (let i = 0; i < remainingAssets.length; i += this.batchSize) {
      const batch = remainingAssets.slice(i, i + this.batchSize)
      
      devLogger.asset(`AssetManager: Loading batch ${Math.floor(i / this.batchSize) + 1}`)
      
      // Load batch in parallel
      const batchPromises = batch.map(asset => this.loadSingleAsset(asset))
      await Promise.all(batchPromises)
      
      // Update progress
      this.updateProgress(Math.min((i + this.batchSize) / remainingAssets.length, 1))
      
      // Small delay between batches to prevent blocking
      if (i + this.batchSize < remainingAssets.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
  }
  
  // Load a single asset
  async loadSingleAsset (asset) {
    try {
      devLogger.asset(`AssetManager: Loading ${asset.type} "${asset.key}"`)
      
      let loadedAsset = null
      
      switch (asset.type) {
        case ASSET_TYPES.IMAGE:
          loadedAsset = await this.loadImage(asset)
          break
          
        case ASSET_TYPES.AUDIO:
          loadedAsset = await this.loadAudio(asset)
          break
          
        case ASSET_TYPES.JSON:
          loadedAsset = await this.loadJSON(asset)
          break
          
        case ASSET_TYPES.TEXT:
          loadedAsset = await this.loadText(asset)
          break
          
        default:
          throw new Error(`Unsupported asset type: ${asset.type}`)
      }
      
      if (loadedAsset) {
        asset.loaded = true
        asset.size = this.estimateAssetSize(loadedAsset, asset.type)
        
        this.loadedAssets.set(asset.key, {
          asset: loadedAsset,
          type: asset.type,
          size: asset.size,
          loadTime: Date.now() - asset.timestamp
        })
        
        this.currentMemoryUsage += asset.size
        this.assetSizes.set(asset.key, asset.size)
        
        devLogger.asset(`AssetManager: Loaded "${asset.key}" (${this.formatBytes(asset.size)})`)
        
        this.emit('assetloaded', { key: asset.key, type: asset.type })
        return true
      }
      
    } catch (error) {
      asset.error = error
      this.loadingErrors.push({ asset: asset.key, error })
      console.error(`AssetManager: Failed to load "${asset.key}":`, error)
      this.emit('asseterror', { key: asset.key, error })
      return false
    }
  }
  
  // Load image asset
  async loadImage (asset) {
    return new Promise((resolve, reject) => {
      if (this.game && this.game.load) {
        // Use Phaser's loader if available
        this.game.load.image(asset.key, asset.path)
        
        this.game.load.once('filecomplete-image-' + asset.key, () => {
          resolve(this.game.cache.image.get(asset.key))
        })
        
        this.game.load.once('loaderror', () => {
          reject(new Error(`Failed to load image: ${asset.key}`))
        })
        
        this.game.load.start()
      } else {
        // Fallback to direct image loading
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${asset.path}`))
        img.src = asset.path
      }
    })
  }
  
  // Load audio asset
  async loadAudio (asset) {
    return new Promise((resolve, reject) => {
      if (this.game && this.game.load) {
        this.game.load.audio(asset.key, asset.path)
        
        this.game.load.once('filecomplete-audio-' + asset.key, () => {
          resolve(this.game.cache.audio.get(asset.key))
        })
        
        this.game.load.once('loaderror', () => {
          reject(new Error(`Failed to load audio: ${asset.key}`))
        })
        
        this.game.load.start()
      } else {
        // Fallback to direct audio loading
        const audio = new Audio(asset.path)
        audio.oncanplaythrough = () => resolve(audio)
        audio.onerror = () => reject(new Error(`Failed to load audio: ${asset.path}`))
        audio.load()
      }
    })
  }
  
  // Load JSON asset
  async loadJSON (asset) {
    try {
      const response = await fetch(asset.path)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Cache in Phaser if available
      if (this.game && this.game.cache && this.game.cache.json) {
        this.game.cache.json.add(asset.key, data)
      }
      
      return data
    } catch (error) {
      throw new Error(`Failed to load JSON: ${error.message}`)
    }
  }
  
  // Load text asset
  async loadText (asset) {
    try {
      const response = await fetch(asset.path)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.text()
    } catch (error) {
      throw new Error(`Failed to load text: ${error.message}`)
    }
  }
  
  // Estimate asset size for memory management
  estimateAssetSize (asset, type) {
    if (!asset) return 0
    
    switch (type) {
      case ASSET_TYPES.IMAGE:
        if (asset.width && asset.height) {
          return asset.width * asset.height * 4 // RGBA
        }
        return 1024 * 1024 // Estimate 1MB for images
        
      case ASSET_TYPES.AUDIO:
        return 2 * 1024 * 1024 // Estimate 2MB for audio
        
      case ASSET_TYPES.JSON:
      case ASSET_TYPES.TEXT:
        return JSON.stringify(asset).length * 2 // Unicode estimate
        
      default:
        return 1024 // 1KB default
    }
  }
  
  // Check if asset is loaded
  isAssetLoaded (key) {
    return this.loadedAssets.has(key)
  }
  
  // Get loaded asset
  getAsset (key) {
    const assetData = this.loadedAssets.get(key)
    return assetData ? assetData.asset : null
  }
  
  // Unload asset to free memory
  unloadAsset (key) {
    if (!this.loadedAssets.has(key)) {
      return false
    }
    
    const assetData = this.loadedAssets.get(key)
    const size = this.assetSizes.get(key) || 0
    
    this.loadedAssets.delete(key)
    this.assetSizes.delete(key)
    this.currentMemoryUsage -= size
    
    // Remove from Phaser cache if present
    if (this.game && this.game.cache) {
      switch (assetData.type) {
        case ASSET_TYPES.IMAGE:
          if (this.game.cache.image) this.game.cache.image.remove(key)
          break
        case ASSET_TYPES.AUDIO:
          if (this.game.cache.audio) this.game.cache.audio.remove(key)
          break
        case ASSET_TYPES.JSON:
          if (this.game.cache.json) this.game.cache.json.remove(key)
          break
      }
    }
    
    devLogger.asset(`AssetManager: Unloaded "${key}" (freed ${this.formatBytes(size)})`)
    this.emit('assetunloaded', { key, size })
    
    return true
  }
  
  // Memory management - unload least recently used assets
  freeMemory (targetBytes) {
    const assetsToUnload = Array.from(this.loadedAssets.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => a.loadTime - b.loadTime) // Sort by load time (oldest first)
    
    let freedBytes = 0
    
    for (const assetInfo of assetsToUnload) {
      if (freedBytes >= targetBytes) break
      
      const size = this.assetSizes.get(assetInfo.key) || 0
      this.unloadAsset(assetInfo.key)
      freedBytes += size
    }
    
    devLogger.asset(`AssetManager: Freed ${this.formatBytes(freedBytes)} of memory`)
    return freedBytes
  }
  
  // Check memory usage and auto-cleanup if needed
  checkMemoryUsage () {
    if (this.currentMemoryUsage > this.memoryLimit) {
      const excessMemory = this.currentMemoryUsage - this.memoryLimit
      devLogger.asset(`AssetManager: Memory limit exceeded by ${this.formatBytes(excessMemory)}`)
      
      this.freeMemory(excessMemory + (5 * 1024 * 1024)) // Free extra 5MB buffer
      this.emit('memoryfreed', { excessMemory })
    }
  }
  
  // Update loading progress
  updateProgress (progress) {
    this.loadingProgress = Math.max(0, Math.min(1, progress))
    this.emit('progress', this.loadingProgress)
  }
  
  // Get loading queue
  getLoadQueue () {
    return [...this.loadQueue]
  }
  
  // Get loaded assets info
  getLoadedAssetsInfo () {
    return {
      count: this.loadedAssets.size,
      totalSize: this.currentMemoryUsage,
      memoryUsage: this.currentMemoryUsage / this.memoryLimit,
      assets: Array.from(this.loadedAssets.keys())
    }
  }
  
  // Event system
  on (event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }
  
  off (event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
  
  emit (event, data = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`AssetManager: Error in event listener for "${event}":`, error)
        }
      })
    }
  }
  
  // Utility function to format bytes
  formatBytes (bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  // Clear all assets and reset
  clear () {
    this.loadedAssets.clear()
    this.assetSizes.clear()
    this.loadQueue = []
    this.currentMemoryUsage = 0
    this.loadingProgress = 0
    this.isLoading = false
    this.loadingErrors = []
    
    devLogger.asset('AssetManager: Cleared all assets')
    this.emit('cleared')
  }
  
  // Debug information
  getDebugInfo () {
    return {
      isLoading: this.isLoading,
      loadingProgress: this.loadingProgress,
      queueLength: this.loadQueue.length,
      loadedAssets: this.loadedAssets.size,
      memoryUsage: this.formatBytes(this.currentMemoryUsage),
      memoryLimit: this.formatBytes(this.memoryLimit),
      memoryUtilization: ((this.currentMemoryUsage / this.memoryLimit) * 100).toFixed(1) + '%',
      errors: this.loadingErrors.length
    }
  }
}