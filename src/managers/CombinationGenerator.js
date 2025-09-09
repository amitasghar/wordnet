import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'

/**
 * CombinationGenerator
 * 
 * Generates intelligent category-letter combinations for word game rounds.
 * Includes combination validation, round configuration, and difficulty balancing.
 * Optimized for fast generation with quality assessment.
 */
export class CombinationGenerator {
  constructor (categoryManager = null, letterGenerator = null) {
    this.categoryManager = categoryManager
    this.letterGenerator = letterGenerator
    this.roundConfigs = {}
    this.initialized = false
    
    // Generation settings
    this.maxRetries = 10
    this.defaultTargetWordCount = 10
    
    // Statistics tracking
    this.stats = {
      totalGenerated: 0,
      successfulGeneration: 0,
      failedGeneration: 0,
      averageGenerationTime: 0,
      totalGenerationTime: 0,
      difficultyDistribution: {},
      averageDifficulty: 0,
      averagePlayability: 0,
      retryCount: 0
    }
  }

  /**
   * Initialize the combination generator with round configurations
   */
  async init () {
    const startTime = performance.now()
    
    try {
      devLogger.manager('CombinationGenerator: Initializing combination system')
      
      // Initialize round configurations
      this.setupRoundConfigurations()
      
      // Initialize fallback data
      this.setupFallbackData()
      
      const loadTime = performance.now() - startTime
      
      this.initialized = true
      
      devLogger.manager(`CombinationGenerator: Initialized in ${loadTime.toFixed(2)}ms`)
      
      return true
    } catch (error) {
      trackManagerError('CombinationGenerator', 'init', error, { 
        fallback: true,
        context: 'Combination generator initialization'
      })
      devLogger.error('CombinationGenerator: Failed to initialize', error)
      this.setupMinimalFallback()
      this.initialized = true
      return false
    }
  }

  /**
   * Setup predefined round configurations
   */
  setupRoundConfigurations () {
    this.roundConfigs = {
      default: {
        duration: 90,
        difficulty: 3,
        targetWordCount: 12,
        scoring: {
          basePoints: 10,
          lengthMultiplier: 1.5,
          difficultyBonus: 2
        },
        letterStrategy: 'balanced',
        allowRetries: true
      },
      
      quick: {
        duration: 60,
        difficulty: 2,
        targetWordCount: 8,
        scoring: {
          basePoints: 15,
          lengthMultiplier: 1.2,
          difficultyBonus: 1
        },
        letterStrategy: 'balanced',
        allowRetries: true
      },
      
      challenge: {
        duration: 75,
        difficulty: 4,
        targetWordCount: 15,
        scoring: {
          basePoints: 8,
          lengthMultiplier: 2.0,
          difficultyBonus: 3
        },
        letterStrategy: 'challenging',
        allowRetries: false
      }
    }
  }

  /**
   * Setup fallback data for emergency use
   */
  setupFallbackData () {
    this.fallbackCategories = [
      {
        id: 'fallback-words',
        name: 'Words',
        difficulty: 2,
        words: ['cat', 'dog', 'sun', 'car', 'book'],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'D', 'S', 'T'],
          estimatedWords: 20,
          averageWordLength: 4
        }
      }
    ]
    
    this.fallbackLetters = ['A', 'E', 'T', 'S', 'R', 'N']
  }

  /**
   * Setup minimal fallback configuration
   */
  setupMinimalFallback () {
    this.roundConfigs = {
      default: {
        duration: 90,
        difficulty: 3,
        targetWordCount: 10,
        scoring: { basePoints: 10 },
        letterStrategy: 'balanced'
      }
    }
    
    this.setupFallbackData()
  }

  /**
   * Validate category-letter combination compatibility
   */
  validateCombination (categoryId, letter) {
    try {
      if (!categoryId || !letter) {
        return false
      }
      
      const category = this.getCategoryById(categoryId)
      if (!category) {
        return false
      }
      
      const compatibility = category.metadata?.letterCompatibility || []
      
      // If no constraints, allow any letter
      if (compatibility.length === 0) {
        return true
      }
      
      return compatibility.includes(letter.toUpperCase())
    } catch (error) {
      devLogger.error('CombinationGenerator: Validation error', error)
      return false
    }
  }

  /**
   * Calculate difficulty score for category-letter combination
   */
  calculateDifficultyScore (categoryId, letter) {
    try {
      const category = this.getCategoryById(categoryId)
      if (!category) {
        return 5 // Default medium difficulty
      }
      
      const categoryDifficulty = category.difficulty || 3
      const letterRarity = this.getLetterRarityScore(letter)
      
      // Combine category difficulty (1-5) and letter rarity (1-10)
      // Normalize to 1-10 scale
      const combinedScore = (categoryDifficulty * 1.5 + letterRarity * 0.5)
      
      return Math.min(10, Math.max(1, Math.round(combinedScore)))
    } catch (error) {
      devLogger.error('CombinationGenerator: Difficulty calculation error', error)
      return 5
    }
  }

  /**
   * Assess playability of category-letter combination
   */
  assessPlayability (categoryId, letter) {
    try {
      const category = this.getCategoryById(categoryId)
      if (!category) {
        return {
          score: 0,
          estimatedWords: 0,
          difficulty: 5,
          feasible: false,
          reason: 'Category not found'
        }
      }
      
      const estimatedWords = this.estimateWordsForCombination(category, letter)
      const difficulty = this.calculateDifficultyScore(categoryId, letter)
      
      // Calculate playability score (0-10)
      let score = 0
      
      // Base score from estimated words
      if (estimatedWords >= 15) score += 4
      else if (estimatedWords >= 10) score += 3
      else if (estimatedWords >= 5) score += 2
      else if (estimatedWords >= 2) score += 1
      
      // Difficulty adjustment
      if (difficulty >= 3 && difficulty <= 7) score += 3 // Sweet spot
      else if (difficulty >= 2 && difficulty <= 8) score += 2
      else score += 1
      
      // Category quality factors
      if (category.metadata?.tags?.includes('common')) score += 1
      if (category.words?.length > 20) score += 1
      if (category.metadata?.averageWordLength >= 4) score += 1
      
      const feasible = estimatedWords >= 3 && score >= 4
      
      return {
        score: Math.min(10, score),
        estimatedWords,
        difficulty,
        feasible,
        reason: feasible ? 'Good combination' : 'Insufficient words or poor playability'
      }
    } catch (error) {
      devLogger.error('CombinationGenerator: Playability assessment error', error)
      return {
        score: 0,
        estimatedWords: 0,
        difficulty: 5,
        feasible: false,
        reason: 'Assessment failed'
      }
    }
  }

  /**
   * Estimate number of words for category-letter combination
   */
  estimateWordsForCombination (category, letter) {
    try {
      const totalWords = category.words?.length || category.metadata?.estimatedWords || 10
      const letterFrequency = this.getLetterFrequencyInCategory(category, letter)
      
      // Estimate based on letter frequency in English and category size
      const baseEstimate = totalWords * letterFrequency
      
      // Apply category-specific adjustments
      let adjustment = 1.0
      
      if (category.metadata?.tags?.includes('common')) adjustment *= 1.2
      if (category.difficulty <= 2) adjustment *= 1.1
      if (category.difficulty >= 4) adjustment *= 0.9
      
      return Math.round(baseEstimate * adjustment)
    } catch (error) {
      devLogger.error('CombinationGenerator: Word estimation error', error)
      return 5 // Conservative estimate
    }
  }

  /**
   * Get estimated letter frequency in category
   */
  getLetterFrequencyInCategory (category, letter) {
    // Default English letter frequencies for word starts
    const startFrequencies = {
      'A': 0.11, 'B': 0.09, 'C': 0.12, 'D': 0.08, 'E': 0.02, 'F': 0.06,
      'G': 0.05, 'H': 0.06, 'I': 0.02, 'J': 0.01, 'K': 0.01, 'L': 0.05,
      'M': 0.09, 'N': 0.02, 'O': 0.02, 'P': 0.08, 'Q': 0.001, 'R': 0.07,
      'S': 0.11, 'T': 0.09, 'U': 0.01, 'V': 0.01, 'W': 0.05, 'X': 0.001,
      'Y': 0.01, 'Z': 0.001
    }
    
    return startFrequencies[letter.toUpperCase()] || 0.02
  }

  /**
   * Generate a category-letter combination
   */
  generateCombination (roundType = 'default', options = {}) {
    const startTime = performance.now()
    
    try {
      const roundConfig = this.getRoundConfig(roundType)
      const generationOptions = {
        targetDifficulty: options.targetDifficulty || roundConfig.difficulty,
        preferVowels: options.preferVowels || false,
        excludeLetters: options.excludeLetters || [],
        maxRetries: options.maxRetries || this.maxRetries,
        ...options
      }
      
      let combination = null
      let attempts = 0
      
      while (!combination && attempts < generationOptions.maxRetries) {
        attempts++
        
        try {
          const category = this.selectCategory(generationOptions)
          const letter = this.selectLetter(category, roundConfig, generationOptions)
          
          if (category && letter && this.validateCombination(category.id, letter)) {
            const playability = this.assessPlayability(category.id, letter)
            
            if (playability.feasible || attempts >= generationOptions.maxRetries - 2) {
              combination = {
                category,
                letter,
                difficulty: this.calculateDifficultyScore(category.id, letter),
                playability,
                roundConfig,
                generatedAt: Date.now(),
                attempts
              }
            }
          }
        } catch (error) {
          devLogger.warn(`CombinationGenerator: Generation attempt ${attempts} failed`, error)
        }
      }
      
      // Fallback if all attempts failed
      if (!combination) {
        combination = this.generateFallbackCombination(roundConfig)
      }
      
      // Update statistics
      this.updateGenerationStats(combination, performance.now() - startTime, attempts)
      
      return combination
    } catch (error) {
      devLogger.error('CombinationGenerator: Generation failed', error)
      return this.generateFallbackCombination(this.getRoundConfig(roundType))
    }
  }

  /**
   * Select a category based on generation options
   */
  selectCategory (options) {
    try {
      if (options.categoryId) {
        return this.getCategoryById(options.categoryId)
      }
      
      if (options.targetDifficulty) {
        const categories = this.getCategoriesByDifficulty(options.targetDifficulty)
        if (categories.length > 0) {
          return categories[Math.floor(Math.random() * categories.length)]
        }
      }
      
      return this.getRandomCategory()
    } catch (error) {
      devLogger.error('CombinationGenerator: Category selection error', error)
      return this.fallbackCategories[0]
    }
  }

  /**
   * Select a letter for the given category and round config
   */
  selectLetter (category, roundConfig, options) {
    try {
      if (!this.letterGenerator) {
        return this.selectFallbackLetter(category)
      }
      
      const letterOptions = {
        difficulty: options.targetDifficulty || roundConfig.difficulty,
        preferVowels: options.preferVowels,
        excludeLetters: options.excludeLetters,
        categoryId: category.id
      }
      
      // Try category-specific generation first
      let letter = this.letterGenerator.generateForCategory(category.id, letterOptions.difficulty)
      
      // If that fails, try general strategy
      if (!letter) {
        letter = this.letterGenerator.generate(roundConfig.letterStrategy || 'balanced', letterOptions)
      }
      
      return letter || this.selectFallbackLetter(category)
    } catch (error) {
      devLogger.error('CombinationGenerator: Letter selection error', error)
      return this.selectFallbackLetter(category)
    }
  }

  /**
   * Select fallback letter when primary generation fails
   */
  selectFallbackLetter (category) {
    const compatibility = category?.metadata?.letterCompatibility || []
    
    if (compatibility.length > 0) {
      return compatibility[Math.floor(Math.random() * compatibility.length)]
    }
    
    return this.fallbackLetters[Math.floor(Math.random() * this.fallbackLetters.length)]
  }

  /**
   * Generate fallback combination for emergency use
   */
  generateFallbackCombination (roundConfig) {
    const category = this.fallbackCategories[0]
    const letter = this.selectFallbackLetter(category)
    
    return {
      category,
      letter,
      difficulty: 3,
      playability: {
        score: 5,
        estimatedWords: 8,
        difficulty: 3,
        feasible: true,
        reason: 'Fallback combination'
      },
      roundConfig,
      generatedAt: Date.now(),
      attempts: 1,
      isFallback: true
    }
  }

  /**
   * Generate multiple combinations in batch
   */
  generateBatch (count = 5, roundType = 'default', options = {}) {
    const combinations = []
    const usedCategoryIds = new Set()
    
    for (let i = 0; i < count; i++) {
      let combination = null
      let attempts = 0
      const maxAttempts = 10
      
      while (!combination && attempts < maxAttempts) {
        attempts++
        
        const tempCombination = this.generateCombination(roundType, options)
        
        if (!options.ensureUnique || !usedCategoryIds.has(tempCombination.category.id)) {
          combination = tempCombination
          
          if (options.ensureUnique) {
            usedCategoryIds.add(combination.category.id)
          }
        }
      }
      
      if (combination) {
        combinations.push(combination)
      }
    }
    
    return combinations
  }

  /**
   * Get round configurations
   */
  getRoundConfigurations () {
    return { ...this.roundConfigs }
  }

  /**
   * Get specific round configuration
   */
  getRoundConfig (name) {
    return this.roundConfigs[name] || this.roundConfigs.default
  }

  /**
   * Add custom round configuration
   */
  addRoundConfig (name, config) {
    if (this.validateRoundConfig(config)) {
      this.roundConfigs[name] = { ...config }
      return true
    }
    return false
  }

  /**
   * Validate round configuration structure
   */
  validateRoundConfig (config) {
    if (!config || typeof config !== 'object') {
      return false
    }
    
    const required = ['duration', 'difficulty', 'targetWordCount', 'scoring']
    
    for (const field of required) {
      if (!(field in config)) {
        return false
      }
    }
    
    return (
      typeof config.duration === 'number' && config.duration > 0 &&
      typeof config.difficulty === 'number' && config.difficulty >= 1 && config.difficulty <= 5 &&
      typeof config.targetWordCount === 'number' && config.targetWordCount > 0 &&
      typeof config.scoring === 'object'
    )
  }

  /**
   * Helper methods for accessing managers
   */
  getCategoryById (id) {
    return this.categoryManager?.getCategoryById(id) || null
  }

  getRandomCategory () {
    return this.categoryManager?.getRandomCategory() || this.fallbackCategories[0]
  }

  getCategoriesByDifficulty (difficulty) {
    return this.categoryManager?.getCategoriesByDifficulty(difficulty) || []
  }

  getLetterRarityScore (letter) {
    return this.letterGenerator?.getLetterRarityScore(letter) || 5
  }

  /**
   * Update generation statistics
   */
  updateGenerationStats (combination, generationTime, attempts) {
    this.stats.totalGenerated++
    this.stats.totalGenerationTime += generationTime
    this.stats.averageGenerationTime = this.stats.totalGenerationTime / this.stats.totalGenerated
    this.stats.retryCount += Math.max(0, attempts - 1)
    
    if (combination.playability.feasible) {
      this.stats.successfulGeneration++
    } else {
      this.stats.failedGeneration++
    }
    
    // Update difficulty distribution
    const difficulty = combination.difficulty
    this.stats.difficultyDistribution[difficulty] = (this.stats.difficultyDistribution[difficulty] || 0) + 1
    
    // Update averages
    const totalGenerated = this.stats.totalGenerated
    this.stats.averageDifficulty = ((this.stats.averageDifficulty * (totalGenerated - 1)) + difficulty) / totalGenerated
    this.stats.averagePlayability = ((this.stats.averagePlayability * (totalGenerated - 1)) + combination.playability.score) / totalGenerated
  }

  /**
   * Get performance and quality statistics
   */
  getStats () {
    const successRate = this.stats.totalGenerated > 0 
      ? (this.stats.successfulGeneration / this.stats.totalGenerated) * 100 
      : 0
    
    return {
      ...this.stats,
      successRate: Number(successRate.toFixed(2)),
      averageRetries: this.stats.totalGenerated > 0 
        ? Number((this.stats.retryCount / this.stats.totalGenerated).toFixed(2)) 
        : 0,
      initialized: this.initialized
    }
  }

  /**
   * Generate multiple rounds at once
   */
  async generateRounds(count = 5) {
    const rounds = []
    
    for (let i = 0; i < count; i++) {
      try {
        const combination = await this.generateCombination()
        rounds.push(combination)
      } catch (error) {
        devLogger.warn(`Failed to generate round ${i + 1}:`, error)
        // Continue with fallback if needed
        const fallback = this.generateFallbackCombination()
        rounds.push(fallback)
      }
    }
    
    return rounds
  }

  /**
   * Reset statistics
   */
  resetStats () {
    this.stats = {
      totalGenerated: 0,
      successfulGeneration: 0,
      failedGeneration: 0,
      averageGenerationTime: 0,
      totalGenerationTime: 0,
      difficultyDistribution: {},
      averageDifficulty: 0,
      averagePlayability: 0,
      retryCount: 0
    }
  }

  /**
   * Destroy the generator and clean up resources
   */
  destroy () {
    this.roundConfigs = {}
    this.fallbackCategories = []
    this.fallbackLetters = []
    this.categoryManager = null
    this.letterGenerator = null
    this.initialized = false
    
    devLogger.manager('CombinationGenerator: Destroyed')
  }
}