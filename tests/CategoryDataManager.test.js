import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('CategoryDataManager', () => {
  let categoryManager
  let mockStorageManager

  beforeEach(() => {
    // Mock StorageManager
    mockStorageManager = {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      clear: vi.fn(),
      init: vi.fn().mockResolvedValue(true)
    }

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should create CategoryDataManager instance', async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      
      expect(categoryManager).toBeDefined()
      expect(categoryManager.storageManager).toBe(mockStorageManager)
    })

    it('should initialize with default categories', async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      
      await categoryManager.init()
      
      expect(categoryManager.categories).toBeDefined()
      expect(Array.isArray(categoryManager.categories)).toBe(true)
      expect(categoryManager.categories.length).toBeGreaterThan(0)
    })

    it('should load categories from storage if available', async () => {
      const mockCategories = [
        { 
          id: 'animals', 
          name: 'Animals', 
          difficulty: 1, 
          words: ['cat', 'dog'],
          metadata: {
            letterCompatibility: ['A', 'C', 'D'],
            tags: ['test'],
            theme: 'Test animals',
            estimatedWords: 2,
            averageWordLength: 3
          }
        }
      ]
      mockStorageManager.has.mockReturnValue(true)
      mockStorageManager.get.mockReturnValue(mockCategories)
      
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      
      await categoryManager.init()
      
      expect(mockStorageManager.get).toHaveBeenCalledWith('categories')
      expect(categoryManager.categories).toEqual(mockCategories)
    })
  })

  describe('Category Data Structure', () => {
    beforeEach(async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
    })

    it('should have proper category structure', () => {
      const category = categoryManager.categories[0]
      
      expect(category).toHaveProperty('id')
      expect(category).toHaveProperty('name')
      expect(category).toHaveProperty('difficulty')
      expect(category).toHaveProperty('words')
      expect(category).toHaveProperty('metadata')
      
      expect(typeof category.id).toBe('string')
      expect(typeof category.name).toBe('string')
      expect(typeof category.difficulty).toBe('number')
      expect(Array.isArray(category.words)).toBe(true)
      expect(typeof category.metadata).toBe('object')
    })

    it('should have valid difficulty ratings (1-5)', () => {
      categoryManager.categories.forEach(category => {
        expect(category.difficulty).toBeGreaterThanOrEqual(1)
        expect(category.difficulty).toBeLessThanOrEqual(5)
      })
    })

    it('should have non-empty word lists', () => {
      categoryManager.categories.forEach(category => {
        expect(category.words.length).toBeGreaterThan(0)
      })
    })

    it('should have valid metadata structure', () => {
      const category = categoryManager.categories[0]
      
      expect(category.metadata).toHaveProperty('letterCompatibility')
      expect(category.metadata).toHaveProperty('tags')
      expect(category.metadata).toHaveProperty('theme')
      
      expect(Array.isArray(category.metadata.letterCompatibility)).toBe(true)
      expect(Array.isArray(category.metadata.tags)).toBe(true)
      expect(typeof category.metadata.theme).toBe('string')
    })
  })

  describe('Category Retrieval', () => {
    beforeEach(async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
    })

    it('should get category by ID', () => {
      const firstCategory = categoryManager.categories[0]
      const retrieved = categoryManager.getCategoryById(firstCategory.id)
      
      expect(retrieved).toEqual(firstCategory)
    })

    it('should return null for invalid category ID', () => {
      const retrieved = categoryManager.getCategoryById('invalid-id')
      expect(retrieved).toBeNull()
    })

    it('should get all categories', () => {
      const allCategories = categoryManager.getAllCategories()
      
      expect(Array.isArray(allCategories)).toBe(true)
      expect(allCategories.length).toBe(categoryManager.categories.length)
      expect(allCategories).toEqual(categoryManager.categories)
    })

    it('should get random category', () => {
      const randomCategory = categoryManager.getRandomCategory()
      
      expect(randomCategory).toBeDefined()
      expect(categoryManager.categories).toContainEqual(randomCategory)
    })

    it('should get different random categories on multiple calls', () => {
      const categories = new Set()
      
      // Get multiple random categories
      for (let i = 0; i < 10; i++) {
        const category = categoryManager.getRandomCategory()
        categories.add(category.id)
      }
      
      // Should get some variety (assuming we have multiple categories)
      if (categoryManager.categories.length > 1) {
        expect(categories.size).toBeGreaterThan(1)
      }
    })
  })

  describe('Category Filtering', () => {
    beforeEach(async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
    })

    it('should filter categories by difficulty', () => {
      const easyCategories = categoryManager.getCategoriesByDifficulty(1)
      
      expect(Array.isArray(easyCategories)).toBe(true)
      easyCategories.forEach(category => {
        expect(category.difficulty).toBe(1)
      })
    })

    it('should filter categories by difficulty range', () => {
      const mediumCategories = categoryManager.getCategoriesByDifficultyRange(2, 3)
      
      expect(Array.isArray(mediumCategories)).toBe(true)
      mediumCategories.forEach(category => {
        expect(category.difficulty).toBeGreaterThanOrEqual(2)
        expect(category.difficulty).toBeLessThanOrEqual(3)
      })
    })

    it('should filter categories by letter compatibility', () => {
      const letter = 'A'
      const compatibleCategories = categoryManager.getCategoriesByLetter(letter)
      
      expect(Array.isArray(compatibleCategories)).toBe(true)
      compatibleCategories.forEach(category => {
        expect(category.metadata.letterCompatibility).toContain(letter)
      })
    })

    it('should filter categories by tag', () => {
      // Assuming categories have tags in metadata
      const firstCategory = categoryManager.categories[0]
      if (firstCategory.metadata.tags.length > 0) {
        const tag = firstCategory.metadata.tags[0]
        const taggedCategories = categoryManager.getCategoriesByTag(tag)
        
        expect(Array.isArray(taggedCategories)).toBe(true)
        expect(taggedCategories.length).toBeGreaterThan(0)
        expect(taggedCategories).toContainEqual(firstCategory)
      }
    })

    it('should return empty array for non-existent filters', () => {
      const nonExistentDifficulty = categoryManager.getCategoriesByDifficulty(99)
      const nonExistentLetter = categoryManager.getCategoriesByLetter('Z')
      const nonExistentTag = categoryManager.getCategoriesByTag('nonexistent-tag')
      
      expect(nonExistentDifficulty).toEqual([])
      expect(nonExistentLetter).toEqual([])
      expect(nonExistentTag).toEqual([])
    })
  })

  describe('Category Search', () => {
    beforeEach(async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
    })

    it('should search categories by name', () => {
      const firstCategory = categoryManager.categories[0]
      const searchTerm = firstCategory.name.substring(0, 3).toLowerCase()
      const results = categoryManager.searchCategories(searchTerm)
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      
      results.forEach(category => {
        expect(category.name.toLowerCase()).toContain(searchTerm)
      })
    })

    it('should search categories case-insensitively', () => {
      const firstCategory = categoryManager.categories[0]
      const searchTerm = firstCategory.name.toUpperCase()
      const results = categoryManager.searchCategories(searchTerm)
      
      expect(results).toContainEqual(firstCategory)
    })

    it('should return empty array for non-matching search', () => {
      const results = categoryManager.searchCategories('zzz-nonexistent')
      expect(results).toEqual([])
    })

    it('should search with partial matches', () => {
      if (categoryManager.categories.length > 0) {
        const firstCategory = categoryManager.categories[0]
        const partialName = firstCategory.name.substring(1, 3)
        const results = categoryManager.searchCategories(partialName)
        
        expect(Array.isArray(results)).toBe(true)
        if (partialName.length >= 2) {
          expect(results.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
    })

    it('should retrieve random category under 10ms', () => {
      const startTime = performance.now()
      categoryManager.getRandomCategory()
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(10)
    })

    it('should filter categories under 50ms', () => {
      const startTime = performance.now()
      categoryManager.getCategoriesByDifficulty(1)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('should search categories under 50ms', () => {
      const startTime = performance.now()
      categoryManager.searchCategories('test')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(50)
    })
  })

  describe('Data Validation', () => {
    it('should validate category structure on initialization', async () => {
      const invalidCategories = [
        { id: 'test', name: 'Test' } // Missing required fields
      ]
      mockStorageManager.has.mockReturnValue(true)
      mockStorageManager.get.mockReturnValue(invalidCategories)
      
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      
      // Should handle invalid data gracefully
      await expect(categoryManager.init()).resolves.not.toThrow()
    })

    it('should sanitize category data', async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
      
      categoryManager.categories.forEach(category => {
        expect(category.id).toMatch(/^[a-zA-Z0-9-_]+$/) // Valid ID format
        expect(category.name.trim()).toBe(category.name) // No leading/trailing spaces
        expect(category.words.every(word => typeof word === 'string')).toBe(true)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorageManager.get.mockImplementation(() => {
        throw new Error('Storage error')
      })
      
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      
      await expect(categoryManager.init()).resolves.not.toThrow()
      expect(categoryManager.categories.length).toBeGreaterThan(0) // Should fall back to defaults
    })

    it('should handle invalid method parameters', async () => {
      const { CategoryDataManager } = await import('../src/managers/CategoryDataManager.js')
      categoryManager = new CategoryDataManager(mockStorageManager)
      await categoryManager.init()
      
      expect(() => categoryManager.getCategoryById(null)).not.toThrow()
      expect(() => categoryManager.getCategoriesByDifficulty('invalid')).not.toThrow()
      expect(() => categoryManager.searchCategories(null)).not.toThrow()
    })
  })
})