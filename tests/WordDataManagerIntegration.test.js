import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WordDataManager } from '../src/managers/WordDataManager.js'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'
import { LetterGenerator } from '../src/managers/LetterGenerator.js'
import { CombinationGenerator } from '../src/managers/CombinationGenerator.js'
import { gracefulDegradation } from '../src/utils/GracefulDegradation.js'

describe('WordDataManager Integration with Category Generation System', () => {
  let wordManager
  let mockStorageManager
  
  beforeEach(async () => {
    // Reset graceful degradation
    gracefulDegradation.reset()
    
    // Create mock storage manager
    mockStorageManager = {
      has: vi.fn().mockResolvedValue(false),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(true),
      loadWordCache: vi.fn().mockResolvedValue(null),
      saveWordCache: vi.fn().mockResolvedValue(true)
    }
    
    // Initialize WordDataManager
    wordManager = new WordDataManager(mockStorageManager)
    await wordManager.init()
  })

  afterEach(() => {
    gracefulDegradation.reset()
    vi.clearAllMocks()
  })

  describe('Category Generation System Integration', () => {
    it('should initialize with category generation system enabled', async () => {
      expect(wordManager.generationSystemEnabled).toBe(true)
      expect(wordManager.categoryDataManager).toBeInstanceOf(CategoryDataManager)
      expect(wordManager.letterGenerator).toBeInstanceOf(LetterGenerator)
      expect(wordManager.combinationGenerator).toBeInstanceOf(CombinationGenerator)
    })

    it('should fallback gracefully when category generation system fails', async () => {
      // Create a new manager with failing initialization
      const failingWordManager = new WordDataManager(mockStorageManager)
      
      // Mock CategoryDataManager to fail
      const originalCategoryManager = failingWordManager.categoryDataManager
      failingWordManager.categoryDataManager = null
      
      const result = await failingWordManager.initCategoryGenerationSystem()
      
      expect(result).toBe(false)
      expect(failingWordManager.generationSystemEnabled).toBe(false)
      expect(gracefulDegradation.isDegradationActive('generation_system_failed')).toBe(true)
    })

    it('should handle storage failures gracefully during initialization', async () => {
      // Mock storage to fail
      const failingStorage = {
        ...mockStorageManager,
        has: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
        get: vi.fn().mockRejectedValue(new Error('Storage unavailable'))
      }
      
      const failingManager = new WordDataManager(failingStorage)
      await failingManager.init()
      
      // Should still initialize with defaults
      expect(failingManager.categories.length).toBeGreaterThan(0)
      expect(failingManager.wordStats.size).toBeGreaterThan(0)
    })
  })

  describe('Data Flow Integration', () => {
    it('should share data consistently between WordDataManager and CategoryDataManager', async () => {
      // Get categories from both systems
      const wordManagerCategories = wordManager.getAllCategories()
      const categoryManagerCategories = wordManager.categoryDataManager.getAllCategories()
      
      expect(wordManagerCategories).toBeDefined()
      expect(categoryManagerCategories).toBeDefined()
      
      // Both should provide valid category data
      expect(wordManagerCategories.length).toBeGreaterThan(0)
      expect(categoryManagerCategories.length).toBeGreaterThan(0)
    })

    it('should validate words with enhanced context from category system', () => {
      const testWord = 'cat'
      const categoryId = 'animals'
      const letter = 'C'
      
      // Test enhanced validation
      const validationResult = wordManager.validateWordWithContext(testWord, categoryId, letter)
      
      expect(validationResult).toBeDefined()
      expect(validationResult.valid).toBeDefined()
      expect(validationResult.score).toBeDefined()
      expect(validationResult.metadata).toBeDefined()
      expect(validationResult.metadata.validationType).toBeDefined()
    })

    it('should calculate enhanced scores using letter rarity and category context', () => {
      const testWord = 'xenophobia'
      const categoryId = 'science'
      const letter = 'X'
      
      const basicScore = wordManager.calculateWordScore(testWord, categoryId)
      const enhancedScore = wordManager.calculateEnhancedScore(testWord, categoryId, letter)
      
      expect(enhancedScore).toBeGreaterThanOrEqual(basicScore)
      expect(typeof enhancedScore).toBe('number')
    })

    it('should provide word hints filtered by category and letter', () => {
      const categoryId = 'animals'
      const letter = 'C'
      const count = 3
      
      const hints = wordManager.getWordHints(categoryId, letter, count)
      
      expect(Array.isArray(hints)).toBe(true)
      expect(hints.length).toBeLessThanOrEqual(count)
      
      // All hints should start with the specified letter
      hints.forEach(word => {
        expect(word.toLowerCase().startsWith(letter.toLowerCase())).toBe(true)
      })
    })
  })

  describe('Round Generation Integration', () => {
    it('should generate rounds using advanced category generation system', () => {
      const round = wordManager.generateRound('default')
      
      expect(round).toBeDefined()
      expect(round.category).toBeDefined()
      expect(round.letter).toBeDefined()
      expect(round.difficulty).toBeDefined()
      expect(round.playability).toBeDefined()
      expect(round.roundConfig).toBeDefined()
      expect(round.metadata).toBeDefined()
      
      // Should use advanced generation when available
      if (wordManager.generationSystemEnabled) {
        expect(round.metadata.generationType).toBe('advanced')
      }
    })

    it('should generate multiple rounds with variety', () => {
      const rounds = wordManager.generateRounds(5, 'default', { ensureUnique: true })
      
      expect(rounds).toHaveLength(5)
      
      // Check for variety in categories and letters
      const categories = new Set(rounds.map(r => r.category.id))
      const letters = new Set(rounds.map(r => r.letter))
      
      expect(categories.size).toBeGreaterThan(1) // Should have variety
      expect(letters.size).toBeGreaterThan(1) // Should have variety
    })

    it('should fallback to basic generation when advanced system fails', () => {
      // Disable generation system
      wordManager.generationSystemEnabled = false
      wordManager.combinationGenerator = null
      
      const round = wordManager.generateRound('default')
      
      expect(round).toBeDefined()
      expect(gracefulDegradation.isDegradationActive('generation_system_failed')).toBe(true)
    })

    it('should use emergency generation when all systems fail', () => {
      // Disable everything
      wordManager.generationSystemEnabled = false
      wordManager.combinationGenerator = null
      wordManager.categories = []
      
      const round = wordManager.generateRound('default')
      
      expect(round).toBeDefined()
      expect(round.category).toBeDefined()
      expect(round.letter).toBeDefined()
    })
  })

  describe('Configuration Integration', () => {
    it('should provide round configurations from both legacy and new systems', () => {
      const legacyConfigs = wordManager.getLegacyRoundConfigurations()
      const newConfigs = wordManager.getRoundConfigurations()
      
      expect(legacyConfigs).toBeDefined()
      expect(newConfigs).toBeDefined()
      
      // Both should have default configuration
      expect(legacyConfigs.default).toBeDefined()
      expect(newConfigs.default).toBeDefined()
    })

    it('should handle round configuration requests for all types', () => {
      const defaultConfig = wordManager.getRoundConfiguration('default')
      const quickConfig = wordManager.getRoundConfiguration('quick')
      const challengeConfig = wordManager.getRoundConfiguration('challenge')
      
      expect(defaultConfig).toBeDefined()
      expect(quickConfig).toBeDefined()
      expect(challengeConfig).toBeDefined()
      
      // Configurations should have required properties
      expect(defaultConfig.duration).toBeDefined()
      expect(defaultConfig.difficulty).toBeDefined()
      expect(defaultConfig.targetWordCount).toBeDefined()
    })
  })

  describe('Statistics and Monitoring Integration', () => {
    it('should provide advanced statistics including generation system data', () => {
      const stats = wordManager.getAdvancedStatistics()
      
      expect(stats).toBeDefined()
      expect(stats.totalCategories).toBeDefined()
      expect(stats.totalWords).toBeDefined()
      expect(stats.generationSystem).toBeDefined()
      expect(stats.degradation).toBeDefined()
      
      if (wordManager.generationSystemEnabled) {
        expect(stats.generationSystem.enabled).toBe(true)
        expect(stats.generationSystem.categoryManager).toBeDefined()
        expect(stats.generationSystem.letterGenerator).toBeDefined()
        expect(stats.generationSystem.combinationGenerator).toBeDefined()
      }
    })

    it('should perform health checks and report system status', async () => {
      const healthCheck = await wordManager.performHealthCheck()
      
      expect(healthCheck).toBeDefined()
      expect(healthCheck.health).toBeDefined()
      expect(healthCheck.degradation).toBeDefined()
      
      // If recovery is possible, recovery results should be included
      if (healthCheck.recovery) {
        expect(typeof healthCheck.recovery).toBe('object')
      }
    })

    it('should provide user-friendly system status messages', () => {
      const systemStatus = wordManager.getSystemStatus()
      
      expect(systemStatus).toBeDefined()
      expect(systemStatus.status).toBeDefined()
      expect(systemStatus.message).toBeDefined()
      expect(Array.isArray(systemStatus.userMessages)).toBe(true)
      expect(typeof systemStatus.canRecover).toBe('boolean')
      
      // Status should be one of expected values
      expect(['healthy', 'warning', 'degraded']).toContain(systemStatus.status)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle CategoryDataManager errors gracefully', async () => {
      // Mock CategoryDataManager to throw error
      const originalMethod = wordManager.categoryDataManager.getCategoryById
      wordManager.categoryDataManager.getCategoryById = vi.fn().mockImplementation(() => {
        throw new Error('Category not found')
      })
      
      // Should not crash the word manager
      const result = wordManager.validateWordWithContext('test', 'invalid', 'T')
      
      expect(result).toBeDefined()
      expect(result.valid).toBe(false)
      
      // Restore original method
      wordManager.categoryDataManager.getCategoryById = originalMethod
    })

    it('should handle LetterGenerator errors gracefully', () => {
      // Test with invalid letter
      const enhancedScore = wordManager.calculateEnhancedScore('test', 'animals', null)
      
      // Should fallback to basic score
      const basicScore = wordManager.calculateWordScore('test', 'animals')
      expect(enhancedScore).toBe(basicScore)
    })

    it('should handle storage errors during word addition', async () => {
      // Mock storage to fail
      mockStorageManager.saveWordCache = vi.fn().mockRejectedValue(new Error('Storage full'))
      
      const result = await wordManager.addWordToCategory('animals', 'zebra', 'medium')
      
      // Should handle gracefully
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Performance Integration', () => {
    it('should maintain performance requirements for round generation', () => {
      const startTime = performance.now()
      
      wordManager.generateRound('default')
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should meet sub-100ms requirement
      expect(duration).toBeLessThan(100)
    })

    it('should maintain performance for batch round generation', () => {
      const startTime = performance.now()
      
      wordManager.generateRounds(10, 'default')
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should be reasonable for batch generation
      expect(duration).toBeLessThan(500) // 50ms per round average
    })

    it('should cache data efficiently across managers', () => {
      // Generate some rounds to populate caches
      wordManager.generateRounds(5)
      
      // Subsequent generations should be faster
      const startTime = performance.now()
      
      wordManager.generateRound('default')
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(50) // Should be faster with cache
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing word validation', () => {
      const testCases = [
        { word: 'cat', category: 'animals', expected: true },
        { word: 'apple', category: 'foods', expected: true },
        { word: 'red', category: 'colors', expected: true },
        { word: 'invalid', category: 'animals', expected: false }
      ]
      
      testCases.forEach(({ word, category, expected }) => {
        const isValid = wordManager.validateWord(word, category)
        expect(isValid).toBe(expected)
      })
    })

    it('should maintain compatibility with existing category access', () => {
      const allCategories = wordManager.getAllCategories()
      const categoriesByDifficulty = wordManager.getCategoriesByDifficulty('easy')
      const randomCategory = wordManager.getRandomCategory()
      
      expect(Array.isArray(allCategories)).toBe(true)
      expect(Array.isArray(categoriesByDifficulty)).toBe(true)
      expect(randomCategory).toBeDefined()
      
      if (randomCategory) {
        expect(randomCategory.id).toBeDefined()
        expect(randomCategory.name).toBeDefined()
      }
    })

    it('should maintain compatibility with existing scoring system', () => {
      const testWords = ['cat', 'elephant', 'dog']
      
      testWords.forEach(word => {
        const score = wordManager.calculateWordScore(word, 'animals')
        expect(typeof score).toBe('number')
        expect(score).toBeGreaterThan(0)
      })
    })

    it('should maintain existing debug and statistics interfaces', () => {
      const stats = wordManager.getStatistics()
      const debugInfo = wordManager.getDebugInfo()
      
      expect(stats).toBeDefined()
      expect(debugInfo).toBeDefined()
      
      // Should have expected properties
      expect(stats.totalCategories).toBeDefined()
      expect(stats.totalWords).toBeDefined()
      expect(debugInfo.wordDatabaseKeys).toBeDefined()
    })
  })
})