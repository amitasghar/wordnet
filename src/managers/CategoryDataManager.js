import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'
import { gracefulDegradation } from '@/utils/GracefulDegradation.js'
import { CategoryCache, OptimizedLookupMap } from '@/utils/IntelligentCache.js'

/**
 * CategoryDataManager
 * 
 * Manages category data for the word game including loading, filtering,
 * and searching functionality. Optimized for fast category retrieval
 * and round generation.
 */
export class CategoryDataManager {
  constructor (storageManager = null) {
    this.storageManager = storageManager
    this.categories = []
    this.categoriesById = new Map()
    this.initialized = false
    
    // Intelligent caching system
    this.cache = new CategoryCache({
      maxSize: 500,
      ttl: 600000 // 10 minutes
    })
    
    // Optimized lookup structures
    this.difficultyLookup = new OptimizedLookupMap()
    this.letterCompatibilityLookup = new OptimizedLookupMap()
    
    // Performance monitoring
    this.stats = {
      totalCategories: 0,
      loadTime: 0,
      lastAccess: null,
      cacheStats: () => this.cache.getStats()
    }
    
    // Lazy loading optimization
    this.lazyLoadPromise = null
    this.buildIndexesPromise = null
  }

  /**
   * Initialize the category manager with default or stored categories
   */
  async init () {
    const startTime = performance.now()
    
    try {
      devLogger.manager('CategoryDataManager: Initializing category system')
      
      // Try to load categories from storage first
      if (this.storageManager && await this.storageManager.has('categories')) {
        try {
          const storedCategories = await this.storageManager.get('categories')
          if (this.validateCategoriesData(storedCategories)) {
            this.categories = storedCategories
            devLogger.manager(`CategoryDataManager: Loaded ${this.categories.length} categories from storage`)
          } else {
            throw new Error('Invalid categories data in storage')
          }
        } catch (error) {
          trackManagerError('CategoryDataManager', 'loadFromStorage', error, { 
            fallback: true,
            context: 'Loading categories from storage'
          })
          devLogger.error('CategoryDataManager: Error loading from storage, using defaults', error)
          this.loadDefaultCategories()
        }
      } else {
        // Load default categories
        this.loadDefaultCategories()
      }
      
      // Build lookup maps for performance
      this.buildLookupMaps()
      
      // Update stats
      this.stats.totalCategories = this.categories.length
      this.stats.loadTime = performance.now() - startTime
      
      this.initialized = true
      
      devLogger.manager(`CategoryDataManager: Initialized with ${this.categories.length} categories in ${this.stats.loadTime.toFixed(2)}ms`)
      
      return true
    } catch (error) {
      trackManagerError('CategoryDataManager', 'init', error, { 
        critical: true, 
        fallback: true,
        context: 'Category system initialization'
      })
      devLogger.error('CategoryDataManager: Failed to initialize', error)
      
      // Graceful degradation: Ensure we have some categories even if initialization fails
      if (this.categories.length === 0) {
        gracefulDegradation.activateDegradation('category_data_missing', {
          reason: 'CategoryDataManager initialization failed',
          manager: 'CategoryDataManager'
        })
        
        // Try to use emergency categories from degradation system
        const fallbackCategories = gracefulDegradation.loadEmergencyCategories()
        if (fallbackCategories && fallbackCategories.length > 0) {
          this.categories = fallbackCategories
          devLogger.manager('CategoryDataManager: Using emergency categories from degradation system')
        } else {
          this.loadFallbackCategories()
        }
        
        this.buildLookupMaps()
      }
      
      this.initialized = true
      return false
    }
  }

  /**
   * Load default category set
   */
  loadDefaultCategories () {
    this.categories = [
      {
        id: 'animals',
        name: 'Animals',
        difficulty: 2,
        words: [
          'cat', 'dog', 'bird', 'fish', 'lion', 'tiger', 'elephant', 'monkey',
          'rabbit', 'horse', 'cow', 'pig', 'sheep', 'goat', 'duck', 'chicken',
          'bear', 'wolf', 'fox', 'deer', 'squirrel', 'mouse', 'rat', 'hamster'
        ],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'L', 'M', 'P', 'R', 'S', 'T', 'W'],
          tags: ['nature', 'living', 'common'],
          theme: 'Living creatures and pets',
          estimatedWords: 50,
          averageWordLength: 5
        }
      },
      {
        id: 'foods',
        name: 'Foods',
        difficulty: 1,
        words: [
          'apple', 'banana', 'bread', 'cheese', 'pizza', 'pasta', 'rice', 'chicken',
          'beef', 'fish', 'egg', 'milk', 'butter', 'sugar', 'salt', 'pepper',
          'tomato', 'potato', 'carrot', 'onion', 'garlic', 'lemon', 'orange', 'grape'
        ],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'E', 'F', 'G', 'L', 'M', 'O', 'P', 'R', 'S', 'T'],
          tags: ['daily', 'common', 'consumable'],
          theme: 'Food and beverages',
          estimatedWords: 75,
          averageWordLength: 6
        }
      },
      {
        id: 'colors',
        name: 'Colors',
        difficulty: 1,
        words: [
          'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
          'black', 'white', 'gray', 'violet', 'indigo', 'cyan', 'magenta', 'turquoise',
          'crimson', 'azure', 'emerald', 'gold', 'silver', 'bronze', 'maroon', 'navy'
        ],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'E', 'G', 'I', 'M', 'O', 'P', 'R', 'T', 'V', 'W', 'Y'],
          tags: ['visual', 'descriptive', 'art'],
          theme: 'Colors and shades',
          estimatedWords: 40,
          averageWordLength: 5
        }
      },
      {
        id: 'countries',
        name: 'Countries',
        difficulty: 3,
        words: [
          'america', 'canada', 'france', 'germany', 'italy', 'spain', 'japan', 'china',
          'india', 'brazil', 'australia', 'russia', 'mexico', 'egypt', 'greece', 'turkey',
          'sweden', 'norway', 'poland', 'ireland', 'portugal', 'argentina', 'chile', 'peru'
        ],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'E', 'F', 'G', 'I', 'J', 'M', 'P', 'R', 'S', 'T'],
          tags: ['geography', 'world', 'knowledge'],
          theme: 'Countries and nations',
          estimatedWords: 60,
          averageWordLength: 7
        }
      },
      {
        id: 'sports',
        name: 'Sports',
        difficulty: 2,
        words: [
          'football', 'basketball', 'baseball', 'tennis', 'golf', 'swimming', 'running', 'cycling',
          'soccer', 'hockey', 'boxing', 'wrestling', 'volleyball', 'badminton', 'cricket', 'rugby',
          'skiing', 'surfing', 'climbing', 'fishing', 'hiking', 'dancing', 'gymnastics', 'archery'
        ],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'F', 'G', 'H', 'R', 'S', 'T', 'V', 'W'],
          tags: ['activity', 'physical', 'competition'],
          theme: 'Sports and physical activities',
          estimatedWords: 45,
          averageWordLength: 7
        }
      },
      {
        id: 'professions',
        name: 'Professions',
        difficulty: 3,
        words: [
          'doctor', 'teacher', 'engineer', 'lawyer', 'nurse', 'pilot', 'chef', 'artist',
          'writer', 'musician', 'actor', 'dancer', 'photographer', 'designer', 'architect', 'scientist',
          'programmer', 'accountant', 'manager', 'salesperson', 'mechanic', 'electrician', 'plumber', 'carpenter'
        ],
        metadata: {
          letterCompatibility: ['A', 'C', 'D', 'E', 'L', 'M', 'N', 'P', 'S', 'T', 'W'],
          tags: ['work', 'career', 'society'],
          theme: 'Jobs and careers',
          estimatedWords: 55,
          averageWordLength: 8
        }
      },
      {
        id: 'technology',
        name: 'Technology',
        difficulty: 4,
        words: [
          'computer', 'phone', 'internet', 'software', 'hardware', 'website', 'application', 'database',
          'algorithm', 'programming', 'artificial', 'intelligence', 'robot', 'automation', 'digital', 'virtual',
          'blockchain', 'cryptocurrency', 'machine', 'learning', 'network', 'security', 'encryption', 'server'
        ],
        metadata: {
          letterCompatibility: ['A', 'C', 'D', 'H', 'I', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W'],
          tags: ['modern', 'complex', 'innovation'],
          theme: 'Technology and computing',
          estimatedWords: 35,
          averageWordLength: 9
        }
      },
      {
        id: 'nature',
        name: 'Nature',
        difficulty: 2,
        words: [
          'tree', 'flower', 'grass', 'mountain', 'river', 'ocean', 'forest', 'desert',
          'rain', 'snow', 'wind', 'storm', 'thunder', 'lightning', 'rainbow', 'sunset',
          'sunrise', 'cloud', 'star', 'moon', 'sun', 'earth', 'rock', 'stone'
        ],
        metadata: {
          letterCompatibility: ['C', 'F', 'G', 'M', 'N', 'O', 'R', 'S', 'T', 'W'],
          tags: ['environment', 'outdoor', 'natural'],
          theme: 'Natural world and weather',
          estimatedWords: 65,
          averageWordLength: 6
        }
      }
    ]
    
    devLogger.manager(`CategoryDataManager: Loaded ${this.categories.length} default categories`)
  }

  /**
   * Load minimal fallback categories for emergency use
   */
  loadFallbackCategories () {
    this.categories = [
      {
        id: 'basic',
        name: 'Basic Words',
        difficulty: 1,
        words: ['cat', 'dog', 'sun', 'moon', 'tree', 'car', 'book', 'home'],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'D', 'H', 'M', 'S', 'T'],
          tags: ['fallback'],
          theme: 'Emergency fallback category',
          estimatedWords: 8,
          averageWordLength: 4
        }
      }
    ]
    
    devLogger.warn('CategoryDataManager: Using fallback categories')
  }

  /**
   * Build lookup maps for improved performance
   */
  buildLookupMaps () {
    this.categoriesById.clear()
    this.difficultyLookup.clear()
    this.letterCompatibilityLookup.clear()
    
    for (const category of this.categories) {
      this.categoriesById.set(category.id, category)
      
      // Build difficulty lookup
      this.difficultyLookup.set(category.id, category.difficulty)
      
      // Build letter compatibility lookup
      if (category.metadata?.letterCompatibility) {
        for (const letter of category.metadata.letterCompatibility) {
          this.letterCompatibilityLookup.set(`${category.id}_${letter}`, category)
        }
      }
    }
    
    devLogger.manager(`CategoryDataManager: Built optimized lookup maps for ${this.categories.length} categories`)
  }

  /**
   * Build indexes asynchronously for non-critical performance
   */
  async buildIndexesAsync () {
    if (this.buildIndexesPromise) {
      return this.buildIndexesPromise
    }

    this.buildIndexesPromise = new Promise((resolve) => {
      // Use requestIdleCallback if available for non-blocking index building
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          this.buildLookupMaps()
          resolve()
        })
      } else {
        setTimeout(() => {
          this.buildLookupMaps()
          resolve()
        }, 0)
      }
    })

    return this.buildIndexesPromise
  }

  /**
   * Validate categories data structure
   */
  validateCategoriesData (categories) {
    if (!Array.isArray(categories)) {
      return false
    }
    
    for (const category of categories) {
      if (!category.id || !category.name || !category.difficulty || !Array.isArray(category.words) || !category.metadata) {
        return false
      }
      
      if (typeof category.difficulty !== 'number' || category.difficulty < 1 || category.difficulty > 5) {
        return false
      }
      
      if (!Array.isArray(category.metadata.letterCompatibility) || !Array.isArray(category.metadata.tags)) {
        return false
      }
    }
    
    return true
  }

  /**
   * Get category by ID (optimized lookup)
   */
  getCategoryById (id) {
    if (!id || typeof id !== 'string') {
      return null
    }
    
    this.updateAccessStats()
    return this.categoriesById.get(id) || null
  }

  /**
   * Get all categories
   */
  getAllCategories () {
    this.updateAccessStats()
    return [...this.categories] // Return copy to prevent mutation
  }

  /**
   * Get random category
   */
  getRandomCategory () {
    if (this.categories.length === 0) {
      return null
    }
    
    this.updateAccessStats()
    const randomIndex = Math.floor(Math.random() * this.categories.length)
    return this.categories[randomIndex]
  }

  /**
   * Get categories by difficulty level (cached)
   */
  getCategoriesByDifficulty (difficulty) {
    if (typeof difficulty !== 'number') {
      return []
    }
    
    // Check cache first
    const cached = this.cache.getCategoriesByDifficulty(difficulty)
    if (cached) {
      this.updateAccessStats()
      return cached
    }
    
    // Compute and cache result
    const result = this.categories.filter(category => category.difficulty === difficulty)
    this.cache.setCategoriesByDifficulty(difficulty, result)
    
    this.updateAccessStats()
    return result
  }

  /**
   * Get categories by difficulty range
   */
  getCategoriesByDifficultyRange (minDifficulty, maxDifficulty) {
    if (typeof minDifficulty !== 'number' || typeof maxDifficulty !== 'number') {
      return []
    }
    
    this.updateAccessStats()
    return this.categories.filter(category => 
      category.difficulty >= minDifficulty && category.difficulty <= maxDifficulty
    )
  }

  /**
   * Get categories compatible with a specific letter (cached)
   */
  getCategoriesByLetter (letter) {
    if (!letter || typeof letter !== 'string') {
      return []
    }

    const upperLetter = letter.toUpperCase()
    
    // Check cache first
    const cached = this.cache.getCompatibleCategories(upperLetter)
    if (cached) {
      this.updateAccessStats()
      return cached
    }
    
    // Compute and cache result
    const result = this.categories.filter(category =>
      category.metadata.letterCompatibility.includes(upperLetter)
    )
    this.cache.setCompatibleCategories(upperLetter, result)
    
    this.updateAccessStats()
    return result
  }

  /**
   * Get categories by tag
   */
  getCategoriesByTag (tag) {
    if (!tag || typeof tag !== 'string') {
      return []
    }
    
    this.updateAccessStats()
    return this.categories.filter(category =>
      category.metadata.tags.includes(tag.toLowerCase())
    )
  }

  /**
   * Search categories by name (case-insensitive)
   */
  searchCategories (searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return []
    }
    
    const term = searchTerm.toLowerCase().trim()
    if (term.length === 0) {
      return []
    }
    
    this.updateAccessStats()
    return this.categories.filter(category =>
      category.name.toLowerCase().includes(term)
    )
  }

  /**
   * Get performance statistics
   */
  getStats () {
    return {
      ...this.stats,
      initialized: this.initialized
    }
  }

  /**
   * Update access statistics for performance monitoring
   */
  updateAccessStats () {
    this.stats.lastAccess = Date.now()
  }

  /**
   * Save current categories to storage
   */
  async saveCategories () {
    if (!this.storageManager) {
      return false
    }
    
    try {
      await this.storageManager.set('categories', this.categories)
      devLogger.manager('CategoryDataManager: Categories saved to storage')
      return true
    } catch (error) {
      trackManagerError('CategoryDataManager', 'saveCategories', error, { 
        context: 'Saving categories to storage'
      })
      devLogger.error('CategoryDataManager: Failed to save categories', error)
      
      // Activate storage degradation if not already active
      if (!gracefulDegradation.isDegradationActive('storage_unavailable')) {
        gracefulDegradation.activateDegradation('storage_unavailable', {
          reason: 'Failed to save categories to storage',
          manager: 'CategoryDataManager'
        })
      }
      
      return false
    }
  }

  /**
   * Clear all categories (use with caution)
   */
  clear () {
    this.categories = []
    this.categoriesById.clear()
    this.difficultyLookup.clear()
    this.letterCompatibilityLookup.clear()
    this.cache.clear()
    this.stats.totalCategories = 0
    
    devLogger.manager('CategoryDataManager: Cleared all categories and caches')
  }

  /**
   * Cleanup method for resource management
   */
  cleanup () {
    if (this.cache) {
      this.cache.destroy()
    }
    this.clear()
    
    // Cancel any pending async operations
    this.lazyLoadPromise = null
    this.buildIndexesPromise = null
    
    devLogger.manager('CategoryDataManager: Cleanup completed')
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy () {
    this.clear()
    this.storageManager = null
    this.initialized = false
    
    devLogger.manager('CategoryDataManager: Destroyed')
  }
}