import { devLogger } from '@/utils/devTools.js'

// Word difficulty levels
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
}

// Scoring multipliers based on word characteristics
export const SCORING = {
  BASE_POINTS: 10,
  LENGTH_MULTIPLIER: 2,
  DIFFICULTY_MULTIPLIER: {
    [DIFFICULTY_LEVELS.EASY]: 1,
    [DIFFICULTY_LEVELS.MEDIUM]: 1.5,
    [DIFFICULTY_LEVELS.HARD]: 2
  },
  UNCOMMON_WORD_BONUS: 50,
  PERFECT_CATEGORY_BONUS: 100
}

export class WordDataManager {
  constructor (storageManager = null) {
    this.storageManager = storageManager
    this.wordDatabase = new Map()
    this.categories = []
    this.commonWords = new Set()
    this.uncommonWords = new Set()
    this.wordStats = new Map()
    
    // Performance optimization for word lookup
    this.wordLookupCache = new Map()
    this.maxCacheSize = 1000
    
    this.init()
  }
  
  async init () {
    devLogger.storage('WordDataManager: Initializing')
    
    // Load categories and word data
    await this.loadCategories()
    await this.loadWordDatabase()
    
    devLogger.storage(`WordDataManager: Initialized with ${this.categories.length} categories`)
  }
  
  async loadCategories () {
    try {
      // Try to load from cache first
      if (this.storageManager) {
        const cachedCategories = await this.storageManager.load('categories')
        if (cachedCategories) {
          this.categories = cachedCategories
          devLogger.storage('WordDataManager: Loaded categories from cache')
          return
        }
      }
      
      // Load default categories or from API
      await this.loadDefaultCategories()
      
      // Cache the categories
      if (this.storageManager) {
        await this.storageManager.save('categories', this.categories)
      }
      
    } catch (error) {
      console.error('WordDataManager: Failed to load categories:', error)
      await this.loadDefaultCategories()
    }
  }
  
  async loadDefaultCategories () {
    // Default categories with difficulty levels
    this.categories = [
      {
        id: 'animals',
        name: 'Animals',
        difficulty: DIFFICULTY_LEVELS.EASY,
        description: 'Living creatures and pets',
        icon: '🐾',
        estimatedWords: 50
      },
      {
        id: 'foods',
        name: 'Foods',
        difficulty: DIFFICULTY_LEVELS.EASY,
        description: 'Things you can eat and drink',
        icon: '🍎',
        estimatedWords: 45
      },
      {
        id: 'colors',
        name: 'Colors',
        difficulty: DIFFICULTY_LEVELS.EASY,
        description: 'Different colors and shades',
        icon: '🌈',
        estimatedWords: 30
      },
      {
        id: 'countries',
        name: 'Countries',
        difficulty: DIFFICULTY_LEVELS.MEDIUM,
        description: 'Nations and territories',
        icon: '🌍',
        estimatedWords: 195
      },
      {
        id: 'sports',
        name: 'Sports',
        difficulty: DIFFICULTY_LEVELS.MEDIUM,
        description: 'Games and physical activities',
        icon: '⚽',
        estimatedWords: 40
      },
      {
        id: 'science',
        name: 'Science',
        difficulty: DIFFICULTY_LEVELS.HARD,
        description: 'Scientific terms and concepts',
        icon: '🔬',
        estimatedWords: 60
      },
      {
        id: 'technology',
        name: 'Technology',
        difficulty: DIFFICULTY_LEVELS.HARD,
        description: 'Computing and tech terms',
        icon: '💻',
        estimatedWords: 55
      }
    ]
    
    devLogger.storage('WordDataManager: Loaded default categories')
  }
  
  async loadWordDatabase () {
    try {
      // Try to load from cache first
      if (this.storageManager) {
        const cachedWords = await this.storageManager.loadWordCache('all_words')
        if (cachedWords) {
          this.deserializeWordDatabase(cachedWords)
          devLogger.storage('WordDataManager: Loaded word database from cache')
          return
        }
      }
      
      // Load default word data
      await this.loadDefaultWordData()
      
      // Cache the word database
      if (this.storageManager) {
        const serializedData = this.serializeWordDatabase()
        await this.storageManager.saveWordCache('all_words', serializedData)
      }
      
    } catch (error) {
      console.error('WordDataManager: Failed to load word database:', error)
      await this.loadDefaultWordData()
    }
  }
  
  async loadDefaultWordData () {
    // Default word data for each category
    const defaultWords = {
      animals: {
        easy: ['cat', 'dog', 'bird', 'fish', 'cow', 'pig', 'duck', 'frog'],
        medium: ['elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo', 'tiger'],
        hard: ['platypus', 'aardvark', 'chameleon', 'orangutan', 'rhinoceros']
      },
      foods: {
        easy: ['apple', 'bread', 'milk', 'egg', 'rice', 'meat', 'soup', 'cake'],
        medium: ['pizza', 'pasta', 'salad', 'cheese', 'yogurt', 'chicken'],
        hard: ['quinoa', 'artichoke', 'prosciutto', 'baguette', 'croissant']
      },
      colors: {
        easy: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'brown'],
        medium: ['purple', 'orange', 'gray', 'silver', 'gold', 'beige'],
        hard: ['turquoise', 'magenta', 'chartreuse', 'vermillion', 'ochre']
      },
      countries: {
        easy: ['usa', 'china', 'japan', 'france', 'italy', 'spain', 'brazil'],
        medium: ['australia', 'germany', 'mexico', 'canada', 'russia'],
        hard: ['kazakhstan', 'madagascar', 'uzbekistan', 'montenegro']
      },
      sports: {
        easy: ['soccer', 'tennis', 'golf', 'boxing', 'running', 'swimming'],
        medium: ['basketball', 'football', 'baseball', 'hockey', 'cycling'],
        hard: ['badminton', 'volleyball', 'wrestling', 'gymnastics']
      },
      science: {
        easy: ['atom', 'cell', 'dna', 'gene', 'star', 'planet', 'energy'],
        medium: ['molecule', 'gravity', 'photon', 'neutron', 'enzyme'],
        hard: ['chromosome', 'mitochondria', 'photosynthesis', 'thermodynamics']
      },
      technology: {
        easy: ['computer', 'phone', 'internet', 'email', 'website', 'app'],
        medium: ['software', 'hardware', 'database', 'network', 'server'],
        hard: ['algorithm', 'cryptocurrency', 'blockchain', 'artificial intelligence']
      }
    }
    
    // Process and store word data
    for (const [categoryId, difficultyWords] of Object.entries(defaultWords)) {
      const categoryWords = []
      
      for (const [difficulty, words] of Object.entries(difficultyWords)) {
        for (const word of words) {
          const wordData = {
            word: word.toLowerCase(),
            difficulty,
            category: categoryId,
            length: word.length,
            commonality: this.determineCommonality(word),
            points: this.calculateBasePoints(word, difficulty)
          }
          
          categoryWords.push(wordData)
          
          // Track word statistics
          this.wordStats.set(word.toLowerCase(), wordData)
          
          // Categorize by commonality
          if (wordData.commonality === 'common') {
            this.commonWords.add(word.toLowerCase())
          } else {
            this.uncommonWords.add(word.toLowerCase())
          }
        }
      }
      
      this.wordDatabase.set(categoryId, categoryWords)
    }
    
    devLogger.storage(`WordDataManager: Loaded default word data for ${Object.keys(defaultWords).length} categories`)
  }
  
  determineCommonality (word) {
    // Simple heuristic - in a real app this would use frequency data
    const commonWords = [
      'cat', 'dog', 'red', 'blue', 'apple', 'bread', 'car', 'house',
      'run', 'walk', 'eat', 'drink', 'good', 'bad', 'big', 'small'
    ]
    
    return commonWords.includes(word.toLowerCase()) ? 'common' : 'uncommon'
  }
  
  calculateBasePoints (word, difficulty) {
    const length = word.length
    const difficultyMultiplier = SCORING.DIFFICULTY_MULTIPLIER[difficulty] || 1
    
    return Math.floor(SCORING.BASE_POINTS + (length * SCORING.LENGTH_MULTIPLIER) * difficultyMultiplier)
  }
  
  // Validate if a word belongs to a category
  validateWord (word, categoryId) {
    if (!word || typeof word !== 'string' || word.length < 2) {
      return false
    }
    
    const normalizedWord = word.toLowerCase().trim()
    
    // Check cache first
    const cacheKey = `${normalizedWord}:${categoryId}`
    if (this.wordLookupCache.has(cacheKey)) {
      return this.wordLookupCache.get(cacheKey)
    }
    
    // Check if word exists in category
    const categoryWords = this.wordDatabase.get(categoryId)
    if (!categoryWords) {
      this.addToCache(cacheKey, false)
      return false
    }
    
    const isValid = categoryWords.some(wordData => wordData.word === normalizedWord)
    
    // Cache the result
    this.addToCache(cacheKey, isValid)
    
    return isValid
  }
  
  // Get word data for scoring
  getWordData (word, categoryId) {
    const normalizedWord = word.toLowerCase().trim()
    return this.wordStats.get(normalizedWord) || null
  }
  
  // Calculate score for a word
  calculateWordScore (word, categoryId) {
    const wordData = this.getWordData(word, categoryId)
    if (!wordData) {
      return 0
    }
    
    let score = wordData.points
    
    // Bonus for uncommon words
    if (wordData.commonality === 'uncommon') {
      score += SCORING.UNCOMMON_WORD_BONUS
    }
    
    return score
  }
  
  // Get all words for a category (for development/testing)
  getCategoryWords (categoryId) {
    const categoryWords = this.wordDatabase.get(categoryId)
    if (!categoryWords) {
      return []
    }
    
    return categoryWords.map(wordData => wordData.word)
  }
  
  // Get category information
  getCategory (categoryId) {
    return this.categories.find(cat => cat.id === categoryId) || null
  }
  
  // Get all categories
  getAllCategories () {
    return [...this.categories]
  }
  
  // Get categories by difficulty
  getCategoriesByDifficulty (difficulty) {
    return this.categories.filter(cat => cat.difficulty === difficulty)
  }
  
  // Get random category
  getRandomCategory (difficulty = null) {
    let availableCategories = this.categories
    
    if (difficulty) {
      availableCategories = this.getCategoriesByDifficulty(difficulty)
    }
    
    if (availableCategories.length === 0) {
      return null
    }
    
    const randomIndex = Math.floor(Math.random() * availableCategories.length)
    return availableCategories[randomIndex]
  }
  
  // Get word hints for a category (for development)
  getCategoryHints (categoryId, count = 5) {
    const categoryWords = this.getCategoryWords(categoryId)
    
    if (categoryWords.length === 0) {
      return []
    }
    
    // Return random sample of words as hints
    const shuffled = [...categoryWords].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }
  
  // Performance optimization methods
  addToCache (key, value) {
    if (this.wordLookupCache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.wordLookupCache.keys().next().value
      this.wordLookupCache.delete(firstKey)
    }
    
    this.wordLookupCache.set(key, value)
  }
  
  clearCache () {
    this.wordLookupCache.clear()
    devLogger.storage('WordDataManager: Cache cleared')
  }
  
  // Serialization for storage
  serializeWordDatabase () {
    const serialized = {}
    
    for (const [categoryId, words] of this.wordDatabase.entries()) {
      serialized[categoryId] = words
    }
    
    return {
      wordDatabase: serialized,
      categories: this.categories,
      timestamp: Date.now(),
      version: 1
    }
  }
  
  deserializeWordDatabase (data) {
    if (!data || !data.wordDatabase) {
      return false
    }
    
    this.wordDatabase.clear()
    this.wordStats.clear()
    this.commonWords.clear()
    this.uncommonWords.clear()
    
    for (const [categoryId, words] of Object.entries(data.wordDatabase)) {
      this.wordDatabase.set(categoryId, words)
      
      // Rebuild stats and commonality sets
      for (const wordData of words) {
        this.wordStats.set(wordData.word, wordData)
        
        if (wordData.commonality === 'common') {
          this.commonWords.add(wordData.word)
        } else {
          this.uncommonWords.add(wordData.word)
        }
      }
    }
    
    if (data.categories) {
      this.categories = data.categories
    }
    
    return true
  }
  
  // Add new words (for future expansion)
  async addWordToCategory (categoryId, word, difficulty = DIFFICULTY_LEVELS.MEDIUM) {
    const normalizedWord = word.toLowerCase().trim()
    
    if (!this.wordDatabase.has(categoryId)) {
      console.error(`WordDataManager: Category "${categoryId}" not found`)
      return false
    }
    
    const wordData = {
      word: normalizedWord,
      difficulty,
      category: categoryId,
      length: normalizedWord.length,
      commonality: this.determineCommonality(normalizedWord),
      points: this.calculateBasePoints(normalizedWord, difficulty)
    }
    
    const categoryWords = this.wordDatabase.get(categoryId)
    
    // Check if word already exists
    if (categoryWords.some(w => w.word === normalizedWord)) {
      devLogger.storage(`WordDataManager: Word "${normalizedWord}" already exists in category "${categoryId}"`)
      return false
    }
    
    categoryWords.push(wordData)
    this.wordStats.set(normalizedWord, wordData)
    
    // Update commonality sets
    if (wordData.commonality === 'common') {
      this.commonWords.add(normalizedWord)
    } else {
      this.uncommonWords.add(normalizedWord)
    }
    
    // Clear cache to ensure fresh lookups
    this.clearCache()
    
    // Save to storage if available
    if (this.storageManager) {
      const serializedData = this.serializeWordDatabase()
      await this.storageManager.saveWordCache('all_words', serializedData)
    }
    
    devLogger.storage(`WordDataManager: Added word "${normalizedWord}" to category "${categoryId}"`)
    return true
  }
  
  // Get statistics
  getStatistics () {
    return {
      totalCategories: this.categories.length,
      totalWords: this.wordStats.size,
      commonWords: this.commonWords.size,
      uncommonWords: this.uncommonWords.size,
      cacheSize: this.wordLookupCache.size,
      categoriesBreakdown: this.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        wordCount: this.wordDatabase.get(cat.id)?.length || 0,
        difficulty: cat.difficulty
      }))
    }
  }
  
  // Debug information
  getDebugInfo () {
    return {
      ...this.getStatistics(),
      wordDatabaseKeys: Array.from(this.wordDatabase.keys()),
      cacheHitRate: this.wordLookupCache.size / this.maxCacheSize
    }
  }
}