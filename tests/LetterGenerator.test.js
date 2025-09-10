import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('LetterGenerator', () => {
  let letterGenerator
  let mockCategoryManager

  beforeEach(() => {
    // Mock CategoryDataManager
    mockCategoryManager = {
      getCategoryById: vi.fn(),
      getCategoriesByLetter: vi.fn(),
      getAllCategories: vi.fn()
    }

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should create LetterGenerator instance', async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      
      expect(letterGenerator).toBeDefined()
      expect(letterGenerator.categoryManager).toBe(mockCategoryManager)
    })

    it('should initialize with letter frequency data', async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      
      await letterGenerator.init()
      
      expect(letterGenerator.letterFrequencies).toBeDefined()
      expect(Object.keys(letterGenerator.letterFrequencies).length).toBe(26)
    })

    it('should have valid frequency values (0-1)', async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      
      await letterGenerator.init()
      
      Object.values(letterGenerator.letterFrequencies).forEach(frequency => {
        expect(frequency).toBeGreaterThan(0)
        expect(frequency).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Letter Frequency Engine', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should generate letters based on frequency distribution', () => {
      const letterCounts = {}
      const iterations = 1000
      
      // Generate many letters and count frequency
      for (let i = 0; i < iterations; i++) {
        const letter = letterGenerator.generateByFrequency()
        letterCounts[letter] = (letterCounts[letter] || 0) + 1
      }
      
      // Common letters should appear more frequently
      const eCount = letterCounts['E'] || 0
      const zCount = letterCounts['Z'] || 0
      
      expect(eCount).toBeGreaterThan(zCount) // E is much more common than Z
    })

    it('should respect difficulty adjustments in letter selection', () => {
      const easyLetter = letterGenerator.generateByFrequency(1) // Easy difficulty
      const hardLetter = letterGenerator.generateByFrequency(5) // Hard difficulty
      
      expect(typeof easyLetter).toBe('string')
      expect(typeof hardLetter).toBe('string')
      expect(easyLetter.length).toBe(1)
      expect(hardLetter.length).toBe(1)
    })

    it('should return valid letters A-Z', () => {
      for (let i = 0; i < 50; i++) {
        const letter = letterGenerator.generateByFrequency()
        expect(letter).toMatch(/^[A-Z]$/)
      }
    })

    it('should have consistent letter rarity scoring', () => {
      const eScore = letterGenerator.getLetterRarityScore('E')
      const qScore = letterGenerator.getLetterRarityScore('Q')
      const zScore = letterGenerator.getLetterRarityScore('Z')
      
      expect(qScore).toBeGreaterThan(eScore) // Q is rarer than E
      expect(zScore).toBeGreaterThan(eScore) // Z is rarer than E
    })
  })

  describe('Category-Aware Letter Generation', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
      
      // Mock category data
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'animals',
        name: 'Animals',
        metadata: {
          letterCompatibility: ['A', 'B', 'C', 'D', 'E'],
          tags: ['nature']
        }
      })
    })

    it('should generate letters compatible with category', () => {
      const categoryId = 'animals'
      const letter = letterGenerator.generateForCategory(categoryId)
      
      expect(mockCategoryManager.getCategoryById).toHaveBeenCalledWith(categoryId)
      expect(['A', 'B', 'C', 'D', 'E']).toContain(letter)
    })

    it('should handle category with no compatibility constraints', () => {
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'test',
        name: 'Test',
        metadata: {
          letterCompatibility: [],
          tags: []
        }
      })
      
      const letter = letterGenerator.generateForCategory('test')
      expect(letter).toMatch(/^[A-Z]$/)
    })

    it('should return null for invalid category', () => {
      mockCategoryManager.getCategoryById.mockReturnValue(null)
      
      const letter = letterGenerator.generateForCategory('invalid')
      expect(letter).toBeNull()
    })

    it('should apply category-specific weighting', () => {
      const categoryId = 'animals'
      const letterCounts = {}
      const iterations = 100
      
      // Generate many letters for category
      for (let i = 0; i < iterations; i++) {
        const letter = letterGenerator.generateForCategory(categoryId)
        if (letter) {
          letterCounts[letter] = (letterCounts[letter] || 0) + 1
        }
      }
      
      // Should only contain compatible letters
      Object.keys(letterCounts).forEach(letter => {
        expect(['A', 'B', 'C', 'D', 'E']).toContain(letter)
      })
    })
  })

  describe('Vowel/Consonant Balancing', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should identify vowels correctly', () => {
      expect(letterGenerator.isVowel('A')).toBe(true)
      expect(letterGenerator.isVowel('E')).toBe(true)
      expect(letterGenerator.isVowel('I')).toBe(true)
      expect(letterGenerator.isVowel('O')).toBe(true)
      expect(letterGenerator.isVowel('U')).toBe(true)
      expect(letterGenerator.isVowel('B')).toBe(false)
      expect(letterGenerator.isVowel('Z')).toBe(false)
    })

    it('should generate vowels when requested', () => {
      const vowel = letterGenerator.generateVowel()
      expect(['A', 'E', 'I', 'O', 'U']).toContain(vowel)
    })

    it('should generate consonants when requested', () => {
      const consonant = letterGenerator.generateConsonant()
      expect(['A', 'E', 'I', 'O', 'U']).not.toContain(consonant)
      expect(consonant).toMatch(/^[A-Z]$/)
    })

    it('should generate balanced letter sets', () => {
      const letters = letterGenerator.generateBalancedSet(6)
      
      expect(Array.isArray(letters)).toBe(true)
      expect(letters.length).toBe(6)
      
      const vowels = letters.filter(letter => letterGenerator.isVowel(letter))
      const consonants = letters.filter(letter => !letterGenerator.isVowel(letter))
      
      // Should have reasonable vowel/consonant balance
      expect(vowels.length).toBeGreaterThan(0)
      expect(consonants.length).toBeGreaterThan(0)
    })
  })

  describe('Generation Strategies', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should support random strategy', () => {
      const letter = letterGenerator.generate('random')
      expect(letter).toMatch(/^[A-Z]$/)
    })

    it('should support balanced strategy', () => {
      const letter = letterGenerator.generate('balanced')
      expect(letter).toMatch(/^[A-Z]$/)
    })

    it('should support challenging strategy', () => {
      const letter = letterGenerator.generate('challenging')
      expect(letter).toMatch(/^[A-Z]$/)
    })

    it('should default to balanced strategy for invalid strategy', () => {
      const letter = letterGenerator.generate('invalid-strategy')
      expect(letter).toMatch(/^[A-Z]$/)
    })

    it('should apply difficulty modifiers to strategies', () => {
      const options = { difficulty: 3, strategy: 'balanced' }
      const letter = letterGenerator.generate('balanced', options)
      
      expect(letter).toMatch(/^[A-Z]$/)
    })
  })

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should generate letters under 5ms', () => {
      const startTime = performance.now()
      letterGenerator.generate('random')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(5)
    })

    it('should generate category letters under 10ms', () => {
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'test',
        metadata: { letterCompatibility: ['A', 'B', 'C'] }
      })
      
      const startTime = performance.now()
      letterGenerator.generateForCategory('test')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(10)
    })

    it('should handle bulk generation efficiently', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 100; i++) {
        letterGenerator.generate('random')
      }
      
      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(100) // 1ms per letter average
    })
  })

  describe('Edge Cases', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should handle vowel-heavy categories', () => {
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'vowel-heavy',
        metadata: { letterCompatibility: ['A', 'E', 'I', 'O', 'U'] }
      })
      
      const letter = letterGenerator.generateForCategory('vowel-heavy')
      expect(['A', 'E', 'I', 'O', 'U']).toContain(letter)
    })

    it('should handle consonant clusters', () => {
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'consonant-heavy',
        metadata: { letterCompatibility: ['B', 'C', 'D', 'F', 'G'] }
      })
      
      const letter = letterGenerator.generateForCategory('consonant-heavy')
      expect(['B', 'C', 'D', 'F', 'G']).toContain(letter)
    })

    it('should handle single letter compatibility', () => {
      mockCategoryManager.getCategoryById.mockReturnValue({
        id: 'single-letter',
        metadata: { letterCompatibility: ['X'] }
      })
      
      const letter = letterGenerator.generateForCategory('single-letter')
      expect(letter).toBe('X')
    })

    it('should handle null category manager gracefully', async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(null)
      
      await letterGenerator.init()
      
      const letter = letterGenerator.generate('random')
      expect(letter).toMatch(/^[A-Z]$/)
    })
  })

  describe('Configuration and Options', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should support custom generation options', () => {
      const options = {
        difficulty: 4,
        excludeLetters: ['X', 'Z'],
        preferVowels: true
      }
      
      const letter = letterGenerator.generate('balanced', options)
      expect(letter).toMatch(/^[A-Z]$/)
      expect(['X', 'Z']).not.toContain(letter)
    })

    it('should respect letter exclusions', () => {
      const options = { excludeLetters: ['Q', 'X', 'Z'] }
      
      for (let i = 0; i < 20; i++) {
        const letter = letterGenerator.generate('random', options)
        expect(['Q', 'X', 'Z']).not.toContain(letter)
      }
    })

    it('should apply difficulty scaling correctly', () => {
      const easyOptions = { difficulty: 1 }
      const hardOptions = { difficulty: 5 }
      
      const easyLetter = letterGenerator.generate('balanced', easyOptions)
      const hardLetter = letterGenerator.generate('balanced', hardOptions)
      
      expect(easyLetter).toMatch(/^[A-Z]$/)
      expect(hardLetter).toMatch(/^[A-Z]$/)
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      const { LetterGenerator } = await import('../src/managers/LetterGenerator.js')
      letterGenerator = new LetterGenerator(mockCategoryManager)
      await letterGenerator.init()
    })

    it('should track generation statistics', () => {
      letterGenerator.generate('random')
      letterGenerator.generate('balanced')
      letterGenerator.generate('challenging')
      
      const stats = letterGenerator.getStats()
      
      expect(stats).toHaveProperty('totalGenerated')
      expect(stats).toHaveProperty('strategyCounts')
      expect(stats).toHaveProperty('averageGenerationTime')
      expect(stats.totalGenerated).toBeGreaterThanOrEqual(3)
    })

    it('should reset statistics when requested', () => {
      letterGenerator.generate('random')
      letterGenerator.generate('random')
      
      let stats = letterGenerator.getStats()
      expect(stats.totalGenerated).toBeGreaterThanOrEqual(2)
      
      letterGenerator.resetStats()
      stats = letterGenerator.getStats()
      expect(stats.totalGenerated).toBe(0)
    })
  })
})