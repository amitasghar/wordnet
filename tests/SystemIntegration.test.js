import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('System Integration Tests', () => {
  let wordDataManager
  let categoryDataManager
  let letterGenerator
  let combinationGenerator
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

  describe('WordDataManager Integration', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')

      wordDataManager = new WordDataManager(mockStorageManager)
      categoryDataManager = new CategoryDataManager(mockStorageManager)
      letterGenerator = new LetterGenerator(categoryDataManager)
      combinationGenerator = new CombinationGenerator(categoryDataManager, letterGenerator)

      await wordDataManager.init()
      await categoryDataManager.init()
      await letterGenerator.init()
      await combinationGenerator.init()
    })

    it('should have compatible category structures', () => {
      const wordCategories = wordDataManager.getAllCategories()
      const newCategories = categoryDataManager.getAllCategories()

      expect(wordCategories.length).toBeGreaterThan(0)
      expect(newCategories.length).toBeGreaterThan(0)

      // Check if categories have compatible IDs
      const wordCategoryIds = new Set(wordCategories.map(c => c.id))
      const newCategoryIds = new Set(newCategories.map(c => c.id))
      
      // Should have some overlap in category IDs
      const intersection = new Set([...wordCategoryIds].filter(id => newCategoryIds.has(id)))
      expect(intersection.size).toBeGreaterThan(0)
    })

    it('should validate words using both systems', () => {
      const categoryId = 'animals'
      const testWord = 'cat'

      // Test with existing WordDataManager
      const isValidOld = wordDataManager.validateWord(testWord, categoryId)
      
      // Test with new CategoryDataManager (should have the category)
      const category = categoryDataManager.getCategoryById(categoryId)
      const isCompatible = category && category.words.includes(testWord)

      expect(isValidOld).toBe(true)
      expect(isCompatible).toBe(true)
    })

    it('should generate combinations with valid categories', () => {
      const combination = combinationGenerator.generateCombination()

      expect(combination).toBeDefined()
      expect(combination.category).toBeDefined()
      expect(combination.letter).toBeDefined()

      // Check if the generated category exists in WordDataManager
      const wordCategory = wordDataManager.getCategory(combination.category.id)
      expect(wordCategory).toBeDefined()
    })

    it('should calculate scores consistently', () => {
      const categoryId = 'animals'
      const testWord = 'cat'

      // Get score from WordDataManager
      const oldScore = wordDataManager.calculateWordScore(testWord, categoryId)

      // Get score from CombinationGenerator's playability assessment
      const playability = combinationGenerator.assessPlayability(categoryId, 'C')

      expect(oldScore).toBeGreaterThan(0)
      expect(playability.score).toBeGreaterThan(0)
    })

    it('should handle category difficulty mapping', () => {
      const wordCategories = wordDataManager.getAllCategories()

      for (const wordCat of wordCategories) {
        const newCat = categoryDataManager.getCategoryById(wordCat.id)
        
        if (newCat) {
          // Both should have difficulty information
          expect(wordCat.difficulty).toBeDefined()
          expect(newCat.difficulty).toBeDefined()
          
          // Difficulty should be within valid range
          expect(newCat.difficulty).toBeGreaterThanOrEqual(1)
          expect(newCat.difficulty).toBeLessThanOrEqual(5)
        }
      }
    })
  })

  describe('Game Flow Integration', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')

      wordDataManager = new WordDataManager(mockStorageManager)
      categoryDataManager = new CategoryDataManager(mockStorageManager)
      letterGenerator = new LetterGenerator(categoryDataManager)
      combinationGenerator = new CombinationGenerator(categoryDataManager, letterGenerator)

      await wordDataManager.init()
      await categoryDataManager.init()
      await letterGenerator.init()
      await combinationGenerator.init()
    })

    it('should simulate complete round generation and validation', () => {
      // Generate a round
      const combination = combinationGenerator.generateCombination()
      
      expect(combination).toBeDefined()
      expect(combination.category.id).toBeDefined()
      expect(combination.letter).toBeDefined()

      // Simulate word validation during gameplay
      const categoryId = combination.category.id
      const letter = combination.letter
      
      // Find words in the category that start with the letter
      const categoryWords = wordDataManager.getCategoryWords(categoryId)
      const validWords = categoryWords.filter(word => 
        word.toLowerCase().startsWith(letter.toLowerCase())
      )

      // Should be able to validate these words
      for (const word of validWords.slice(0, 3)) { // Test first 3 words
        const isValid = wordDataManager.validateWord(word, categoryId)
        expect(isValid).toBe(true)

        const score = wordDataManager.calculateWordScore(word, categoryId)
        expect(score).toBeGreaterThan(0)
      }
    })

    it('should handle round timing and configuration', () => {
      const roundConfig = combinationGenerator.getRoundConfig('default')
      
      expect(roundConfig).toBeDefined()
      expect(roundConfig.duration).toBeGreaterThanOrEqual(60)
      expect(roundConfig.duration).toBeLessThanOrEqual(90)
      expect(roundConfig.targetWordCount).toBeGreaterThan(0)
      expect(roundConfig.scoring).toBeDefined()
    })

    it('should generate multiple unique rounds', () => {
      const availableCategories = categoryDataManager.getAllCategories()
      
      // Should have at least 3 categories available
      expect(availableCategories.length).toBeGreaterThanOrEqual(3)
      
      const rounds = combinationGenerator.generateBatch(3, 'default', { ensureUnique: true })
      
      // Should get at least 2 rounds even if unique constraint causes issues
      expect(rounds.length).toBeGreaterThanOrEqual(2)
      
      const categoryIds = rounds.map(r => r.category.id)
      const uniqueCategoryIds = new Set(categoryIds)
      
      // Should have unique categories (or at least try to)
      expect(uniqueCategoryIds.size).toBe(rounds.length)
      
      // Each round should be valid
      rounds.forEach(round => {
        const wordCategory = wordDataManager.getCategory(round.category.id)
        expect(wordCategory).toBeDefined()
      })
    })

    it('should maintain performance requirements in integrated system', () => {
      const startTime = performance.now()
      
      // Generate a combination
      const combination = combinationGenerator.generateCombination()
      
      // Validate a word
      const categoryWords = wordDataManager.getCategoryWords(combination.category.id)
      if (categoryWords.length > 0) {
        wordDataManager.validateWord(categoryWords[0], combination.category.id)
      }
      
      // Calculate a score
      if (categoryWords.length > 0) {
        wordDataManager.calculateWordScore(categoryWords[0], combination.category.id)
      }
      
      const endTime = performance.now()
      
      // Total operation should be fast
      expect(endTime - startTime).toBeLessThan(150) // 150ms for full integration
    })
  })

  describe('Data Consistency', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')

      wordDataManager = new WordDataManager(mockStorageManager)
      categoryDataManager = new CategoryDataManager(mockStorageManager)
      letterGenerator = new LetterGenerator(categoryDataManager)
      combinationGenerator = new CombinationGenerator(categoryDataManager, letterGenerator)

      await wordDataManager.init()
      await categoryDataManager.init()
      await letterGenerator.init()
      await combinationGenerator.init()
    })

    it('should have consistent category names and IDs', () => {
      const wordCategories = wordDataManager.getAllCategories()
      
      wordCategories.forEach(wordCat => {
        const newCat = categoryDataManager.getCategoryById(wordCat.id)
        
        if (newCat) {
          // Names should be consistent (case-insensitive)
          expect(newCat.name.toLowerCase()).toBe(wordCat.name.toLowerCase())
        }
      })
    })

    it('should have compatible word data structures', () => {
      const categoryId = 'animals'
      
      // Get words from both systems
      const wordDataWords = wordDataManager.getCategoryWords(categoryId)
      const categoryDataCategory = categoryDataManager.getCategoryById(categoryId)
      
      expect(wordDataWords.length).toBeGreaterThan(0)
      expect(categoryDataCategory).toBeDefined()
      expect(categoryDataCategory.words.length).toBeGreaterThan(0)
      
      // Check for some common words
      const commonWords = wordDataWords.filter(word => 
        categoryDataCategory.words.includes(word)
      )
      
      expect(commonWords.length).toBeGreaterThan(0)
    })

    it('should handle difficulty mapping between systems', () => {
      const wordCategories = wordDataManager.getAllCategories()
      
      wordCategories.forEach(wordCat => {
        const newCat = categoryDataManager.getCategoryById(wordCat.id)
        
        if (newCat) {
          // Map old difficulty system to new numeric system
          const difficultyMap = {
            'easy': 1,
            'medium': 3,
            'hard': 5
          }
          
          const expectedDifficulty = difficultyMap[wordCat.difficulty]
          
          // Should be within reasonable range of expected difficulty
          expect(Math.abs(newCat.difficulty - expectedDifficulty)).toBeLessThanOrEqual(1)
        }
      })
    })

    it('should maintain letter compatibility with word validation', () => {
      const categoryId = 'animals'
      const category = categoryDataManager.getCategoryById(categoryId)
      const wordDataWords = wordDataManager.getCategoryWords(categoryId)
      
      if (category && wordDataWords.length > 0) {
        // Check if letter compatibility makes sense with actual words
        const compatibility = category.metadata.letterCompatibility
        const firstLetters = new Set(wordDataWords.map(word => word[0].toUpperCase()))
        
        // Compatibility should include letters that actually start words
        const validCompatibility = Array.from(firstLetters).filter(letter => 
          compatibility.includes(letter)
        )
        
        expect(validCompatibility.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      const { CombinationGenerator } = await import('../src/managers/CombinationGenerator.js')

      wordDataManager = new WordDataManager(mockStorageManager)
      categoryDataManager = new CategoryDataManager(mockStorageManager)
      letterGenerator = new LetterGenerator(categoryDataManager)
      combinationGenerator = new CombinationGenerator(categoryDataManager, letterGenerator)

      await wordDataManager.init()
      await categoryDataManager.init()
      await letterGenerator.init()
      await combinationGenerator.init()
    })

    it('should handle missing categories gracefully', () => {
      const invalidCategoryId = 'nonexistent-category'
      
      // Both systems should handle missing categories
      const wordCategory = wordDataManager.getCategory(invalidCategoryId)
      const newCategory = categoryDataManager.getCategoryById(invalidCategoryId)
      
      expect(wordCategory).toBeNull()
      expect(newCategory).toBeNull()
      
      // Word validation should fail gracefully
      const isValid = wordDataManager.validateWord('test', invalidCategoryId)
      expect(isValid).toBe(false)
    })

    it('should handle storage errors consistently', async () => {
      // Mock storage errors
      mockStorageManager.load.mockRejectedValue(new Error('Storage error'))
      mockStorageManager.save.mockRejectedValue(new Error('Storage error'))
      
      // Both systems should handle storage errors gracefully
      const { WordDataManager } = await import('../src/managers/WordDataManager.js')
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      
      const newWordManager = new WordDataManager(mockStorageManager)
      const newCategoryManager = new CategoryDataManager(mockStorageManager)
      
      // Should not throw errors during initialization
      await expect(newWordManager.init()).resolves.not.toThrow()
      await expect(newCategoryManager.init()).resolves.not.toThrow()
      
      // Should still have some default data
      expect(newWordManager.getAllCategories().length).toBeGreaterThan(0)
      expect(newCategoryManager.getAllCategories().length).toBeGreaterThan(0)
    })

    it('should maintain system stability during high load', () => {
      const operations = []
      
      // Simulate multiple concurrent operations
      for (let i = 0; i < 50; i++) {
        operations.push(() => {
          const combination = combinationGenerator.generateCombination()
          const words = wordDataManager.getCategoryWords(combination.category.id)
          if (words.length > 0) {
            wordDataManager.validateWord(words[0], combination.category.id)
          }
        })
      }
      
      // Execute all operations
      expect(() => {
        operations.forEach(op => op())
      }).not.toThrow()
    })
  })
})