import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'
import { gracefulDegradation } from '@/utils/GracefulDegradation.js'
import { CategoryDataManager } from './CategoryDataManager.js'
import { LetterGenerator } from './LetterGenerator.js'
import { CombinationGenerator } from './CombinationGenerator.js'

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
    
    // New category generation system integration
    this.categoryDataManager = null
    this.letterGenerator = null
    this.combinationGenerator = null
    this.generationSystemEnabled = false
    
    this.init()
  }
  
  async init () {
    devLogger.storage('WordDataManager: Initializing')
    
    // Load categories and word data
    await this.loadCategories()
    await this.loadWordDatabase()
    
    // Initialize new category generation system
    await this.initCategoryGenerationSystem()
    
    devLogger.storage(`WordDataManager: Initialized with ${this.categories.length} categories`)
  }

  /**
   * Initialize the new category generation system
   */
  async initCategoryGenerationSystem () {
    try {
      devLogger.storage('WordDataManager: Initializing category generation system')
      
      // Initialize CategoryDataManager
      this.categoryDataManager = new CategoryDataManager(this.storageManager)
      const categoryInit = await this.categoryDataManager.init()
      
      if (!categoryInit) {
        throw new Error('CategoryDataManager initialization failed')
      }
      
      // Initialize LetterGenerator
      this.letterGenerator = new LetterGenerator(this.categoryDataManager)
      const letterInit = await this.letterGenerator.init()
      
      if (!letterInit) {
        throw new Error('LetterGenerator initialization failed')
      }
      
      // Initialize CombinationGenerator
      this.combinationGenerator = new CombinationGenerator(this.categoryDataManager, this.letterGenerator)
      const combinationInit = await this.combinationGenerator.init()
      
      if (!combinationInit) {
        throw new Error('CombinationGenerator initialization failed')
      }
      
      // Verify all components are properly initialized
      if (!this.categoryDataManager.initialized || 
          !this.letterGenerator.initialized || 
          !this.combinationGenerator.initialized) {
        throw new Error('One or more generation system components failed to initialize')
      }
      
      this.generationSystemEnabled = true
      
      devLogger.storage('WordDataManager: Category generation system initialized successfully')
      
      return true
    } catch (error) {
      trackManagerError('WordDataManager', 'initCategoryGenerationSystem', error, { 
        fallback: true,
        context: 'Category generation system initialization'
      })
      devLogger.error('WordDataManager: Failed to initialize category generation system', error)
      
      // Clean up partially initialized components
      this.categoryDataManager = null
      this.letterGenerator = null
      this.combinationGenerator = null
      
      // Activate generation system degradation
      gracefulDegradation.activateDegradation('generation_system_failed', {
        reason: 'Category generation system initialization failed',
        manager: 'WordDataManager'
      })
      
      this.generationSystemEnabled = false
      return false
    }
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
      trackManagerError('WordDataManager', 'loadCategories', error, { 
        fallback: true,
        context: 'Loading word categories'
      })
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
      trackManagerError('WordDataManager', 'loadWordDatabase', error, { 
        fallback: true,
        context: 'Loading word database'
      })
      console.error('WordDataManager: Failed to load word database:', error)
      
      // Activate word data degradation
      if (this.wordStats.size === 0) {
        gracefulDegradation.activateDegradation('word_data_missing', {
          reason: 'Failed to load word database',
          manager: 'WordDataManager'
        })
      }
      
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
    try {
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
        try {
          const serializedData = this.serializeWordDatabase()
          await this.storageManager.saveWordCache('all_words', serializedData)
        } catch (storageError) {
          trackManagerError('WordDataManager', 'addWordToCategory', storageError, {
            context: 'Saving word data to storage'
          })
          
          // Activate storage degradation if not already active
          if (!gracefulDegradation.isDegradationActive('storage_unavailable')) {
            gracefulDegradation.activateDegradation('storage_unavailable', {
              reason: 'Failed to save word data to storage',
              manager: 'WordDataManager'
            })
          }
          
          // Continue without storage - word is still added to memory
        }
      }
      
      devLogger.storage(`WordDataManager: Added word "${normalizedWord}" to category "${categoryId}"`)
      return true
    } catch (error) {
      trackManagerError('WordDataManager', 'addWordToCategory', error, {
        context: `Adding word "${word}" to category "${categoryId}"`
      })
      return false
    }
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
      cacheHitRate: this.wordLookupCache.size / this.maxCacheSize,
      generationSystemEnabled: this.generationSystemEnabled,
      generationSystemStats: this.generationSystemEnabled ? {
        categoryManager: this.categoryDataManager?.getStats(),
        letterGenerator: this.letterGenerator?.getStats(),
        combinationGenerator: this.combinationGenerator?.getStats()
      } : null
    }
  }

  // ==========================================
  // NEW CATEGORY GENERATION SYSTEM API
  // ==========================================

  /**
   * Generate a category-letter combination for a new round
   */
  generateRound (roundType = 'default', options = {}) {
    // Check if graceful degradation is active for generation system
    if (gracefulDegradation.isDegradationActive('generation_system_failed')) {
      const basicGeneration = gracefulDegradation.enableBasicGeneration()
      return basicGeneration.generateBasicRound()
    }
    
    if (!this.generationSystemEnabled || !this.combinationGenerator) {
      // Activate degradation and use emergency generation
      gracefulDegradation.activateDegradation('generation_system_failed', {
        reason: 'Generation system not available',
        manager: 'WordDataManager'
      })
      
      const basicGeneration = gracefulDegradation.enableBasicGeneration()
      return basicGeneration.generateBasicRound()
    }

    try {
      const combination = this.combinationGenerator.generateCombination(roundType, options)
      
      // Convert to format compatible with existing game systems
      return {
        category: this.mapNewCategoryToLegacy(combination.category),
        letter: combination.letter,
        difficulty: combination.difficulty,
        playability: combination.playability,
        roundConfig: combination.roundConfig,
        metadata: {
          generationType: 'advanced',
          generatedAt: combination.generatedAt,
          attempts: combination.attempts
        }
      }
    } catch (error) {
      trackManagerError('WordDataManager', 'generateRound', error, {
        fallback: true,
        context: 'Advanced round generation failed'
      })
      devLogger.error('WordDataManager: Failed to generate round, falling back to emergency', error)
      
      // Activate degradation and use emergency generation
      gracefulDegradation.activateDegradation('generation_system_failed', {
        reason: 'Round generation failed',
        manager: 'WordDataManager'
      })
      
      const basicGeneration = gracefulDegradation.enableBasicGeneration()
      return basicGeneration.generateBasicRound() || this.generateLegacyRound(roundType)
    }
  }

  /**
   * Generate multiple rounds for batch processing
   */
  generateRounds (count = 3, roundType = 'default', options = {}) {
    if (!this.generationSystemEnabled || !this.combinationGenerator) {
      return Array.from({ length: count }, () => this.generateLegacyRound(roundType))
    }

    try {
      const combinations = this.combinationGenerator.generateBatch(count, roundType, options)
      
      if (!combinations || combinations.length === 0) {
        return Array.from({ length: count }, () => this.generateLegacyRound(roundType))
      }
      
      // Ensure we have the requested number of rounds
      const rounds = combinations.slice(0, count).map(combination => ({
        category: this.mapNewCategoryToLegacy(combination.category),
        letter: combination.letter,
        difficulty: combination.difficulty,
        playability: combination.playability,
        roundConfig: combination.roundConfig,
        metadata: {
          generationType: 'advanced',
          generatedAt: combination.generatedAt,
          attempts: combination.attempts
        }
      }))
      
      // Fill remaining slots with legacy rounds if needed
      while (rounds.length < count) {
        rounds.push(this.generateLegacyRound(roundType))
      }
      
      return rounds
    } catch (error) {
      trackManagerError('WordDataManager', 'generateRounds', error, {
        fallback: true,
        context: 'Batch round generation failed'
      })
      devLogger.error('WordDataManager: Failed to generate rounds, falling back to legacy', error)
      return Array.from({ length: count }, () => this.generateLegacyRound(roundType))
    }
  }

  /**
   * Get available round configurations
   */
  getRoundConfigurations () {
    if (!this.generationSystemEnabled || !this.combinationGenerator) {
      return this.getLegacyRoundConfigurations()
    }

    return this.combinationGenerator.getRoundConfigurations()
  }

  /**
   * Get specific round configuration
   */
  getRoundConfiguration (roundType) {
    if (!this.generationSystemEnabled || !this.combinationGenerator) {
      return this.getLegacyRoundConfiguration(roundType)
    }

    return this.combinationGenerator.getRoundConfig(roundType)
  }

  /**
   * Validate a word with enhanced category-letter context
   */
  validateWordWithContext (word, categoryId, letter = null, context = {}) {
    // First, use the original validation
    const isValidOriginal = this.validateWord(word, categoryId)
    
    if (!isValidOriginal) {
      return {
        valid: false,
        reason: 'Word not found in category',
        score: 0,
        metadata: { validationType: 'legacy' }
      }
    }

    // Enhanced validation with new system
    if (this.generationSystemEnabled && letter && this.categoryDataManager) {
      const category = this.categoryDataManager.getCategoryById(categoryId)
      
      if (category && letter) {
        // Check if word starts with the specified letter
        const startsWithLetter = word.toLowerCase().startsWith(letter.toLowerCase())
        
        if (!startsWithLetter) {
          return {
            valid: false,
            reason: `Word must start with letter '${letter.toUpperCase()}'`,
            score: 0,
            metadata: { validationType: 'enhanced', expectedLetter: letter }
          }
        }
      }
    }

    // Calculate enhanced score
    const baseScore = this.calculateWordScore(word, categoryId)
    const enhancedScore = this.calculateEnhancedScore(word, categoryId, letter, context)

    return {
      valid: true,
      reason: 'Valid word',
      score: enhancedScore || baseScore,
      metadata: { 
        validationType: this.generationSystemEnabled ? 'enhanced' : 'legacy',
        baseScore,
        enhancedScore,
        letter
      }
    }
  }

  /**
   * Calculate enhanced score using new system data
   */
  calculateEnhancedScore (word, categoryId, letter = null, context = {}) {
    const baseScore = this.calculateWordScore(word, categoryId)
    
    if (!this.generationSystemEnabled || !this.letterGenerator || !letter) {
      return baseScore
    }

    try {
      let enhancedScore = baseScore
      
      // Letter rarity bonus
      const letterRarity = this.letterGenerator.getLetterRarityScore(letter)
      if (letterRarity >= 7) {
        enhancedScore += SCORING.UNCOMMON_WORD_BONUS * 0.5 // Rare letter bonus
      }
      
      // Word length bonus for harder letters
      if (letterRarity >= 5 && word.length >= 6) {
        enhancedScore += word.length * 2
      }
      
      // Vowel starting bonus (vowels are often harder to use)
      if (this.letterGenerator.isVowel(letter) && word.length >= 5) {
        enhancedScore += 10
      }
      
      // Round difficulty context bonus
      if (context.roundDifficulty >= 4) {
        enhancedScore *= 1.2
      }
      
      return Math.round(enhancedScore)
    } catch (error) {
      devLogger.error('WordDataManager: Enhanced scoring failed', error)
      return baseScore
    }
  }

  /**
   * Get word suggestions for a category-letter combination
   */
  getWordHints (categoryId, letter = null, count = 3) {
    const categoryWords = this.getCategoryWords(categoryId)
    
    if (!categoryWords || categoryWords.length === 0) {
      return []
    }
    
    let availableWords = categoryWords
    
    // Filter by letter if specified
    if (letter) {
      availableWords = categoryWords.filter(word => 
        word.toLowerCase().startsWith(letter.toLowerCase())
      )
    }
    
    if (availableWords.length === 0) {
      return []
    }
    
    // Return random sample, prioritizing shorter/easier words for hints
    const sortedWords = availableWords.sort((a, b) => a.length - b.length)
    const hints = []
    
    for (let i = 0; i < Math.min(count, sortedWords.length); i++) {
      const randomIndex = Math.floor(Math.random() * Math.min(5, sortedWords.length))
      const word = sortedWords[randomIndex]
      
      if (!hints.includes(word)) {
        hints.push(word)
      }
    }
    
    return hints
  }

  /**
   * Get advanced statistics including generation system data
   */
  getAdvancedStatistics () {
    const baseStats = this.getStatistics()
    const degradationStatus = gracefulDegradation.getStatus()
    
    if (!this.generationSystemEnabled) {
      return {
        ...baseStats,
        generationSystem: {
          enabled: false,
          reason: 'Generation system not initialized'
        },
        degradation: degradationStatus
      }
    }
    
    return {
      ...baseStats,
      generationSystem: {
        enabled: true,
        categoryManager: this.categoryDataManager?.getStats(),
        letterGenerator: this.letterGenerator?.getStats(),
        combinationGenerator: this.combinationGenerator?.getStats()
      },
      degradation: degradationStatus
    }
  }

  /**
   * Check system health and attempt recovery if needed
   */
  async performHealthCheck () {
    const healthResults = gracefulDegradation.runHealthChecks()
    const status = gracefulDegradation.getStatus()
    
    // Attempt recovery for active degradations
    if (status.canRecover) {
      const recoveryResults = await gracefulDegradation.attemptFullRecovery()
      
      devLogger.info('WordDataManager: Health check completed', {
        health: healthResults,
        degradationLevel: status.level,
        activeDegradations: status.activeDegradations,
        recoveryAttempts: recoveryResults
      })
      
      return {
        health: healthResults,
        degradation: gracefulDegradation.getStatus(),
        recovery: recoveryResults
      }
    }
    
    return {
      health: healthResults,
      degradation: status,
      recovery: null
    }
  }

  /**
   * Get user-friendly status message about system health
   */
  getSystemStatus () {
    const status = gracefulDegradation.getStatus()
    
    if (status.level === 0) {
      return {
        status: 'healthy',
        message: 'All systems operating normally',
        userMessages: [],
        canRecover: false
      }
    }
    
    const levelDescriptions = {
      1: 'Minor issues detected',
      2: 'Some features may be limited',
      3: 'Significant functionality reduced'
    }
    
    return {
      status: status.level >= 3 ? 'degraded' : 'warning',
      message: levelDescriptions[status.level] || 'System status unknown',
      userMessages: status.userMessages || [],
      canRecover: status.canRecover || false
    }
  }

  // ==========================================
  // UNIFIED DATA ACCESS LAYER
  // ==========================================

  /**
   * Get unified category data combining both legacy and new systems
   */
  getUnifiedCategoryData () {
    const legacyCategories = this.getAllCategories()
    const newCategories = this.categoryDataManager?.getAllCategories() || []
    
    // Merge and deduplicate categories
    const categoryMap = new Map()
    
    // Add legacy categories first
    legacyCategories.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        source: 'legacy',
        wordCount: this.getCategoryWords(cat.id).length
      })
    })
    
    // Add/update with new system data
    newCategories.forEach(cat => {
      const existing = categoryMap.get(cat.id)
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        difficulty: this.mapNumericDifficultyToLegacy(cat.difficulty),
        description: cat.metadata?.theme || existing?.description || `${cat.name} category`,
        icon: this.getCategoryIcon(cat.id),
        estimatedWords: cat.metadata?.estimatedWords || existing?.estimatedWords || 20,
        words: cat.words || existing?.words || [],
        metadata: cat.metadata,
        source: existing ? 'merged' : 'new',
        wordCount: cat.words?.length || existing?.wordCount || 0,
        letterCompatibility: cat.metadata?.letterCompatibility || [],
        tags: cat.metadata?.tags || []
      })
    })
    
    return Array.from(categoryMap.values())
  }

  /**
   * Get comprehensive word data for a category from all sources
   */
  getUnifiedCategoryWords (categoryId) {
    const legacyWords = this.getCategoryWords(categoryId)
    const newCategoryData = this.categoryDataManager?.getCategoryById(categoryId)
    const newWords = newCategoryData?.words || []
    
    // Combine and deduplicate words
    const wordSet = new Set([...legacyWords, ...newWords])
    const words = Array.from(wordSet)
    
    return {
      words,
      count: words.length,
      sources: {
        legacy: legacyWords.length,
        new: newWords.length,
        total: words.length
      },
      metadata: newCategoryData?.metadata || null
    }
  }

  /**
   * Validate word using unified validation across all systems
   */
  validateWordUnified (word, categoryId, letter = null, context = {}) {
    // Primary validation using enhanced system
    if (this.generationSystemEnabled) {
      return this.validateWordWithContext(word, categoryId, letter, context)
    }
    
    // Fallback to legacy validation
    const isValid = this.validateWord(word, categoryId)
    const score = isValid ? this.calculateWordScore(word, categoryId) : 0
    
    return {
      valid: isValid,
      reason: isValid ? 'Valid word' : 'Word not found in category',
      score,
      metadata: {
        validationType: 'legacy',
        fallback: true
      }
    }
  }

  /**
   * Generate round using unified system with automatic fallback
   */
  generateUnifiedRound (roundType = 'default', options = {}) {
    try {
      // Attempt advanced generation first
      if (this.generationSystemEnabled && !gracefulDegradation.isDegradationActive('generation_system_failed')) {
        return this.generateRound(roundType, options)
      }
      
      // Fallback to emergency generation
      const basicGeneration = gracefulDegradation.enableBasicGeneration()
      const emergencyRound = basicGeneration.generateBasicRound()
      
      if (emergencyRound) {
        return emergencyRound
      }
      
      // Final fallback to legacy generation
      return this.generateLegacyRound(roundType)
    } catch (error) {
      trackManagerError('WordDataManager', 'generateUnifiedRound', error, {
        fallback: true,
        context: 'Unified round generation failed'
      })
      
      // Absolute fallback
      return this.generateLegacyRound(roundType)
    }
  }

  /**
   * Get cross-system performance metrics
   */
  getUnifiedPerformanceMetrics () {
    const baseStats = this.getStatistics()
    const degradationStatus = gracefulDegradation.getStatus()
    
    const metrics = {
      initialization: {
        generationSystemEnabled: this.generationSystemEnabled,
        degradationLevel: degradationStatus.level,
        activeDegradations: degradationStatus.activeDegradations
      },
      
      data: {
        categories: {
          legacy: this.categories.length,
          new: this.categoryDataManager?.getStats()?.totalCategories || 0,
          unified: this.getUnifiedCategoryData().length
        },
        words: {
          total: baseStats.totalWords,
          common: baseStats.commonWords,
          uncommon: baseStats.uncommonWords
        }
      },
      
      performance: {
        cacheUtilization: baseStats.cacheSize / this.maxCacheSize,
        averageGenerationTime: this.combinationGenerator?.getStats()?.averageGenerationTime || 0,
        successRate: this.combinationGenerator?.getStats()?.successRate || 0
      },
      
      health: {
        systemStatus: this.getSystemStatus(),
        canRecover: degradationStatus.canRecover,
        fallbackDataAvailable: degradationStatus.fallbackDataAvailable
      }
    }
    
    return metrics
  }

  /**
   * Synchronize data between legacy and new systems
   */
  async synchronizeData () {
    try {
      devLogger.storage('WordDataManager: Starting data synchronization')
      
      const syncResults = {
        categoriesSynced: 0,
        wordsSynced: 0,
        errors: []
      }
      
      // Get unified category data
      const unifiedCategories = this.getUnifiedCategoryData()
      
      // Update legacy categories with new metadata
      for (const category of unifiedCategories) {
        try {
          const legacyCategory = this.categories.find(c => c.id === category.id)
          if (legacyCategory && category.metadata) {
            // Enhance legacy category with new metadata
            legacyCategory.letterCompatibility = category.metadata.letterCompatibility
            legacyCategory.tags = category.metadata.tags
            legacyCategory.theme = category.metadata.theme
            
            syncResults.categoriesSynced++
          }
        } catch (error) {
          syncResults.errors.push({
            type: 'category',
            id: category.id,
            error: error.message
          })
        }
      }
      
      // Synchronize word data
      for (const categoryId of this.wordDatabase.keys()) {
        try {
          const unifiedWords = this.getUnifiedCategoryWords(categoryId)
          const existingWords = this.wordDatabase.get(categoryId) || []
          
          // Add new words that don't exist in legacy system
          const existingWordSet = new Set(existingWords.map(w => w.word))
          const newWords = unifiedWords.words.filter(word => !existingWordSet.has(word))
          
          for (const word of newWords) {
            await this.addWordToCategory(categoryId, word, 'medium')
            syncResults.wordsSynced++
          }
        } catch (error) {
          syncResults.errors.push({
            type: 'words',
            categoryId,
            error: error.message
          })
        }
      }
      
      // Save synchronized data
      if (this.storageManager) {
        try {
          await this.storageManager.save('categories', this.categories)
          const serializedData = this.serializeWordDatabase()
          await this.storageManager.saveWordCache('all_words', serializedData)
        } catch (error) {
          syncResults.errors.push({
            type: 'storage',
            error: error.message
          })
        }
      }
      
      devLogger.storage('WordDataManager: Data synchronization completed', syncResults)
      return syncResults
    } catch (error) {
      trackManagerError('WordDataManager', 'synchronizeData', error, {
        context: 'Data synchronization between systems'
      })
      
      return {
        categoriesSynced: 0,
        wordsSynced: 0,
        errors: [{ type: 'general', error: error.message }]
      }
    }
  }

  /**
   * Configure unified system behavior
   */
  configureUnifiedSystem (config = {}) {
    const defaultConfig = {
      preferNewSystem: true,
      enableFallback: true,
      syncOnInit: false,
      performanceMode: false,
      debugMode: false
    }
    
    this.unifiedConfig = { ...defaultConfig, ...config }
    
    if (this.unifiedConfig.performanceMode) {
      // Enable performance optimizations
      this.maxCacheSize = Math.max(this.maxCacheSize, 2000)
      
      if (this.categoryDataManager) {
        // Configure category manager for performance
        this.categoryDataManager.stats.performanceMode = true
      }
    }
    
    if (this.unifiedConfig.debugMode) {
      // Enable detailed logging
      devLogger.storage('WordDataManager: Unified system configured', this.unifiedConfig)
    }
    
    return this.unifiedConfig
  }

  /**
   * Export unified data for backup or migration
   */
  exportUnifiedData () {
    const exportData = {
      metadata: {
        exportedAt: Date.now(),
        version: '1.0',
        systemStatus: this.getSystemStatus(),
        configuration: this.unifiedConfig || {}
      },
      
      categories: this.getUnifiedCategoryData(),
      
      words: {},
      
      statistics: this.getUnifiedPerformanceMetrics(),
      
      generationSystem: this.generationSystemEnabled ? {
        categoryManager: this.categoryDataManager?.getStats(),
        letterGenerator: this.letterGenerator?.getStats(),
        combinationGenerator: this.combinationGenerator?.getStats()
      } : null
    }
    
    // Export word data for each category
    for (const category of exportData.categories) {
      exportData.words[category.id] = this.getUnifiedCategoryWords(category.id)
    }
    
    return exportData
  }

  // ==========================================
  // LEGACY FALLBACK METHODS
  // ==========================================

  /**
   * Legacy round generation fallback
   */
  generateLegacyRound (roundType = 'default') {
    const category = this.getRandomCategory()
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const letter = letters[Math.floor(Math.random() * letters.length)]
    
    return {
      category,
      letter,
      difficulty: this.mapLegacyDifficultyToNumeric(category?.difficulty || 'medium'),
      playability: {
        score: 5,
        feasible: true,
        reason: 'Legacy generation'
      },
      roundConfig: this.getLegacyRoundConfiguration(roundType),
      metadata: {
        generationType: 'legacy',
        generatedAt: Date.now(),
        attempts: 1
      }
    }
  }

  /**
   * Get legacy round configurations
   */
  getLegacyRoundConfigurations () {
    return {
      default: {
        duration: 90,
        difficulty: 3,
        targetWordCount: 10,
        scoring: SCORING
      },
      quick: {
        duration: 60,
        difficulty: 2,
        targetWordCount: 8,
        scoring: SCORING
      }
    }
  }

  /**
   * Get legacy round configuration by type
   */
  getLegacyRoundConfiguration (roundType) {
    const configs = this.getLegacyRoundConfigurations()
    return configs[roundType] || configs.default
  }

  /**
   * Map new category format to legacy format
   */
  mapNewCategoryToLegacy (newCategory) {
    if (!newCategory) return null
    
    return {
      id: newCategory.id,
      name: newCategory.name,
      difficulty: this.mapNumericDifficultyToLegacy(newCategory.difficulty),
      description: newCategory.metadata?.theme || `${newCategory.name} category`,
      icon: this.getCategoryIcon(newCategory.id),
      estimatedWords: newCategory.metadata?.estimatedWords || newCategory.words?.length || 20
    }
  }

  /**
   * Map numeric difficulty to legacy string
   */
  mapNumericDifficultyToLegacy (numericDifficulty) {
    if (numericDifficulty <= 2) return DIFFICULTY_LEVELS.EASY
    if (numericDifficulty <= 3) return DIFFICULTY_LEVELS.MEDIUM
    return DIFFICULTY_LEVELS.HARD
  }

  /**
   * Map legacy difficulty to numeric
   */
  mapLegacyDifficultyToNumeric (legacyDifficulty) {
    switch (legacyDifficulty) {
      case DIFFICULTY_LEVELS.EASY: return 2
      case DIFFICULTY_LEVELS.MEDIUM: return 3
      case DIFFICULTY_LEVELS.HARD: return 4
      default: return 3
    }
  }

  /**
   * Get category icon for legacy compatibility
   */
  getCategoryIcon (categoryId) {
    const icons = {
      animals: '🐾',
      foods: '🍎',
      colors: '🌈',
      countries: '🌍',
      sports: '⚽',
      science: '🔬',
      technology: '💻',
      nature: '🌿',
      professions: '👨‍💼'
    }
    
    return icons[categoryId] || '📝'
  }
}