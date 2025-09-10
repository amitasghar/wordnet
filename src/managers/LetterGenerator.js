import { devLogger } from '@/utils/devTools.js'
import { LetterFrequencyCache, ObjectPool } from '@/utils/IntelligentCache.js'

/**
 * LetterGenerator
 * 
 * Generates letters for word game rounds using frequency-based algorithms,
 * category compatibility, and configurable difficulty settings.
 * Optimized for fast generation with multiple strategies.
 */
export class LetterGenerator {
  constructor (categoryManager = null) {
    this.categoryManager = categoryManager
    this.letterFrequencies = {}
    this.letterRarityScores = {}
    this.vowels = new Set(['A', 'E', 'I', 'O', 'U'])
    this.initialized = false
    
    // Caching system for frequency data
    this.cache = new LetterFrequencyCache({
      maxSize: 100,
      ttl: 1800000 // 30 minutes
    })
    
    // Object pool for letter generation results
    this.letterPool = new ObjectPool(
      () => ({ letter: '', frequency: 0, strategy: '', metadata: {} }),
      (obj) => { obj.letter = ''; obj.frequency = 0; obj.strategy = ''; obj.metadata = {} },
      50
    )
    
    // Performance and statistics tracking
    this.stats = {
      totalGenerated: 0,
      strategyCounts: {
        random: 0,
        balanced: 0,
        challenging: 0
      },
      averageGenerationTime: 0,
      totalGenerationTime: 0,
      cacheStats: () => this.cache.getStats(),
      poolStats: () => this.letterPool.getStats()
    }
    
    // Generation options defaults
    this.defaultOptions = {
      difficulty: 3,
      excludeLetters: [],
      preferVowels: false,
      categoryId: null
    }
  }

  /**
   * Initialize the letter generator with frequency data
   */
  async init () {
    const startTime = performance.now()
    
    try {
      devLogger.manager('LetterGenerator: Initializing letter generation system')
      
      // Initialize English letter frequencies (based on actual language analysis)
      this.letterFrequencies = {
        'A': 0.0812, 'B': 0.0149, 'C': 0.0278, 'D': 0.0425, 'E': 0.1202,
        'F': 0.0223, 'G': 0.0202, 'H': 0.0609, 'I': 0.0697, 'J': 0.0015,
        'K': 0.0077, 'L': 0.0403, 'M': 0.0241, 'N': 0.0675, 'O': 0.0751,
        'P': 0.0193, 'Q': 0.0010, 'R': 0.0599, 'S': 0.0633, 'T': 0.0906,
        'U': 0.0276, 'V': 0.0098, 'W': 0.0236, 'X': 0.0015, 'Y': 0.0197,
        'Z': 0.0007
      }
      
      // Calculate rarity scores (inverse of frequency)
      this.calculateRarityScores()
      
      // Normalize frequencies to ensure they sum to 1
      this.normalizeFrequencies()
      
      const loadTime = performance.now() - startTime
      
      this.initialized = true
      
      devLogger.manager(`LetterGenerator: Initialized with 26 letters in ${loadTime.toFixed(2)}ms`)
      
      return true
    } catch (error) {
      devLogger.error('LetterGenerator: Failed to initialize', error)
      this.loadFallbackFrequencies()
      this.initialized = true
      return false
    }
  }

  /**
   * Calculate rarity scores for each letter
   */
  calculateRarityScores () {
    const maxFrequency = Math.max(...Object.values(this.letterFrequencies))
    
    for (const [letter, frequency] of Object.entries(this.letterFrequencies)) {
      // Rarity score is inverse of normalized frequency (1-10 scale)
      this.letterRarityScores[letter] = Math.round(((maxFrequency - frequency) / maxFrequency) * 9) + 1
    }
  }

  /**
   * Normalize frequencies to sum to 1
   */
  normalizeFrequencies () {
    const total = Object.values(this.letterFrequencies).reduce((sum, freq) => sum + freq, 0)
    
    for (const letter of Object.keys(this.letterFrequencies)) {
      this.letterFrequencies[letter] /= total
    }
  }

  /**
   * Load fallback frequencies for emergency use
   */
  loadFallbackFrequencies () {
    // Simple uniform distribution as fallback
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const uniformFreq = 1 / 26
    
    this.letterFrequencies = {}
    this.letterRarityScores = {}
    
    for (const letter of letters) {
      this.letterFrequencies[letter] = uniformFreq
      this.letterRarityScores[letter] = 5 // Medium rarity
    }
    
    devLogger.warn('LetterGenerator: Using fallback uniform frequencies')
  }

  /**
   * Generate a letter using frequency-based selection
   */
  generateLetter (difficulty = 3) {
    return this.generateByFrequency(difficulty)
  }

  /**
   * Generate a letter using frequency-based selection
   */
  generateByFrequency (difficulty = 3) {
    const letters = Object.keys(this.letterFrequencies)
    
    // Apply difficulty adjustment to frequencies
    const adjustedFrequencies = this.applyDifficultyAdjustment(difficulty)
    
    // Weighted random selection
    const random = Math.random()
    let cumulativeFreq = 0
    
    for (const letter of letters) {
      cumulativeFreq += adjustedFrequencies[letter]
      if (random <= cumulativeFreq) {
        return letter
      }
    }
    
    // Fallback to last letter if rounding errors occur
    return letters[letters.length - 1]
  }

  /**
   * Apply difficulty adjustment to letter frequencies
   */
  applyDifficultyAdjustment (difficulty) {
    const adjustedFreqs = { ...this.letterFrequencies }
    const difficultyFactor = (difficulty - 3) * 0.1 // -0.2 to +0.2
    
    for (const [letter, frequency] of Object.entries(adjustedFreqs)) {
      const rarityScore = this.letterRarityScores[letter]
      
      if (difficulty > 3) {
        // Higher difficulty: boost rare letters
        if (rarityScore >= 7) {
          adjustedFreqs[letter] = frequency * (1 + difficultyFactor * 2)
        }
      } else if (difficulty < 3) {
        // Lower difficulty: boost common letters
        if (rarityScore <= 4) {
          adjustedFreqs[letter] = frequency * (1 - difficultyFactor * 2)
        }
      }
    }
    
    // Renormalize
    const total = Object.values(adjustedFreqs).reduce((sum, freq) => sum + freq, 0)
    for (const letter of Object.keys(adjustedFreqs)) {
      adjustedFreqs[letter] /= total
    }
    
    return adjustedFreqs
  }

  /**
   * Get letter rarity score (1-10, higher = rarer)
   */
  getLetterRarityScore (letter) {
    return this.letterRarityScores[letter] || 5
  }

  /**
   * Generate a letter for a specific category
   */
  generateForCategory (categoryId, difficulty = 3) {
    if (!this.categoryManager) {
      return this.generateByFrequency(difficulty)
    }
    
    const category = this.categoryManager.getCategoryById(categoryId)
    if (!category) {
      return null
    }
    
    const compatibleLetters = category.metadata?.letterCompatibility || []
    
    if (compatibleLetters.length === 0) {
      // No constraints, use normal generation
      return this.generateByFrequency(difficulty)
    }
    
    // Filter frequencies to only compatible letters
    const compatibleFreqs = {}
    let totalFreq = 0
    
    for (const letter of compatibleLetters) {
      if (this.letterFrequencies[letter]) {
        compatibleFreqs[letter] = this.letterFrequencies[letter]
        totalFreq += this.letterFrequencies[letter]
      }
    }
    
    if (totalFreq === 0) {
      // No valid letters found, return random compatible letter
      return compatibleLetters[Math.floor(Math.random() * compatibleLetters.length)]
    }
    
    // Normalize compatible frequencies
    for (const letter of Object.keys(compatibleFreqs)) {
      compatibleFreqs[letter] /= totalFreq
    }
    
    // Apply difficulty adjustment
    const adjustedFreqs = this.applyCategoryDifficultyAdjustment(compatibleFreqs, difficulty)
    
    // Weighted selection from compatible letters
    const random = Math.random()
    let cumulativeFreq = 0
    
    for (const [letter, frequency] of Object.entries(adjustedFreqs)) {
      cumulativeFreq += frequency
      if (random <= cumulativeFreq) {
        return letter
      }
    }
    
    // Fallback
    return compatibleLetters[0]
  }

  /**
   * Apply difficulty adjustment for category-specific generation
   */
  applyCategoryDifficultyAdjustment (frequencies, difficulty) {
    const adjustedFreqs = { ...frequencies }
    const difficultyFactor = (difficulty - 3) * 0.15
    
    for (const [letter, frequency] of Object.entries(adjustedFreqs)) {
      const rarityScore = this.letterRarityScores[letter]
      
      if (difficulty > 3) {
        // Boost rare letters more aggressively in categories
        if (rarityScore >= 6) {
          adjustedFreqs[letter] = frequency * (1 + difficultyFactor * 3)
        }
      } else if (difficulty < 3) {
        // Boost common letters
        if (rarityScore <= 5) {
          adjustedFreqs[letter] = frequency * (1 - difficultyFactor * 2)
        }
      }
    }
    
    // Renormalize
    const total = Object.values(adjustedFreqs).reduce((sum, freq) => sum + freq, 0)
    for (const letter of Object.keys(adjustedFreqs)) {
      adjustedFreqs[letter] /= total
    }
    
    return adjustedFreqs
  }

  /**
   * Check if a letter is a vowel
   */
  isVowel (letter) {
    return this.vowels.has(letter?.toUpperCase())
  }

  /**
   * Generate a vowel
   */
  generateVowel (difficulty = 3) {
    const vowelArray = Array.from(this.vowels)
    
    if (difficulty <= 2) {
      // Easy: favor common vowels (A, E, I, O)
      const commonVowels = ['A', 'E', 'I', 'O']
      return commonVowels[Math.floor(Math.random() * commonVowels.length)]
    } else if (difficulty >= 4) {
      // Hard: include U more often
      const weightedVowels = ['A', 'E', 'I', 'O', 'U', 'U']
      return weightedVowels[Math.floor(Math.random() * weightedVowels.length)]
    } else {
      // Normal: uniform distribution
      return vowelArray[Math.floor(Math.random() * vowelArray.length)]
    }
  }

  /**
   * Generate a consonant
   */
  generateConsonant (difficulty = 3) {
    const consonants = Object.keys(this.letterFrequencies).filter(letter => !this.isVowel(letter))
    
    // Use frequency-based selection for consonants
    const consonantFreqs = {}
    let totalFreq = 0
    
    for (const consonant of consonants) {
      consonantFreqs[consonant] = this.letterFrequencies[consonant]
      totalFreq += this.letterFrequencies[consonant]
    }
    
    // Normalize
    for (const consonant of consonants) {
      consonantFreqs[consonant] /= totalFreq
    }
    
    // Apply difficulty
    const adjustedFreqs = this.applyConsonantDifficultyAdjustment(consonantFreqs, difficulty)
    
    // Weighted selection
    const random = Math.random()
    let cumulativeFreq = 0
    
    for (const [consonant, frequency] of Object.entries(adjustedFreqs)) {
      cumulativeFreq += frequency
      if (random <= cumulativeFreq) {
        return consonant
      }
    }
    
    return consonants[0]
  }

  /**
   * Apply difficulty adjustment for consonant generation
   */
  applyConsonantDifficultyAdjustment (frequencies, difficulty) {
    const adjustedFreqs = { ...frequencies }
    const difficultyFactor = (difficulty - 3) * 0.1
    
    for (const [consonant, frequency] of Object.entries(adjustedFreqs)) {
      const rarityScore = this.letterRarityScores[consonant]
      
      if (difficulty > 3) {
        // Boost rare consonants (Q, X, Z, etc.)
        if (rarityScore >= 8) {
          adjustedFreqs[consonant] = frequency * (1 + difficultyFactor * 4)
        }
      } else if (difficulty < 3) {
        // Boost common consonants (T, N, S, R, etc.)
        if (rarityScore <= 3) {
          adjustedFreqs[consonant] = frequency * (1 - difficultyFactor * 2)
        }
      }
    }
    
    // Renormalize
    const total = Object.values(adjustedFreqs).reduce((sum, freq) => sum + freq, 0)
    for (const consonant of Object.keys(adjustedFreqs)) {
      adjustedFreqs[consonant] /= total
    }
    
    return adjustedFreqs
  }

  /**
   * Generate a balanced set of letters (vowels and consonants)
   */
  generateBalancedSet (count = 6, difficulty = 3) {
    const letters = []
    const vowelCount = Math.max(1, Math.floor(count * 0.3)) // ~30% vowels
    const consonantCount = count - vowelCount
    
    // Generate vowels
    for (let i = 0; i < vowelCount; i++) {
      letters.push(this.generateVowel(difficulty))
    }
    
    // Generate consonants
    for (let i = 0; i < consonantCount; i++) {
      letters.push(this.generateConsonant(difficulty))
    }
    
    // Shuffle the array
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]]
    }
    
    return letters
  }

  /**
   * Main generation method with strategy support
   */
  generate (strategy = 'balanced', options = {}) {
    const startTime = performance.now()
    
    const opts = { ...this.defaultOptions, ...options }
    let letter = null
    
    try {
      switch (strategy) {
        case 'random':
          letter = this.generateRandom(opts)
          break
        case 'balanced':
          letter = this.generateBalanced(opts)
          break
        case 'challenging':
          letter = this.generateChallenging(opts)
          break
        default:
          letter = this.generateBalanced(opts)
          break
      }
      
      // Apply exclusions
      if (letter && opts.excludeLetters.includes(letter)) {
        // Try again with different strategy
        return this.generate(strategy, { ...opts, excludeLetters: [] })
      }
      
      // Apply category constraints if specified
      if (letter && opts.categoryId) {
        const categoryLetter = this.generateForCategory(opts.categoryId, opts.difficulty)
        if (categoryLetter && !opts.excludeLetters.includes(categoryLetter)) {
          letter = categoryLetter
        }
      }
      
      // Update statistics
      this.updateStats(strategy, performance.now() - startTime)
      
      return letter
    } catch (error) {
      devLogger.error('LetterGenerator: Generation failed', error)
      return this.generateFallback()
    }
  }

  /**
   * Random strategy - pure random selection
   */
  generateRandom (options) {
    const letters = Object.keys(this.letterFrequencies).filter(
      letter => !options.excludeLetters.includes(letter)
    )
    
    if (options.preferVowels && Math.random() < 0.4) {
      return this.generateVowel(options.difficulty)
    }
    
    return letters[Math.floor(Math.random() * letters.length)]
  }

  /**
   * Balanced strategy - frequency-based with moderate difficulty adjustment
   */
  generateBalanced (options) {
    if (options.preferVowels && Math.random() < 0.35) {
      return this.generateVowel(options.difficulty)
    }
    
    return this.generateByFrequency(options.difficulty)
  }

  /**
   * Challenging strategy - bias toward less common letters
   */
  generateChallenging (options) {
    const challengingDifficulty = Math.min(5, options.difficulty + 1)
    
    if (options.preferVowels && Math.random() < 0.3) {
      return this.generateVowel(challengingDifficulty)
    }
    
    return this.generateByFrequency(challengingDifficulty)
  }

  /**
   * Fallback generation method
   */
  generateFallback () {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return letters[Math.floor(Math.random() * letters.length)]
  }

  /**
   * Update performance statistics
   */
  updateStats (strategy, generationTime) {
    this.stats.totalGenerated++
    this.stats.strategyCounts[strategy] = (this.stats.strategyCounts[strategy] || 0) + 1
    this.stats.totalGenerationTime += generationTime
    this.stats.averageGenerationTime = this.stats.totalGenerationTime / this.stats.totalGenerated
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
   * Reset statistics
   */
  resetStats () {
    this.stats = {
      totalGenerated: 0,
      strategyCounts: {
        random: 0,
        balanced: 0,
        challenging: 0
      },
      averageGenerationTime: 0,
      totalGenerationTime: 0
    }
  }

  /**
   * Cleanup method for resource management
   */
  cleanup () {
    if (this.cache) {
      this.cache.destroy()
    }
    
    if (this.letterPool) {
      this.letterPool.clear()
    }
    
    this.letterFrequencies = {}
    this.letterRarityScores = {}
    
    devLogger.manager('LetterGenerator: Cleanup completed')
  }

  /**
   * Destroy the generator and clean up resources
   */
  destroy () {
    this.cleanup()
    this.categoryManager = null
    this.initialized = false
    
    devLogger.manager('LetterGenerator: Destroyed')
  }
}