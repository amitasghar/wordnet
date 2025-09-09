import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Asset Loading System', () => {
  let mockGame, mockLoad

  beforeEach(() => {
    mockLoad = {
      image: vi.fn(),
      audio: vi.fn(),
      json: vi.fn(),
      on: vi.fn(),
      start: vi.fn(),
      isLoading: vi.fn(() => false),
      progress: 0,
      totalToLoad: 0
    }

    mockGame = {
      load: mockLoad,
      cache: {
        json: {
          get: vi.fn(),
          add: vi.fn(),
          exists: vi.fn(() => false)
        },
        audio: {
          get: vi.fn(),
          exists: vi.fn(() => false)
        },
        image: {
          get: vi.fn(),
          exists: vi.fn(() => false)
        }
      }
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create AssetManager correctly', async () => {
    const { AssetManager } = await import('../src/managers/AssetManager.js')
    const assetManager = new AssetManager(mockGame)
    
    expect(assetManager).toBeDefined()
    expect(typeof assetManager.loadAsset).toBe('function')
    expect(typeof assetManager.preloadAssets).toBe('function')
  })

  it('should queue assets for loading', async () => {
    const { AssetManager } = await import('../src/managers/AssetManager.js')
    const assetManager = new AssetManager(mockGame)
    
    assetManager.queueAsset('image', 'test-image', 'path/to/image.png')
    
    const queue = assetManager.getLoadQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('image')
    expect(queue[0].key).toBe('test-image')
  })

  it('should handle asset loading progress', async () => {
    const { AssetManager } = await import('../src/managers/AssetManager.js')
    const assetManager = new AssetManager(mockGame)
    
    const progressCallback = vi.fn()
    assetManager.on('progress', progressCallback)
    
    // Simulate progress update
    assetManager.updateProgress(0.5)
    
    expect(progressCallback).toHaveBeenCalledWith(0.5)
  })
})

describe('Storage System', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  it('should create StorageManager correctly', async () => {
    const { StorageManager } = await import('../src/managers/StorageManager.js')
    const storageManager = new StorageManager()
    
    expect(storageManager).toBeDefined()
    expect(typeof storageManager.save).toBe('function')
    expect(typeof storageManager.load).toBe('function')
  })

  it('should save data to localStorage', async () => {
    const { StorageManager } = await import('../src/managers/StorageManager.js')
    const storageManager = new StorageManager()
    
    const testData = { score: 100, level: 5 }
    await storageManager.save('gameData', testData)
    
    expect(localStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('gameData'),
      expect.stringContaining('"score":100')
    )
  })

  it('should load data from localStorage', async () => {
    const { StorageManager } = await import('../src/managers/StorageManager.js')
    const storageManager = new StorageManager()
    
    const testData = { score: 100, level: 5 }
    localStorage.getItem.mockReturnValue(JSON.stringify(testData))
    
    const result = await storageManager.load('gameData')
    expect(result).toEqual(testData)
  })

  it('should handle storage errors gracefully', async () => {
    const { StorageManager } = await import('../src/managers/StorageManager.js')
    const storageManager = new StorageManager()
    
    localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full')
    })
    
    const result = await storageManager.save('gameData', { test: 'data' })
    expect(result).toBe(false)
  })
})

describe('Word Data Management', () => {
  it('should create WordDataManager correctly', async () => {
    const { WordDataManager } = await import('../src/managers/WordDataManager.js')
    const wordManager = new WordDataManager()
    
    expect(wordManager).toBeDefined()
    expect(typeof wordManager.loadCategories).toBe('function')
    expect(typeof wordManager.validateWord).toBe('function')
  })

  it('should validate words correctly', async () => {
    const { WordDataManager } = await import('../src/managers/WordDataManager.js')
    const wordManager = new WordDataManager()
    
    // Mock word data
    wordManager.wordDatabase = {
      'animals': ['cat', 'dog', 'elephant', 'tiger']
    }
    
    expect(wordManager.validateWord('cat', 'animals')).toBe(true)
    expect(wordManager.validateWord('car', 'animals')).toBe(false)
    expect(wordManager.validateWord('', 'animals')).toBe(false)
  })

  it('should get category words', async () => {
    const { WordDataManager } = await import('../src/managers/WordDataManager.js')
    const wordManager = new WordDataManager()
    
    wordManager.wordDatabase = {
      'colors': ['red', 'blue', 'green', 'yellow']
    }
    
    const words = wordManager.getCategoryWords('colors')
    expect(words).toEqual(['red', 'blue', 'green', 'yellow'])
    
    const emptyWords = wordManager.getCategoryWords('nonexistent')
    expect(emptyWords).toEqual([])
  })
})