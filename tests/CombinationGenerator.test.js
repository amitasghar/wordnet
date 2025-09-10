import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('CombinationGenerator', () => {
  let combinationGenerator
  let mockCategoryManager
  let mockLetterGenerator

  beforeEach(() => {
    // Mock CategoryDataManager
    mockCategoryManager = {
      getCategoryById: vi.fn(),
      getRandomCategory: vi.fn(),
      getCategoriesByDifficulty: vi.fn(),
      getCategoriesByLetter: vi.fn(),
      getAllCategories: vi.fn()
    }

    // Mock LetterGenerator
    mockLetterGenerator = {
      generate: vi.fn(),
      generateForCategory: vi.fn(),
      getLetterRarityScore: vi.fn(),
      isVowel: vi.fn(),
      getStats: vi.fn()
    }

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should create CombinationGenerator instance', async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      
      expect(combinationGenerator).toBeDefined()
      expect(combinationGenerator.categoryManager).toBe(mockCategoryManager)
      expect(combinationGenerator.letterGenerator).toBe(mockLetterGenerator)
    })

    it('should initialize with default round configurations', async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      
      await combinationGenerator.init()
      
      expect(combinationGenerator.roundConfigs).toBeDefined()
      expect(combinationGenerator.roundConfigs.default).toBeDefined()
      expect(combinationGenerator.roundConfigs.quick).toBeDefined()
      expect(combinationGenerator.roundConfigs.challenge).toBeDefined()
    })

    it('should have valid round configuration structure', async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      
      await combinationGenerator.init()
      
      const defaultConfig = combinationGenerator.roundConfigs.default
      expect(defaultConfig).toHaveProperty('duration')
      expect(defaultConfig).toHaveProperty('difficulty')
      expect(defaultConfig).toHaveProperty('targetWordCount')
      expect(defaultConfig).toHaveProperty('scoring')
      expect(defaultConfig.duration).toBeGreaterThanOrEqual(60)
      expect(defaultConfig.duration).toBeLessThanOrEqual(90)
    })
  })

  describe('CombinationValidator', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
      
      // Mock category data
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'animals',
        name: 'Animals',
        difficulty: 2,
        words: ['cat', 'dog', 'bird', 'fish'],
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'D', 'F'],
          tags: ['nature'],
          theme: 'Living creatures',
          estimatedWords: 50,
          averageWordLength: 5
        }
      })
    })

    it('should validate category-letter compatibility', () => {
      const isValid = combinationGenerator.validateCombination('animals', 'C')
      expect(mockCategoryManager.getCategoryById).toHaveBeenCalledWith('animals')
      expect(isValid).toBe(true)
    })

    it('should reject incompatible category-letter pairs', () => {
      const isValid = combinationGenerator.validateCombination('animals', 'X')
      expect(isValid).toBe(false)
    })

    it('should handle missing category gracefully', () => {
      mockCategoryManager.getCategoryById.mockReturnValue(null)
      
      const isValid = combinationGenerator.validateCombination('invalid', 'A')
      expect(isValid).toBe(false)
    })

    it('should calculate difficulty score for combinations', () => {
      mockLetterGenerator.getLetterRarityScore.mockReturnValue(3)
      
      const score = combinationGenerator.calculateDifficultyScore('animals', 'C')
      
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(10)
      expect(mockLetterGenerator.getLetterRarityScore).toHaveBeenCalledWith('C')
    })

    it('should assess playability of combinations', () => {
      const playability = combinationGenerator.assessPlayability('animals', 'C')
      
      expect(playability).toHaveProperty('score')
      expect(playability).toHaveProperty('estimatedWords')
      expect(playability).toHaveProperty('difficulty')
      expect(playability).toHaveProperty('feasible')
      expect(playability.score).toBeGreaterThanOrEqual(0)
      expect(playability.score).toBeLessThanOrEqual(10)
    })

    it('should identify unfeasible combinations', () => {
      // Mock a category with very limited words starting with the letter
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'limited',
        name: 'Limited',
        difficulty: 5,
        words: ['zebra'], // Only one word
        metadata: {
          letterCompatibility: ['Z'],
          estimatedWords: 1,
          averageWordLength: 5
        }
      })
      
      const playability = combinationGenerator.assessPlayability('limited', 'Z')
      expect(playability.feasible).toBe(false)
    })
  })

  describe('Round Configuration System', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
    })

    it('should provide different round configurations', () => {
      const configs = combinationGenerator.getRoundConfigurations()
      
      expect(configs).toHaveProperty('default')
      expect(configs).toHaveProperty('quick')
      expect(configs).toHaveProperty('challenge')
      
      expect(configs.quick.duration).toBeLessThan(configs.default.duration)
      expect(configs.challenge.difficulty).toBeGreaterThan(configs.default.difficulty)
    })

    it('should get round configuration by name', () => {
      const quickConfig = combinationGenerator.getRoundConfig('quick')
      
      expect(quickConfig).toBeDefined()
      expect(quickConfig.duration).toBeLessThanOrEqual(75)
    })

    it('should return default config for invalid name', () => {
      const config = combinationGenerator.getRoundConfig('invalid')
      const defaultConfig = combinationGenerator.getRoundConfig('default')
      
      expect(config).toEqual(defaultConfig)
    })

    it('should support custom round configurations', () => {
      const customConfig = {
        duration: 45,
        difficulty: 4,
        targetWordCount: 8,
        scoring: { basePoints: 15 }
      }
      
      combinationGenerator.addRoundConfig('custom', customConfig)
      const retrieved = combinationGenerator.getRoundConfig('custom')
      
      expect(retrieved).toEqual(customConfig)
    })

    it('should validate round configuration structure', () => {
      const validConfig = {
        duration: 60,
        difficulty: 3,
        targetWordCount: 10,
        scoring: { basePoints: 10 }
      }
      
      const invalidConfig = {
        duration: 'invalid'
      }
      
      expect(combinationGenerator.validateRoundConfig(validConfig)).toBe(true)
      expect(combinationGenerator.validateRoundConfig(invalidConfig)).toBe(false)
    })
  })

  describe('Combination Generation', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
      
      // Setup mock returns
      mockCategoryManager.getRandomCategory.mockReturnValue({
        id: 'animals',
        name: 'Animals',
        difficulty: 2,
        metadata: { letterCompatibility: ['A', 'B', 'C'] }
      })
      
      mockLetterGenerator.generateForCategory.mockReturnValue('A')
      mockLetterGenerator.generate.mockReturnValue('T')
    })

    it('should generate valid category-letter combinations', () => {
      const combination = combinationGenerator.generateCombination()
      
      expect(combination).toHaveProperty('category')
      expect(combination).toHaveProperty('letter')
      expect(combination).toHaveProperty('difficulty')
      expect(combination).toHaveProperty('playability')
      expect(combination).toHaveProperty('roundConfig')
    })

    it('should generate combinations for specific round type', () => {
      const combination = combinationGenerator.generateCombination('quick')
      
      expect(combination.roundConfig.duration).toBeLessThanOrEqual(75)
    })

    it('should generate combinations with target difficulty', () => {
      const options = { targetDifficulty: 4 }
      const combination = combinationGenerator.generateCombination('default', options)
      
      expect(combination.difficulty).toBeGreaterThanOrEqual(3)
      expect(combination.difficulty).toBeLessThanOrEqual(5)
    })

    it('should retry generation for invalid combinations', () => {
      // Mock initial invalid combination, then valid one
      mockCategoryManager.getRandomCategory
        .mockReturnValueOnce({
          id: 'invalid',
          metadata: { letterCompatibility: [] }
        })
        .mockReturnValueOnce({
          id: 'animals',
          metadata: { letterCompatibility: ['A', 'B', 'C'] }
        })
      
      const combination = combinationGenerator.generateCombination()
      
      expect(combination).toBeDefined()
      // The implementation retries up to maxRetries times, so expect multiple calls
      expect(mockCategoryManager.getRandomCategory).toHaveBeenCalled()
      expect(mockCategoryManager.getRandomCategory.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle maximum retry limit', () => {
      // Mock all attempts as invalid
      mockCategoryManager.getRandomCategory.mockReturnValue({
        id: 'invalid',
        metadata: { letterCompatibility: [] }
      })
      
      const combination = combinationGenerator.generateCombination()
      
      // Should eventually return a fallback combination
      expect(combination).toBeDefined()
    })

    it('should generate combinations with letter preferences', () => {
      const options = { preferVowels: true }
      
      // Mock the category to have no letterCompatibility so it uses general generation
      mockCategoryManager.getRandomCategory.mockReturnValue({
        id: 'animals',
        name: 'Animals',
        metadata: { letterCompatibility: [] } // No constraints, will use general generation
      })
      
      mockLetterGenerator.generateForCategory.mockReturnValue(null) // Force fallback to general
      mockLetterGenerator.generate.mockReturnValue('A')
      
      const combination = combinationGenerator.generateCombination('default', options)
      
      // Should call generate method as fallback when generateForCategory returns null
      expect(mockLetterGenerator.generate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ preferVowels: true })
      )
    })
  })

  describe('Batch Generation', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
      
      mockCategoryManager.getRandomCategory.mockReturnValue({
        id: 'animals',
        name: 'Animals',
        metadata: { letterCompatibility: ['A', 'B', 'C'] }
      })
      
      mockLetterGenerator.generateForCategory.mockReturnValue('A')
    })

    it('should generate multiple unique combinations', () => {
      const combinations = combinationGenerator.generateBatch(5)
      
      expect(Array.isArray(combinations)).toBe(true)
      expect(combinations.length).toBe(5)
      
      combinations.forEach(combo => {
        expect(combo).toHaveProperty('category')
        expect(combo).toHaveProperty('letter')
      })
    })

    it('should ensure uniqueness in batch generation', () => {
      mockCategoryManager.getAllCategories.mockReturnValue([
        { id: 'animals', metadata: { letterCompatibility: ['A'] } },
        { id: 'foods', metadata: { letterCompatibility: ['B'] } },
        { id: 'colors', metadata: { letterCompatibility: ['C'] } }
      ])
      
      const combinations = combinationGenerator.generateBatch(3, 'default', { ensureUnique: true })
      
      const categoryIds = combinations.map(c => c.category.id)
      const uniqueIds = new Set(categoryIds)
      
      expect(uniqueIds.size).toBe(categoryIds.length) // All should be unique
    })

    it('should handle batch size larger than available categories', () => {
      mockCategoryManager.getAllCategories.mockReturnValue([
        { id: 'animals', metadata: { letterCompatibility: ['A'] } }
      ])
      
      const combinations = combinationGenerator.generateBatch(5, 'default', { ensureUnique: true })
      
      expect(combinations.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
      
      mockCategoryManager.getRandomCategory.mockReturnValue({
        id: 'animals',
        metadata: { letterCompatibility: ['A', 'B', 'C'] }
      })
      
      mockLetterGenerator.generateForCategory.mockReturnValue('A')
    })

    it('should generate combinations under 100ms', () => {
      const startTime = performance.now()
      combinationGenerator.generateCombination()
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should validate combinations under 10ms', () => {
      const startTime = performance.now()
      combinationGenerator.validateCombination('animals', 'A')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(10)
    })

    it('should handle bulk generation efficiently', () => {
      const startTime = performance.now()
      combinationGenerator.generateBatch(10)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(500) // 50ms per combination average
    })
  })

  describe('Error Handling and Fallbacks', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
    })

    it('should handle missing category manager gracefully', async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      const generator = new CombinationGenerator(null, mockLetterGenerator)
      
      await generator.init()
      const combination = generator.generateCombination()
      
      expect(combination).toBeDefined()
    })

    it('should handle missing letter generator gracefully', async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      const generator = new CombinationGenerator(mockCategoryManager, null)
      
      await generator.init()
      const combination = generator.generateCombination()
      
      expect(combination).toBeDefined()
    })

    it('should provide fallback combinations when generation fails', () => {
      mockCategoryManager.getRandomCategory.mockImplementation(() => {
        throw new Error('Category manager error')
      })
      
      const combination = combinationGenerator.generateCombination()
      
      expect(combination).toBeDefined()
      expect(combination.category).toBeDefined()
      expect(combination.letter).toBeDefined()
    })

    it('should handle corrupted round configurations', () => {
      combinationGenerator.roundConfigs.default = null
      
      const combination = combinationGenerator.generateCombination('default')
      
      expect(combination).toBeDefined()
      expect(combination.roundConfig).toBeDefined()
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')
      combinationGenerator = new CombinationGenerator(mockCategoryManager, mockLetterGenerator)
      await combinationGenerator.init()
      
      mockCategoryManager.getRandomCategory.mockReturnValue({
        id: 'animals',
        metadata: { letterCompatibility: ['A'] }
      })
      
      mockLetterGenerator.generateForCategory.mockReturnValue('A')
    })

    it('should track generation statistics', () => {
      combinationGenerator.generateCombination()
      combinationGenerator.generateCombination()
      combinationGenerator.generateCombination()
      
      const stats = combinationGenerator.getStats()
      
      expect(stats).toHaveProperty('totalGenerated')
      expect(stats).toHaveProperty('successRate')
      expect(stats).toHaveProperty('averageGenerationTime')
      expect(stats).toHaveProperty('difficultyDistribution')
      expect(stats.totalGenerated).toBeGreaterThanOrEqual(3)
    })

    it('should track combination quality metrics', () => {
      combinationGenerator.generateCombination()
      
      const stats = combinationGenerator.getStats()
      
      expect(stats).toHaveProperty('averageDifficulty')
      expect(stats).toHaveProperty('averagePlayability')
      expect(stats.averageDifficulty).toBeGreaterThan(0)
    })

    it('should reset statistics when requested', () => {
      combinationGenerator.generateCombination()
      combinationGenerator.generateCombination()
      
      let stats = combinationGenerator.getStats()
      expect(stats.totalGenerated).toBeGreaterThanOrEqual(2)
      
      combinationGenerator.resetStats()
      stats = combinationGenerator.getStats()
      expect(stats.totalGenerated).toBe(0)
    })
  })
})