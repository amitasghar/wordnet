// Intelligent caching system for categories and letter frequencies
export class IntelligentCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000
    this.ttl = options.ttl || 300000 // 5 minutes default TTL
    this.cache = new Map()
    this.accessTimes = new Map()
    this.accessCounts = new Map()
    this.creationTimes = new Map()
    
    // Performance tracking
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    }

    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000) // Clean every minute
  }

  get(key) {
    this.stats.totalRequests++
    
    const now = Date.now()
    
    if (this.cache.has(key)) {
      const creationTime = this.creationTimes.get(key)
      
      // Check TTL
      if (now - creationTime > this.ttl) {
        this.delete(key)
        this.stats.misses++
        return null
      }
      
      // Update access tracking
      this.accessTimes.set(key, now)
      this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1)
      
      this.stats.hits++
      return this.cache.get(key)
    }
    
    this.stats.misses++
    return null
  }

  set(key, value) {
    const now = Date.now()
    
    // If cache is full, evict least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, value)
    this.accessTimes.set(key, now)
    this.creationTimes.set(key, now)
    this.accessCounts.set(key, 1)
  }

  has(key) {
    const now = Date.now()
    
    if (this.cache.has(key)) {
      const creationTime = this.creationTimes.get(key)
      
      // Check TTL
      if (now - creationTime > this.ttl) {
        this.delete(key)
        return false
      }
      
      return true
    }
    
    return false
  }

  delete(key) {
    this.cache.delete(key)
    this.accessTimes.delete(key)
    this.accessCounts.delete(key)
    this.creationTimes.delete(key)
  }

  clear() {
    this.cache.clear()
    this.accessTimes.clear()
    this.accessCounts.clear()
    this.creationTimes.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    }
  }

  evictLRU() {
    let oldestKey = null
    let oldestTime = Date.now()
    
    for (const [key, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey)
      this.stats.evictions++
    }
  }

  cleanup() {
    const now = Date.now()
    const keysToDelete = []
    
    for (const [key, creationTime] of this.creationTimes) {
      if (now - creationTime > this.ttl) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.delete(key))
  }

  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0

    return {
      ...this.stats,
      hitRate,
      size: this.cache.size,
      maxSize: this.maxSize
    }
  }

  // Intelligent prefetching based on access patterns
  suggestPrefetch() {
    const suggestions = []
    const sortedByAccess = [...this.accessCounts.entries()]
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10) // Top 10 most accessed

    for (const [key, count] of sortedByAccess) {
      if (count > 2) { // Frequently accessed items
        suggestions.push({
          key,
          accessCount: count,
          priority: 'high'
        })
      }
    }

    return suggestions
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Specialized cache for category data
export class CategoryCache extends IntelligentCache {
  constructor(options = {}) {
    super({
      maxSize: 500,
      ttl: 600000, // 10 minutes for categories
      ...options
    })
  }

  getCategoryKey(difficulty, letter) {
    return `category_${difficulty}_${letter}`
  }

  getCategoriesByDifficulty(difficulty) {
    return this.get(`difficulty_${difficulty}`)
  }

  setCategoriesByDifficulty(difficulty, categories) {
    this.set(`difficulty_${difficulty}`, categories)
  }

  getCompatibleCategories(letter) {
    return this.get(`compatible_${letter}`)
  }

  setCompatibleCategories(letter, categories) {
    this.set(`compatible_${letter}`, categories)
  }
}

// Specialized cache for letter frequency data
export class LetterFrequencyCache extends IntelligentCache {
  constructor(options = {}) {
    super({
      maxSize: 100,
      ttl: 1800000, // 30 minutes for frequency data
      ...options
    })
  }

  getFrequencyData(strategy) {
    return this.get(`frequency_${strategy}`)
  }

  setFrequencyData(strategy, data) {
    this.set(`frequency_${strategy}`, data)
  }

  getWeightedLetters(category, difficulty) {
    const key = `weighted_${category.name}_${difficulty}`
    return this.get(key)
  }

  setWeightedLetters(category, difficulty, letters) {
    const key = `weighted_${category.name}_${difficulty}`
    this.set(key, letters)
  }
}

// Optimized object pool for frequent allocations
export class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn
    this.resetFn = resetFn
    this.pool = []
    this.stats = {
      created: 0,
      borrowed: 0,
      returned: 0,
      poolHits: 0
    }

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn())
      this.stats.created++
    }
  }

  borrow() {
    this.stats.borrowed++
    
    if (this.pool.length > 0) {
      this.stats.poolHits++
      return this.pool.pop()
    }
    
    this.stats.created++
    return this.createFn()
  }

  return(obj) {
    if (this.resetFn) {
      this.resetFn(obj)
    }
    
    this.pool.push(obj)
    this.stats.returned++
  }

  clear() {
    this.pool.length = 0
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      hitRate: this.stats.borrowed > 0 ? (this.stats.poolHits / this.stats.borrowed) * 100 : 0
    }
  }
}

// Memory pool for combination objects
export class CombinationPool extends ObjectPool {
  constructor() {
    super(
      // Create function
      () => ({
        category: null,
        letter: null,
        difficulty: null,
        timestamp: 0,
        isValid: false
      }),
      // Reset function
      (obj) => {
        obj.category = null
        obj.letter = null
        obj.difficulty = null
        obj.timestamp = 0
        obj.isValid = false
      },
      20 // Initial pool size
    )
  }

  borrowCombination() {
    const obj = this.borrow()
    obj.timestamp = Date.now()
    return obj
  }
}

// Performance-optimized data structures
export class OptimizedLookupMap {
  constructor() {
    this.primaryMap = new Map()
    this.reverseMap = new Map()
    this.indexArray = []
    this.dirty = false
  }

  set(key, value) {
    this.primaryMap.set(key, value)
    
    if (!this.reverseMap.has(value)) {
      this.reverseMap.set(value, new Set())
    }
    this.reverseMap.get(value).add(key)
    
    this.dirty = true
  }

  get(key) {
    return this.primaryMap.get(key)
  }

  getByValue(value) {
    return this.reverseMap.get(value) || new Set()
  }

  // Get random key efficiently
  getRandomKey() {
    if (this.dirty) {
      this.indexArray = [...this.primaryMap.keys()]
      this.dirty = false
    }
    
    if (this.indexArray.length === 0) return null
    
    const randomIndex = Math.floor(Math.random() * this.indexArray.length)
    return this.indexArray[randomIndex]
  }

  // Get multiple random keys efficiently
  getRandomKeys(count) {
    if (this.dirty) {
      this.indexArray = [...this.primaryMap.keys()]
      this.dirty = false
    }
    
    if (this.indexArray.length === 0) return []
    
    const result = []
    const usedIndices = new Set()
    
    while (result.length < count && usedIndices.size < this.indexArray.length) {
      const randomIndex = Math.floor(Math.random() * this.indexArray.length)
      
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex)
        result.push(this.indexArray[randomIndex])
      }
    }
    
    return result
  }

  clear() {
    this.primaryMap.clear()
    this.reverseMap.clear()
    this.indexArray = []
    this.dirty = false
  }

  size() {
    return this.primaryMap.size
  }
}