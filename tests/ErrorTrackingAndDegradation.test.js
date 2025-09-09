import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ErrorTracker, trackError, trackManagerError } from '../src/utils/ErrorTracker.js'
import { GracefulDegradation, gracefulDegradation, activateDegradation, getDegradationStatus } from '../src/utils/GracefulDegradation.js'
import { WordDataManager } from '../src/managers/WordDataManager.js'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'

describe('Error Tracking and Graceful Degradation System', () => {
  let errorTracker
  let degradationSystem
  let wordManager
  let categoryManager

  beforeEach(() => {
    // Initialize fresh instances for each test
    errorTracker = new ErrorTracker()
    degradationSystem = new GracefulDegradation()
    
    // Reset global instances
    gracefulDegradation.reset()
    
    // Mock storage manager
    const mockStorageManager = {
      has: vi.fn().mockResolvedValue(false),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(true),
      loadWordCache: vi.fn().mockResolvedValue(null),
      saveWordCache: vi.fn().mockResolvedValue(true)
    }
    
    categoryManager = new CategoryDataManager(mockStorageManager)
    wordManager = new WordDataManager(mockStorageManager)
  })

  afterEach(() => {
    // Clean up
    gracefulDegradation.reset()
  })

  describe('ErrorTracker', () => {
    it('should initialize successfully', async () => {
      const result = await errorTracker.init()
      expect(result).toBe(true)
      expect(errorTracker.initialized).toBe(true)
    })

    it('should track errors with proper categorization', () => {
      errorTracker.init()
      
      const error = new Error('Test initialization error')
      const errorId = errorTracker.trackError(error, {
        manager: 'TestManager',
        operation: 'initialize',
        critical: true
      })
      
      expect(errorId).toBeDefined()
      expect(typeof errorId).toBe('string')
      
      const stats = errorTracker.getStats()
      expect(stats.total).toBe(1)
      expect(stats.byCategory.initialization).toBe(1)
      expect(stats.critical).toBe(1)
    })

    it('should categorize different error types correctly', () => {
      errorTracker.init()
      
      const testCases = [
        {
          error: new Error('Failed to load data'),
          context: { operation: 'loadData' },
          expectedCategory: 'data_loading'
        },
        {
          error: new Error('Invalid input provided'),
          context: { operation: 'validateInput' },
          expectedCategory: 'validation'
        },
        {
          error: new Error('Failed to save to storage'),
          context: { operation: 'saveToStorage' },
          expectedCategory: 'storage'
        },
        {
          error: new Error('Generation failed'),
          context: { manager: 'CombinationGenerator', operation: 'generate' },
          expectedCategory: 'generation'
        }
      ]
      
      testCases.forEach(({ error, context, expectedCategory }) => {
        errorTracker.trackError(error, context)
      })
      
      const stats = errorTracker.getStats()
      expect(stats.total).toBe(testCases.length)
      expect(stats.byCategory.data_loading).toBe(1)
      expect(stats.byCategory.validation).toBe(1)
      expect(stats.byCategory.storage).toBe(1)
      expect(stats.byCategory.generation).toBe(1)
    })

    it('should assess error severity correctly', () => {
      errorTracker.init()
      
      // Critical error
      const criticalError = new Error('Cannot read property of undefined')
      errorTracker.trackError(criticalError, { critical: true })
      
      // High severity error
      const highError = new Error('Failed to load data')
      errorTracker.trackError(highError, { operation: 'loadData', required: true })
      
      // Medium severity error
      const mediumError = new Error('Storage failed')
      errorTracker.trackError(mediumError, { operation: 'saveData' })
      
      // Low severity error
      const lowError = new Error('Minor validation issue')
      errorTracker.trackError(lowError, { operation: 'validate', optional: true })
      
      const recentErrors = errorTracker.getRecentErrors(4)
      expect(recentErrors).toHaveLength(4)
      
      // Check severity levels (errors are in reverse chronological order)
      expect(recentErrors[3].severity).toBe(4) // Critical
      expect(recentErrors[2].severity).toBe(3) // High
      expect(recentErrors[1].severity).toBe(2) // Medium
      expect(recentErrors[0].severity).toBe(1) // Low
    })

    it('should provide recovery suggestions', () => {
      errorTracker.init()
      
      const storageError = new Error('LocalStorage quota exceeded')
      const errorId = errorTracker.trackError(storageError, {
        operation: 'saveData',
        manager: 'StorageManager'
      })
      
      const recentErrors = errorTracker.getRecentErrors(1)
      const trackedError = recentErrors[0]
      
      expect(trackedError.recovery).toContain('Clear local storage')
      expect(trackedError.recovery).toContain('Use in-memory storage')
      expect(trackedError.recoverable).toBe(true)
    })

    it('should track helper functions work correctly', () => {
      errorTracker.init()
      
      const error = new Error('Test error')
      const errorId = trackError(error, { context: 'test' })
      expect(errorId).toBeDefined()
      
      const managerErrorId = trackManagerError('TestManager', 'testOperation', error)
      expect(managerErrorId).toBeDefined()
      
      const stats = errorTracker.getStats()
      expect(stats.total).toBe(2)
    })
  })

  describe('GracefulDegradation', () => {
    it('should initialize with fallback data', () => {
      expect(degradationSystem.degradationLevel).toBe(0)
      expect(degradationSystem.activeDegradations.size).toBe(0)
      
      const fallbackData = degradationSystem.getFallbackData()
      expect(fallbackData.categories).toHaveLength(2)
      expect(fallbackData.letters).toHaveLength(7)
      expect(fallbackData.roundConfigs.emergency).toBeDefined()
    })

    it('should activate degradation correctly', () => {
      const result = degradationSystem.activateDegradation('storage_unavailable', {
        reason: 'Storage quota exceeded'
      })
      
      expect(result).toBe(true)
      expect(degradationSystem.isDegradationActive('storage_unavailable')).toBe(true)
      expect(degradationSystem.degradationLevel).toBe(2) // Medium severity
    })

    it('should handle multiple degradations and calculate correct level', () => {
      degradationSystem.activateDegradation('storage_unavailable') // Severity 2
      degradationSystem.activateDegradation('generation_system_failed') // Severity 1
      degradationSystem.activateDegradation('word_data_missing') // Severity 3
      
      expect(degradationSystem.degradationLevel).toBe(3) // Highest severity
      expect(degradationSystem.activeDegradations.size).toBe(3)
    })

    it('should provide emergency categories when category data is missing', () => {
      const emergencyCategories = degradationSystem.loadEmergencyCategories()
      
      expect(emergencyCategories).toHaveLength(2)
      expect(emergencyCategories[0].id).toBe('emergency-basic')
      expect(emergencyCategories[1].id).toBe('emergency-animals')
      expect(emergencyCategories[0].words).toContain('cat')
    })

    it('should generate basic rounds when generation system fails', () => {
      const basicGeneration = degradationSystem.enableBasicGeneration()
      const round = basicGeneration.generateBasicRound()
      
      expect(round).toBeDefined()
      expect(round.category).toBeDefined()
      expect(round.letter).toBeDefined()
      expect(round.difficulty).toBe(1)
      expect(round.playability.feasible).toBe(true)
      expect(round.metadata.generationType).toBe('emergency')
    })

    it('should provide user-friendly status messages', () => {
      degradationSystem.activateDegradation('storage_unavailable')
      degradationSystem.activateDegradation('network_offline')
      
      const status = degradationSystem.getStatus()
      expect(status.userMessages).toContain('Progress saving disabled - using memory only')
      expect(status.userMessages).toContain('Offline mode - no online features')
    })

    it('should attempt recovery for degradations', async () => {
      degradationSystem.activateDegradation('performance_degraded')
      
      expect(degradationSystem.isDegradationActive('performance_degraded')).toBe(true)
      
      // Mock successful recovery
      const originalRecovery = degradationSystem.recoveryStrategies.performance_degraded.recovery
      degradationSystem.recoveryStrategies.performance_degraded.recovery = vi.fn().mockResolvedValue(true)
      
      const recovered = await degradationSystem.deactivateDegradation('performance_degraded')
      
      expect(recovered).toBe(true)
      expect(degradationSystem.isDegradationActive('performance_degraded')).toBe(false)
      
      // Restore original recovery function
      degradationSystem.recoveryStrategies.performance_degraded.recovery = originalRecovery
    })

    it('should handle health checks', () => {
      degradationSystem.setupHealthChecks()
      const healthResults = degradationSystem.runHealthChecks()
      
      expect(healthResults).toBeDefined()
      expect(typeof healthResults.storage).toBe('boolean')
      expect(typeof healthResults.performance).toBe('boolean')
    })
  })

  describe('Integration with Managers', () => {
    it('should integrate error tracking with CategoryDataManager', async () => {
      await errorTracker.init()
      
      // Force an initialization error by providing invalid storage
      const invalidStorageManager = {
        has: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
        get: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
        set: vi.fn().mockRejectedValue(new Error('Storage unavailable'))
      }
      
      const manager = new CategoryDataManager(invalidStorageManager)
      await manager.init()
      
      // The manager should still initialize with fallback categories
      expect(manager.initialized).toBe(true)
      expect(manager.categories.length).toBeGreaterThan(0)
    })

    it('should integrate graceful degradation with WordDataManager', async () => {
      await wordManager.init()
      
      // Check that the manager can generate rounds even if advanced system fails
      const round = wordManager.generateRound()
      
      expect(round).toBeDefined()
      expect(round.category).toBeDefined()
      expect(round.letter).toBeDefined()
    })

    it('should provide health check functionality through WordDataManager', async () => {
      await wordManager.init()
      
      const healthCheck = await wordManager.performHealthCheck()
      
      expect(healthCheck).toBeDefined()
      expect(healthCheck.health).toBeDefined()
      expect(healthCheck.degradation).toBeDefined()
    })

    it('should provide system status through WordDataManager', async () => {
      await wordManager.init()
      
      const systemStatus = wordManager.getSystemStatus()
      
      expect(systemStatus).toBeDefined()
      expect(systemStatus.status).toBeDefined()
      expect(systemStatus.message).toBeDefined()
      expect(Array.isArray(systemStatus.userMessages)).toBe(true)
    })

    it('should handle generation system failure gracefully', async () => {
      await wordManager.init()
      
      // Simulate generation system failure
      wordManager.generationSystemEnabled = false
      wordManager.combinationGenerator = null
      
      const round = wordManager.generateRound()
      
      expect(round).toBeDefined()
      expect(gracefulDegradation.isDegradationActive('generation_system_failed')).toBe(true)
    })

    it('should activate storage degradation on save failures', async () => {
      await categoryManager.init()
      
      // Mock storage failure
      categoryManager.storageManager.set = vi.fn().mockRejectedValue(new Error('Storage full'))
      
      const result = await categoryManager.saveCategories()
      
      expect(result).toBe(false)
      expect(gracefulDegradation.isDegradationActive('storage_unavailable')).toBe(true)
    })
  })

  describe('Helper Functions', () => {
    it('should provide easy access to degradation functions', () => {
      const result = activateDegradation('network_offline', { reason: 'No internet' })
      expect(result).toBe(true)
      
      const status = getDegradationStatus()
      expect(status.activeDegradations).toContain('network_offline')
      expect(status.level).toBe(1)
    })
  })

  describe('Error Report Generation', () => {
    it('should generate comprehensive error reports', () => {
      errorTracker.init()
      
      // Generate various errors
      errorTracker.trackError(new Error('Critical failure'), { critical: true })
      errorTracker.trackError(new Error('Storage error'), { operation: 'save' })
      errorTracker.trackError(new Error('Validation error'), { operation: 'validate' })
      
      const report = errorTracker.generateReport()
      
      expect(report.summary.total).toBe(3)
      expect(report.summary.critical).toBe(1)
      expect(report.breakdown.byCategory).toBeDefined()
      expect(report.breakdown.bySeverity).toBeDefined()
      expect(report.recentErrors).toHaveLength(3)
      expect(report.timestamp).toBeDefined()
    })
  })
})