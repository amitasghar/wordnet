import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { UnifiedDataManager, createUnifiedDataManager, isUnifiedDataManagerReady } from '../src/managers/UnifiedDataManager.js'
import { WordDataManager } from '../src/managers/WordDataManager.js'
import { GameStateManager, GAME_STATES } from '../src/managers/GameStateManager.js'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'
import { gracefulDegradation } from '../src/utils/GracefulDegradation.js'

describe('End-to-End System Integration', () => {
  let unifiedManager
  let mockStorageManager
  let mockGameInstance

  beforeEach(async () => {
    // Reset graceful degradation
    gracefulDegradation.reset()
    
    // Create comprehensive mock storage manager
    mockStorageManager = {
      has: vi.fn().mockResolvedValue(false),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(true),
      loadWordCache: vi.fn().mockResolvedValue(null),
      saveWordCache: vi.fn().mockResolvedValue(true)
    }
    
    // Mock game instance
    mockGameInstance = {
      scene: {
        getScene: vi.fn().mockReturnValue({ cameras: { main: { fadeOut: vi.fn(), once: vi.fn() } } }),
        start: vi.fn(),
        launch: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn()
      }
    }
    
    // Initialize unified manager
    unifiedManager = await createUnifiedDataManager(mockStorageManager, mockGameInstance)
  })

  afterEach(async () => {
    if (unifiedManager) {
      await unifiedManager.destroy()
    }
    gracefulDegradation.reset()
    vi.clearAllMocks()
  })

  describe('System Initialization', () => {
    it('should initialize all subsystems successfully', () => {
      expect(isUnifiedDataManagerReady(unifiedManager)).toBe(true)
      expect(unifiedManager.initialized).toBe(true)
      expect(unifiedManager.wordDataManager).toBeDefined()
      expect(unifiedManager.gameStateManager).toBeDefined()
      expect(unifiedManager.categoryDataManager).toBeDefined()
    })

    it('should have functional word data system', () => {
      const categories = unifiedManager.getCategories()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      
      const firstCategory = categories[0]
      expect(firstCategory.id).toBeDefined()
      expect(firstCategory.name).toBeDefined()
      expect(firstCategory.difficulty).toBeDefined()
    })

    it('should have functional category generation system', () => {
      const generationStatus = unifiedManager.getGenerationSystemStatus()
      expect(generationStatus.enabled).toBe(true)
      expect(generationStatus.categoryManager).toBe('available')
      expect(generationStatus.letterGenerator).toBe('available')
      expect(generationStatus.combinationGenerator).toBe('available')
    })

    it('should handle initialization failure gracefully', async () => {
      // Create manager with failing storage
      const failingStorage = {
        ...mockStorageManager,
        get: vi.fn().mockRejectedValue(new Error('Storage failed')),
        set: vi.fn().mockRejectedValue(new Error('Storage failed'))
      }
      
      const failingManager = new UnifiedDataManager(failingStorage, mockGameInstance)
      const initResult = await failingManager.init()
      
      // Should still initialize with fallback
      expect(initResult).toBe(false) // Primary init failed
      expect(failingManager.initialized).toBe(true) // But fallback succeeded
      
      await failingManager.destroy()
    })
  })

  describe('Complete Game Flow Integration', () => {
    it('should support complete game session flow', async () => {
      // Start a new game session
      const gameSession = await unifiedManager.startGameSession({
        difficulty: 'medium',
        targetRounds: 3
      })
      
      expect(gameSession).toBeDefined()
      expect(gameSession.id).toBeDefined()
      expect(gameSession.status).toBe('ready')
      expect(gameSession.config.difficulty).toBe('medium')
      expect(gameSession.config.targetRounds).toBe(3)
      
      // Generate and start multiple rounds
      for (let i = 0; i < 3; i++) {
        const round = await unifiedManager.generateRound({
          timeLimit: 60
        })
        
        expect(round).toBeDefined()
        expect(round.id).toBeDefined()
        expect(round.category).toBeDefined()
        expect(round.letter).toBeDefined()
        expect(round.status).toBe('active')
        expect(round.roundNumber).toBe(i + 1)
        
        // Add some words to the round
        const testWords = ['cat', 'car', 'can']
        for (const word of testWords) {
          const validation = await unifiedManager.validateWord(word)
          if (validation.valid) {
            const addResult = await unifiedManager.addWord(word)
            expect(addResult.success).toBeDefined()
          }
        }
        
        // Complete the round
        const completedRound = await unifiedManager.completeRound('completed')
        expect(completedRound).toBeDefined()
        expect(completedRound.status).toBe('completed')
        expect(completedRound.completedAt).toBeDefined()
      }
      
      // Game session should be completed after 3 rounds
      const gameState = unifiedManager.getGameState()
      expect(gameState.gameSession.currentGameSession.status).toBe('completed')
    })

    it('should handle word validation and scoring correctly', async () => {
      // Start game session and round
      await unifiedManager.startGameSession()
      const round = await unifiedManager.generateRound()
      
      expect(round).toBeDefined()
      
      // Test valid word
      const categoryWords = unifiedManager.getCategoryWords(round.category.id)
      expect(categoryWords.words.length).toBeGreaterThan(0)
      
      const validWord = categoryWords.words.find(word => 
        word.toLowerCase().startsWith(round.letter.toLowerCase())
      )
      
      if (validWord) {
        const validation = await unifiedManager.validateWord(validWord)
        expect(validation.valid).toBe(true)
        expect(validation.score).toBeGreaterThan(0)
        
        const addResult = await unifiedManager.addWord(validWord)
        expect(addResult.success).toBe(true)
        expect(addResult.score).toBeGreaterThan(0)
      }
      
      // Test invalid word
      const invalidValidation = await unifiedManager.validateWord('invalidword123')
      expect(invalidValidation.valid).toBe(false)
      expect(invalidValidation.score).toBe(0)
      
      // Test duplicate word
      if (validWord) {
        const duplicateResult = await unifiedManager.addWord(validWord)
        expect(duplicateResult.success).toBe(false)
        expect(duplicateResult.reason).toBe('Word already found')
      }
    })

    it('should track player statistics across sessions', async () => {
      // Get initial stats
      const initialStats = unifiedManager.getPlayerStats()
      const initialGames = initialStats?.totalGames || 0
      const initialWords = initialStats?.totalWords || 0
      
      // Play a complete game
      await unifiedManager.startGameSession({ targetRounds: 2 })
      
      for (let i = 0; i < 2; i++) {
        const round = await unifiedManager.generateRound()
        
        // Add a word if possible
        const categoryWords = unifiedManager.getCategoryWords(round.category.id)
        const validWord = categoryWords.words.find(word => 
          word.toLowerCase().startsWith(round.letter.toLowerCase())
        )
        
        if (validWord) {
          await unifiedManager.addWord(validWord)
        }
        
        await unifiedManager.completeRound()
      }
      
      // Check updated stats
      const finalStats = unifiedManager.getPlayerStats()
      expect(finalStats.totalGames).toBe(initialGames + 1)
      expect(finalStats.totalWords).toBeGreaterThanOrEqual(initialWords)
      expect(finalStats.categoriesPlayed.length).toBeGreaterThan(0)
      expect(finalStats.lettersPlayed.length).toBeGreaterThan(0)
    })
  })

  describe('Data Consistency and Synchronization', () => {
    it('should maintain data consistency between managers', async () => {
      // Get data from different access points
      const unifiedCategories = unifiedManager.getCategories()
      const wordManagerCategories = unifiedManager.wordDataManager.getUnifiedCategoryData()
      const categoryManagerCategories = unifiedManager.categoryDataManager.getAllCategories()
      
      // Should have consistent category data
      expect(unifiedCategories.length).toBeGreaterThan(0)
      expect(wordManagerCategories.length).toBeGreaterThan(0)
      expect(categoryManagerCategories.length).toBeGreaterThan(0)
      
      // Check for specific category consistency
      const testCategoryId = unifiedCategories[0].id
      const unifiedCategory = unifiedCategories.find(c => c.id === testCategoryId)
      const categoryManagerCategory = unifiedManager.categoryDataManager.getCategoryById(testCategoryId)
      
      expect(unifiedCategory).toBeDefined()
      expect(categoryManagerCategory).toBeDefined()
      expect(unifiedCategory.id).toBe(categoryManagerCategory.id)
      expect(unifiedCategory.name).toBe(categoryManagerCategory.name)
    })

    it('should synchronize data between subsystems', async () => {
      const syncResult = await unifiedManager.synchronizeData()
      
      expect(syncResult).toBeDefined()
      expect(typeof syncResult.categoriesSynced).toBe('number')
      expect(typeof syncResult.wordsSynced).toBe('number')
      expect(Array.isArray(syncResult.errors)).toBe(true)
    })

    it('should handle storage operations consistently', async () => {
      // Start a game session to generate some data
      await unifiedManager.startGameSession()
      const round = await unifiedManager.generateRound()
      
      // Add a word to create some state
      const categoryWords = unifiedManager.getCategoryWords(round.category.id)
      const validWord = categoryWords.words.find(word => 
        word.toLowerCase().startsWith(round.letter.toLowerCase())
      )
      
      if (validWord) {
        await unifiedManager.addWord(validWord)
      }
      
      // Verify storage calls were made
      expect(mockStorageManager.set).toHaveBeenCalled()
    })
  })

  describe('Error Handling and Graceful Degradation', () => {
    it('should handle individual component failures gracefully', async () => {
      // Simulate category manager failure
      unifiedManager.categoryDataManager = null
      
      // Should still be able to generate rounds using fallback
      const round = await unifiedManager.generateRound()
      expect(round).toBeDefined()
      
      // Check that degradation was activated
      expect(gracefulDegradation.isDegradationActive('generation_system_failed')).toBe(true)
    })

    it('should handle storage failures gracefully', async () => {
      // Mock storage failure
      mockStorageManager.set.mockRejectedValue(new Error('Storage full'))
      
      // Should still function with in-memory storage
      await unifiedManager.startGameSession()
      const round = await unifiedManager.generateRound()
      expect(round).toBeDefined()
      
      // Check that storage degradation was activated
      expect(gracefulDegradation.isDegradationActive('storage_unavailable')).toBe(true)
    })

    it('should provide comprehensive error reporting', async () => {
      // Force an error condition
      unifiedManager.wordDataManager = null
      
      try {
        await unifiedManager.generateRound()
        throw new Error('Should have thrown an error')
      } catch (error) {
        expect(error.message).toContain('WordDataManager')
      }
      
      // Check performance metrics reflect the error
      const metrics = unifiedManager.getPerformanceMetrics()
      expect(metrics.failedOperations).toBeGreaterThan(0)
      expect(metrics.successRate).toBeLessThan(100)
    })

    it('should recover from transient failures', async () => {
      // Simulate temporary failure
      const originalMethod = unifiedManager.wordDataManager.generateUnifiedRound
      unifiedManager.wordDataManager.generateUnifiedRound = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockImplementation(originalMethod.bind(unifiedManager.wordDataManager))
      
      // First call should fail and activate degradation
      const round1 = await unifiedManager.generateRound()
      expect(round1).toBeDefined() // Should get fallback round
      
      // Reset the mock to allow normal operation
      unifiedManager.wordDataManager.generateUnifiedRound = originalMethod
      
      // Second call should work normally
      const round2 = await unifiedManager.generateRound()
      expect(round2).toBeDefined()
    })
  })

  describe('Performance and Health Monitoring', () => {
    it('should track performance metrics', async () => {
      // Perform several operations
      await unifiedManager.startGameSession()
      await unifiedManager.generateRound()
      unifiedManager.getCategories()
      unifiedManager.getPlayerStats()
      
      const metrics = unifiedManager.getPerformanceMetrics()
      
      expect(metrics.totalOperations).toBeGreaterThan(0)
      expect(metrics.successfulOperations).toBeGreaterThan(0)
      expect(metrics.averageResponseTime).toBeGreaterThan(0)
      expect(metrics.successRate).toBeGreaterThan(0)
    })

    it('should perform comprehensive health checks', async () => {
      const healthCheck = await unifiedManager.performHealthCheck()
      
      expect(healthCheck).toBeDefined()
      expect(healthCheck.timestamp).toBeDefined()
      expect(healthCheck.duration).toBeGreaterThan(0)
      expect(typeof healthCheck.overall).toBe('boolean')
      expect(healthCheck.subsystems).toBeDefined()
      expect(healthCheck.subsystems.wordData).toBeDefined()
      expect(healthCheck.subsystems.storage).toBeDefined()
    })

    it('should provide comprehensive system health status', () => {
      const health = unifiedManager.getSystemHealth()
      
      expect(health.overall).toBeDefined()
      expect(health.subsystems).toBeDefined()
      expect(health.degradations).toBeDefined()
      expect(health.lastCheck).toBeDefined()
      
      expect(health.subsystems.wordData).toBeDefined()
      expect(health.subsystems.gameState).toBeDefined()
      expect(health.subsystems.generation).toBeDefined()
    })
  })

  describe('Configuration and Customization', () => {
    it('should support runtime configuration changes', () => {
      const originalConfig = unifiedManager.config
      
      const newConfig = unifiedManager.configure({
        enableAutoSync: false,
        enableHealthChecks: false,
        healthCheckInterval: 60000
      })
      
      expect(newConfig.enableAutoSync).toBe(false)
      expect(newConfig.enableHealthChecks).toBe(false)
      expect(newConfig.healthCheckInterval).toBe(60000)
      
      // Restore original config
      unifiedManager.configure(originalConfig)
    })

    it('should support data export functionality', () => {
      const exportData = unifiedManager.exportData()
      
      expect(exportData).toBeDefined()
      expect(exportData.metadata).toBeDefined()
      expect(exportData.metadata.exportedAt).toBeDefined()
      expect(exportData.metadata.version).toBeDefined()
      expect(exportData.wordData).toBeDefined()
      expect(exportData.gameState).toBeDefined()
      expect(exportData.performance).toBeDefined()
      expect(exportData.configuration).toBeDefined()
    })

    it('should support custom round configurations', async () => {
      const roundConfigs = unifiedManager.getRoundConfigurations()
      
      expect(roundConfigs).toBeDefined()
      expect(roundConfigs.default).toBeDefined()
      expect(roundConfigs.quick).toBeDefined()
      
      // Test with custom configuration
      await unifiedManager.startGameSession()
      const customRound = await unifiedManager.generateRound({
        roundType: 'challenge',
        timeLimit: 120,
        targetDifficulty: 4
      })
      
      expect(customRound).toBeDefined()
      expect(customRound.timeLimit).toBe(120)
    })
  })

  describe('Integration with Game State Management', () => {
    it('should integrate with Phaser game state transitions', async () => {
      const gameStateManager = unifiedManager.gameStateManager
      
      // Test scene state integration
      expect(gameStateManager.currentState).toBe(GAME_STATES.BOOTING)
      
      // Start game session should trigger state changes
      await unifiedManager.startGameSession()
      
      // Generate round should set PLAYING state
      await unifiedManager.generateRound()
      expect(gameStateManager.currentState).toBe(GAME_STATES.PLAYING)
      
      // Verify scene transition calls
      expect(mockGameInstance.scene.start).toHaveBeenCalled()
    })

    it('should maintain game state across round transitions', async () => {
      await unifiedManager.startGameSession({ targetRounds: 2 })
      
      // First round
      const round1 = await unifiedManager.generateRound()
      expect(round1.roundNumber).toBe(1)
      
      const gameState1 = unifiedManager.getGameState()
      expect(gameState1.gameSession.currentGameSession.roundsCompleted).toBe(0)
      
      await unifiedManager.completeRound()
      
      // Second round
      const round2 = await unifiedManager.generateRound()
      expect(round2.roundNumber).toBe(2)
      
      const gameState2 = unifiedManager.getGameState()
      expect(gameState2.gameSession.currentGameSession.roundsCompleted).toBe(1)
    })

    it('should handle game state persistence', async () => {
      await unifiedManager.startGameSession()
      const round = await unifiedManager.generateRound()
      
      // Add a word to create state
      const categoryWords = unifiedManager.getCategoryWords(round.category.id)
      const validWord = categoryWords.words[0]
      
      if (validWord && validWord.toLowerCase().startsWith(round.letter.toLowerCase())) {
        await unifiedManager.addWord(validWord)
      }
      
      // Verify game state is persisted
      expect(mockStorageManager.set).toHaveBeenCalledWith(
        'gameSessionState',
        expect.any(Object)
      )
    })
  })

  describe('Word Hints and Helper Features', () => {
    it('should provide contextual word hints', async () => {
      await unifiedManager.startGameSession()
      const round = await unifiedManager.generateRound()
      
      const hints = unifiedManager.getWordHints(3)
      
      expect(Array.isArray(hints)).toBe(true)
      expect(hints.length).toBeLessThanOrEqual(3)
      
      // All hints should start with the round letter
      hints.forEach(hint => {
        expect(hint.toLowerCase().startsWith(round.letter.toLowerCase())).toBe(true)
      })
    })

    it('should provide category filtering capabilities', () => {
      // Test various filters
      const allCategories = unifiedManager.getCategories()
      const easyCategories = unifiedManager.getCategories({ difficulty: 'easy' })
      const letterFilteredCategories = unifiedManager.getCategories({ letterCompatibility: 'A' })
      
      expect(allCategories.length).toBeGreaterThan(0)
      expect(easyCategories.length).toBeGreaterThanOrEqual(0)
      expect(letterFilteredCategories.length).toBeGreaterThanOrEqual(0)
      
      // Verify filtering works
      if (easyCategories.length > 0) {
        easyCategories.forEach(cat => {
          expect(cat.difficulty).toBe('easy')
        })
      }
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should clean up resources properly on destroy', async () => {
      const manager = await createUnifiedDataManager(mockStorageManager, mockGameInstance)
      
      expect(manager.initialized).toBe(true)
      
      await manager.destroy()
      
      expect(manager.initialized).toBe(false)
      expect(manager.wordDataManager).toBeNull()
      expect(manager.gameStateManager).toBeNull()
    })

    it('should handle concurrent operations safely', async () => {
      // Start multiple operations concurrently
      const operations = [
        unifiedManager.startGameSession(),
        unifiedManager.getCategories(),
        unifiedManager.getPlayerStats(),
        unifiedManager.performHealthCheck()
      ]
      
      const results = await Promise.all(operations)
      
      // All operations should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined()
      })
    })
  })
})