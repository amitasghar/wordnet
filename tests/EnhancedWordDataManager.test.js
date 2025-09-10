import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Enhanced WordDataManager', () => {
  let wordDataManager
  let mockStorageManager

  beforeEach(() => {
    // Mock StorageManager
    mockStorageManager = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(true),
      loadWordCache: vi.fn().mockResolvedValue(null),
      saveWordCache: vi.fn().mockResolvedValue(true),
      has: vi.fn().mockReturnValue(false),
      get: vi.fn().mockReturnValue(null),
      set: vi.fn().mockResolvedValue(true)
    }

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Enhanced Round Generation', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      wordDataManager = new WordDataManager(mockStorageManager)
      await wordDataManager.init()
    })

    it('should generate enhanced rounds with new system', () => {
      const round = wordDataManager.generateRound('default')
      
      expect(round).toBeDefined()
      expect(round.category).toBeDefined()
      expect(round.letter).toBeDefined()
      expect(round.difficulty).toBeGreaterThan(0)
      expect(round.playability).toBeDefined()
      expect(round.roundConfig).toBeDefined()
      expect(round.metadata).toBeDefined()
      
      // Check metadata indicates advanced generation
      if (wordDataManager.generationSystemEnabled) {
        expect(round.metadata.generationType).toBe('advanced')
      } else {
        expect(round.metadata.generationType).toBe('legacy')
      }
    })

    it('should generate multiple rounds with variety', () => {
      const rounds = wordDataManager.generateRounds(3, 'default')
      
      expect(rounds.length).toBe(3)
      
      rounds.forEach(round => {
        expect(round).toBeDefined()
        expect(round.category).toBeDefined()
        expect(round.letter).toBeDefined()
        expect(round.metadata).toBeDefined()
      })
      
      // Should have some variety in categories or letters
      const categories = new Set(rounds.map(r => r.category.id))
      const letters = new Set(rounds.map(r => r.letter))
      
      expect(categories.size + letters.size).toBeGreaterThan(2) // Some variety
    })

    it('should support different round types', () => {
      const defaultRound = wordDataManager.generateRound('default')
      const quickRound = wordDataManager.generateRound('quick')
      
      expect(defaultRound.roundConfig.duration).toBeGreaterThanOrEqual(60)
      expect(quickRound.roundConfig.duration).toBeLessThanOrEqual(90)
      
      // Quick rounds should be shorter
      expect(quickRound.roundConfig.duration).toBeLessThanOrEqual(defaultRound.roundConfig.duration)
    })
  })

  describe('Enhanced Word Validation', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      wordDataManager = new WordDataManager(mockStorageManager)
      await wordDataManager.init()
    })

    it('should validate words with context', () => {
      const categoryId = 'animals'
      const word = 'cat'
      const letter = 'C'
      
      const result = wordDataManager.validateWordWithContext(word, categoryId, letter)
      
      expect(result).toBeDefined()
      expect(result.valid).toBe(true)
      expect(result.score).toBeGreaterThan(0)
      expect(result.metadata).toBeDefined()
      expect(result.metadata.letter).toBe(letter)
    })

    it('should reject words that dont start with specified letter', () => {
      const categoryId = 'animals'
      const word = 'cat'
      const letter = 'D' // Wrong letter
      
      const result = wordDataManager.validateWordWithContext(word, categoryId, letter)
      
      if (wordDataManager.generationSystemEnabled) {
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('must start with letter')
        expect(result.metadata.expectedLetter).toBe(letter)
      } else {
        // Legacy system doesn't check letter constraints
        expect(result.valid).toBe(true)
      }
    })

    it('should calculate enhanced scores for rare letters', () => {
      const categoryId = 'animals'
      const commonWord = 'cat'
      const rareLetterWord = 'cat' // Pretend this starts with a rare letter
      
      const commonResult = wordDataManager.validateWordWithContext(commonWord, categoryId, 'C')
      const rareResult = wordDataManager.validateWordWithContext(rareLetterWord, categoryId, 'Q')
      
      expect(commonResult.score).toBeGreaterThan(0)
      expect(rareResult.score).toBeGreaterThan(0)
      
      // Enhanced system should give bonus for rare letters
      if (wordDataManager.generationSystemEnabled) {
        expect(rareResult.metadata.enhancedScore).toBeDefined()
      }
    })

    it('should provide word hints for category-letter combinations', () => {
      const categoryId = 'animals'
      const letter = 'C'
      
      const hints = wordDataManager.getWordHints(categoryId, letter, 3)
      
      expect(Array.isArray(hints)).toBe(true)
      
      if (hints.length > 0) {
        hints.forEach(hint => {
          expect(typeof hint).toBe('string')
          expect(hint.toLowerCase().startsWith(letter.toLowerCase())).toBe(true)
        })
      }
    })
  })

  describe('Round Configuration Management', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      wordDataManager = new WordDataManager(mockStorageManager)
      await wordDataManager.init()
    })

    it('should get round configurations', () => {
      const configs = wordDataManager.getRoundConfigurations()
      
      expect(configs).toBeDefined()
      expect(configs.default).toBeDefined()
      expect(configs.quick).toBeDefined()
      
      expect(configs.default.duration).toBeGreaterThan(0)
      expect(configs.default.difficulty).toBeGreaterThan(0)
      expect(configs.default.targetWordCount).toBeGreaterThan(0)
    })

    it('should get specific round configuration', () => {
      const defaultConfig = wordDataManager.getRoundConfiguration('default')
      const quickConfig = wordDataManager.getRoundConfiguration('quick')
      
      expect(defaultConfig).toBeDefined()
      expect(quickConfig).toBeDefined()
      
      expect(quickConfig.duration).toBeLessThanOrEqual(defaultConfig.duration)
    })

    it('should fallback to default for invalid round type', () => {
      const invalidConfig = wordDataManager.getRoundConfiguration('invalid')
      const defaultConfig = wordDataManager.getRoundConfiguration('default')
      
      expect(invalidConfig).toEqual(defaultConfig)
    })
  })

  describe('Advanced Statistics', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      wordDataManager = new WordDataManager(mockStorageManager)
      await wordDataManager.init()
    })

    it('should provide advanced statistics', () => {
      const stats = wordDataManager.getAdvancedStatistics()
      
      expect(stats).toBeDefined()
      expect(stats.totalCategories).toBeGreaterThan(0)
      expect(stats.totalWords).toBeGreaterThan(0)
      expect(stats.generationSystem).toBeDefined()
      expect(stats.generationSystem.enabled).toBeDefined()
    })

    it('should include generation system stats when enabled', () => {
      const stats = wordDataManager.getAdvancedStatistics()
      
      if (wordDataManager.generationSystemEnabled) {
        expect(stats.generationSystem.enabled).toBe(true)
        expect(stats.generationSystem.categoryManager).toBeDefined()
        expect(stats.generationSystem.letterGenerator).toBeDefined()
        expect(stats.generationSystem.combinationGenerator).toBeDefined()
      } else {
        expect(stats.generationSystem.enabled).toBe(false)
        expect(stats.generationSystem.reason).toBeDefined()
      }
    })

    it('should provide debug information with generation system details', () => {
      const debugInfo = wordDataManager.getDebugInfo()
      
      expect(debugInfo).toBeDefined()
      expect(debugInfo.generationSystemEnabled).toBeDefined()
      
      if (wordDataManager.generationSystemEnabled) {
        expect(debugInfo.generationSystemStats).toBeDefined()
        expect(debugInfo.generationSystemStats.categoryManager).toBeDefined()
      }
    })
  })

  describe('Legacy Compatibility', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      wordDataManager = new WordDataManager(mockStorageManager)
      await wordDataManager.init()
    })

    it('should maintain backward compatibility with existing API', () => {
      // Test that all existing methods still work
      expect(typeof wordDataManager.validateWord).toBe('function')
      expect(typeof wordDataManager.calculateWordScore).toBe('function')
      expect(typeof wordDataManager.getCategory).toBe('function')
      expect(typeof wordDataManager.getRandomCategory).toBe('function')
      expect(typeof wordDataManager.getAllCategories).toBe('function')
      expect(typeof wordDataManager.getCategoryWords).toBe('function')
      
      // Test that they return expected values
      const categories = wordDataManager.getAllCategories()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      
      const randomCategory = wordDataManager.getRandomCategory()
      expect(randomCategory).toBeDefined()
      expect(randomCategory.id).toBeDefined()
      expect(randomCategory.name).toBeDefined()
    })

    it('should handle legacy difficulty mapping', () => {
      // Test difficulty conversion
      expect(wordDataManager.mapLegacyDifficultyToNumeric('easy')).toBe(2)
      expect(wordDataManager.mapLegacyDifficultyToNumeric('medium')).toBe(3)
      expect(wordDataManager.mapLegacyDifficultyToNumeric('hard')).toBe(4)
      
      expect(wordDataManager.mapNumericDifficultyToLegacy(1)).toBe('easy')
      expect(wordDataManager.mapNumericDifficultyToLegacy(3)).toBe('medium')
      expect(wordDataManager.mapNumericDifficultyToLegacy(5)).toBe('hard')
    })

    it('should provide category icons for legacy compatibility', () => {
      const icon = wordDataManager.getCategoryIcon('animals')
      expect(typeof icon).toBe('string')
      expect(icon.length).toBeGreaterThan(0)
      
      const defaultIcon = wordDataManager.getCategoryIcon('unknown')
      expect(defaultIcon).toBe('📝')
    })
  })

  describe('Performance and Error Handling', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      wordDataManager = new WordDataManager(mockStorageManager)
      await wordDataManager.init()
    })

    it('should handle round generation errors gracefully', () => {
      // Mock system as disabled to test fallback
      const originalEnabled = wordDataManager.generationSystemEnabled
      wordDataManager.generationSystemEnabled = false
      
      const round = wordDataManager.generateRound('default')
      
      expect(round).toBeDefined()
      expect(round.metadata.generationType).toBe('legacy')
      
      // Restore original state
      wordDataManager.generationSystemEnabled = originalEnabled
    })

    it('should maintain performance requirements', () => {
      const startTime = performance.now()
      
      // Generate round
      const round = wordDataManager.generateRound('default')
      
      // Validate word
      wordDataManager.validateWordWithContext('cat', 'animals', 'C')
      
      // Get statistics
      wordDataManager.getAdvancedStatistics()
      
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(200) // 200ms for full operation
      expect(round).toBeDefined()
    })

    it('should handle bulk operations efficiently', () => {
      const startTime = performance.now()
      
      // Generate multiple rounds
      const rounds = wordDataManager.generateRounds(5, 'default')
      
      // Validate multiple words
      for (let i = 0; i < 5; i++) {
        wordDataManager.validateWordWithContext('test', 'animals', 'T')
      }
      
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(500) // 500ms for bulk operations
      expect(rounds.length).toBe(5)
    })
  })
})