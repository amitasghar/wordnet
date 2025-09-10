import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'
import { gracefulDegradation } from '@/utils/GracefulDegradation.js'

import { WordDataManager } from './WordDataManager.js'
import { CategoryDataManager } from './CategoryDataManager.js'
import { LetterGenerator } from './LetterGenerator.js'
import { CombinationGenerator } from './CombinationGenerator.js'
import { GameStateManager } from './GameStateManager.js'

/**
 * UnifiedDataManager
 * 
 * Provides a single, unified interface for accessing all game data and functionality.
 * Coordinates between WordDataManager, CategoryDataManager, GameStateManager, and
 * the category generation system to provide seamless data access.
 */
export class UnifiedDataManager {
  constructor (storageManager = null, gameInstance = null) {
    this.storageManager = storageManager
    this.gameInstance = gameInstance
    
    // Core managers
    this.wordDataManager = null
    this.gameStateManager = null
    
    // Individual component managers (accessed through WordDataManager)
    this.categoryDataManager = null
    this.letterGenerator = null
    this.combinationGenerator = null
    
    // System state
    this.initialized = false
    this.initializationError = null
    
    // Configuration
    this.config = {
      enableAutoSync: true,
      enableFallback: true,
      enableHealthChecks: true,
      healthCheckInterval: 30000, // 30 seconds
      syncInterval: 60000 // 1 minute
    }
    
    // Performance monitoring
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastHealthCheck: null,
      lastSync: null,
      cacheHits: 0,
      cacheMisses: 0
    }
    
    // Health check interval
    this.healthCheckTimer = null
    this.syncTimer = null
  }

  /**
   * Initialize the unified data manager and all subsystems
   */
  async init () {
    const startTime = performance.now()
    
    try {
      devLogger.manager('UnifiedDataManager: Starting initialization')
      
      // Initialize WordDataManager (which includes category generation system)
      this.wordDataManager = new WordDataManager(this.storageManager)
      const wordManagerInit = await this.wordDataManager.init()
      
      if (!wordManagerInit) {
        throw new Error('WordDataManager initialization failed')
      }
      
      // Get references to component managers from WordDataManager
      this.categoryDataManager = this.wordDataManager.categoryDataManager
      this.letterGenerator = this.wordDataManager.letterGenerator
      this.combinationGenerator = this.wordDataManager.combinationGenerator
      
      // Initialize GameStateManager with WordDataManager integration
      this.gameStateManager = new GameStateManager(
        this.gameInstance,
        this.wordDataManager,
        this.storageManager
      )
      await this.gameStateManager.initializeGameSession()
      
      // Setup health monitoring if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthChecking()
      }
      
      // Setup auto-sync if enabled
      if (this.config.enableAutoSync) {
        this.startAutoSync()
      }
      
      const initTime = performance.now() - startTime
      
      this.initialized = true
      this.stats.lastHealthCheck = Date.now()
      
      devLogger.manager(`UnifiedDataManager: Initialized successfully in ${initTime.toFixed(2)}ms`)
      
      return true
    } catch (error) {
      this.initializationError = error
      trackManagerError('UnifiedDataManager', 'init', error, {
        critical: true,
        context: 'Unified data manager initialization'
      })
      
      // Attempt fallback initialization
      await this.initializeFallback()
      
      return false
    }
  }

  /**
   * Alias for init() method to maintain compatibility
   */
  async initialize() {
    return this.init()
  }

  /**
   * Check if manager is initialized
   */
  isInitialized() {
    return this.initialized
  }

  /**
   * Initialize with fallback configuration when primary init fails
   */
  async initializeFallback () {
    try {
      devLogger.warn('UnifiedDataManager: Attempting fallback initialization')
      
      // Activate graceful degradation
      gracefulDegradation.activateDegradation('word_data_missing', {
        reason: 'UnifiedDataManager initialization failed',
        manager: 'UnifiedDataManager'
      })
      
      // Initialize minimal WordDataManager
      this.wordDataManager = new WordDataManager(null) // No storage
      await this.wordDataManager.init()
      
      // Initialize basic GameStateManager
      this.gameStateManager = new GameStateManager(this.gameInstance, this.wordDataManager, null)
      await this.gameStateManager.initializeGameSession()
      
      this.initialized = true
      
      devLogger.manager('UnifiedDataManager: Fallback initialization completed')
    } catch (fallbackError) {
      trackManagerError('UnifiedDataManager', 'initializeFallback', fallbackError, {
        critical: true,
        context: 'Fallback initialization failed'
      })
      
      this.initialized = false
    }
  }

  // ==========================================
  // UNIFIED DATA ACCESS METHODS
  // ==========================================

  /**
   * Generate a new round with category-letter combination
   */
  async generateRound (roundConfig = {}) {
    return this.executeOperation('generateRound', async () => {
      if (!this.gameStateManager) {
        throw new Error('GameStateManager not available')
      }
      
      return await this.gameStateManager.startRound(roundConfig)
    })
  }

  /**
   * Start a new game session
   */
  async startGameSession (sessionConfig = {}) {
    return this.executeOperation('startGameSession', async () => {
      if (!this.gameStateManager) {
        throw new Error('GameStateManager not available')
      }
      
      return await this.gameStateManager.startGameSession(sessionConfig)
    })
  }

  /**
   * Validate a word for the current round
   */
  async validateWord (word) {
    return this.executeOperation('validateWord', async () => {
      const currentRound = this.gameStateManager?.currentRound
      if (!currentRound) {
        throw new Error('No active round for word validation')
      }
      
      if (!this.wordDataManager) {
        throw new Error('WordDataManager not available')
      }
      
      return this.wordDataManager.validateWordUnified(
        word,
        currentRound.category.id,
        currentRound.letter,
        { roundId: currentRound.id }
      )
    })
  }

  /**
   * Add word to current round
   */
  async addWord (word) {
    return this.executeOperation('addWord', async () => {
      if (!this.gameStateManager) {
        throw new Error('GameStateManager not available')
      }
      
      return await this.gameStateManager.addWordToRound(word)
    })
  }

  /**
   * Complete current round
   */
  async completeRound (reason = 'completed') {
    return this.executeOperation('completeRound', async () => {
      if (!this.gameStateManager) {
        throw new Error('GameStateManager not available')
      }
      
      return await this.gameStateManager.completeRound(reason)
    })
  }

  /**
   * Get unified category data
   */
  getCategories (filters = {}) {
    return this.executeOperation('getCategories', () => {
      if (!this.wordDataManager) {
        throw new Error('WordDataManager not available')
      }
      
      let categories = this.wordDataManager.getUnifiedCategoryData()
      
      // Apply filters
      if (filters.difficulty) {
        categories = categories.filter(cat => cat.difficulty === filters.difficulty)
      }
      
      if (filters.tags && filters.tags.length > 0) {
        categories = categories.filter(cat =>
          filters.tags.some(tag => cat.tags?.includes(tag))
        )
      }
      
      if (filters.letterCompatibility) {
        categories = categories.filter(cat =>
          cat.letterCompatibility?.includes(filters.letterCompatibility.toUpperCase())
        )
      }
      
      return categories
    })
  }

  /**
   * Get words for a specific category
   */
  getCategoryWords (categoryId) {
    return this.executeOperation('getCategoryWords', () => {
      if (!this.wordDataManager) {
        throw new Error('WordDataManager not available')
      }
      
      return this.wordDataManager.getUnifiedCategoryWords(categoryId)
    })
  }

  /**
   * Get word hints for current round
   */
  getWordHints (count = 3) {
    return this.executeOperation('getWordHints', () => {
      const currentRound = this.gameStateManager?.currentRound
      if (!currentRound) {
        return []
      }
      
      if (!this.wordDataManager) {
        return []
      }
      
      return this.wordDataManager.getWordHints(
        currentRound.category.id,
        currentRound.letter,
        count
      )
    })
  }

  /**
   * Get comprehensive game state
   */
  getGameState () {
    return this.executeOperation('getGameState', () => {
      const state = {
        initialized: this.initialized,
        systemHealth: this.getSystemHealth(),
        gameSession: this.gameStateManager?.getGameState() || null,
        wordSystem: this.wordDataManager?.getAdvancedStatistics() || null,
        categorySystem: this.categoryDataManager?.getStats() || null,
        generationSystem: this.getGenerationSystemStatus(),
        performance: this.getPerformanceMetrics()
      }
      
      return state
    })
  }

  /**
   * Get player statistics
   */
  getPlayerStats () {
    return this.executeOperation('getPlayerStats', () => {
      if (!this.gameStateManager) {
        return null
      }
      
      return {
        ...this.gameStateManager.playerStats,
        categoriesPlayed: Array.from(this.gameStateManager.playerStats.categoriesPlayed),
        lettersPlayed: Array.from(this.gameStateManager.playerStats.lettersPlayed)
      }
    })
  }

  /**
   * Get round configurations available
   */
  getRoundConfigurations () {
    return this.executeOperation('getRoundConfigurations', () => {
      if (!this.wordDataManager) {
        throw new Error('WordDataManager not available')
      }
      
      return this.wordDataManager.getRoundConfigurations()
    })
  }

  // ==========================================
  // SYSTEM HEALTH AND MONITORING
  // ==========================================

  /**
   * Get overall system health
   */
  getSystemHealth () {
    const health = {
      overall: 'healthy',
      subsystems: {},
      degradations: gracefulDegradation.getStatus(),
      lastCheck: this.stats.lastHealthCheck
    }
    
    // Check WordDataManager health
    if (this.wordDataManager) {
      const wordSystemStatus = this.wordDataManager.getSystemStatus()
      health.subsystems.wordData = {
        status: wordSystemStatus.status,
        message: wordSystemStatus.message,
        canRecover: wordSystemStatus.canRecover
      }
      
      if (wordSystemStatus.status !== 'healthy') {
        health.overall = 'degraded'
      }
    } else {
      health.subsystems.wordData = { status: 'unavailable', message: 'WordDataManager not initialized' }
      health.overall = 'critical'
    }
    
    // Check GameStateManager health
    if (this.gameStateManager) {
      health.subsystems.gameState = { status: 'healthy', message: 'Game state manager operational' }
    } else {
      health.subsystems.gameState = { status: 'unavailable', message: 'GameStateManager not initialized' }
      health.overall = 'degraded'
    }
    
    // Check category generation system
    const generationStatus = this.getGenerationSystemStatus()
    health.subsystems.generation = {
      status: generationStatus.enabled ? 'healthy' : 'degraded',
      message: generationStatus.enabled ? 'Generation system operational' : 'Using fallback generation'
    }
    
    return health
  }

  /**
   * Get generation system status
   */
  getGenerationSystemStatus () {
    if (!this.wordDataManager) {
      return { enabled: false, reason: 'WordDataManager not available' }
    }
    
    return {
      enabled: this.wordDataManager.generationSystemEnabled,
      categoryManager: this.categoryDataManager ? 'available' : 'unavailable',
      letterGenerator: this.letterGenerator ? 'available' : 'unavailable',
      combinationGenerator: this.combinationGenerator ? 'available' : 'unavailable',
      fallbackActive: gracefulDegradation.isDegradationActive('generation_system_failed')
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck () {
    const startTime = performance.now()
    
    try {
      const healthResults = {
        timestamp: Date.now(),
        duration: 0,
        overall: true,
        subsystems: {}
      }
      
      // Check WordDataManager
      if (this.wordDataManager) {
        try {
          const wordHealthCheck = await this.wordDataManager.performHealthCheck()
          healthResults.subsystems.wordData = {
            healthy: true,
            details: wordHealthCheck
          }
        } catch (error) {
          healthResults.subsystems.wordData = {
            healthy: false,
            error: error.message
          }
          healthResults.overall = false
        }
      }
      
      // Check storage availability
      if (this.storageManager) {
        try {
          await this.storageManager.set('health_check', Date.now())
          await this.storageManager.get('health_check')
          healthResults.subsystems.storage = { healthy: true }
        } catch (error) {
          healthResults.subsystems.storage = { healthy: false, error: error.message }
          healthResults.overall = false
        }
      }
      
      // Check graceful degradation system
      try {
        const degradationHealth = gracefulDegradation.runHealthChecks()
        healthResults.subsystems.degradation = {
          healthy: Object.values(degradationHealth).every(check => check),
          details: degradationHealth
        }
      } catch (error) {
        healthResults.subsystems.degradation = { healthy: false, error: error.message }
      }
      
      healthResults.duration = performance.now() - startTime
      this.stats.lastHealthCheck = Date.now()
      
      devLogger.manager(`UnifiedDataManager: Health check completed in ${healthResults.duration.toFixed(2)}ms`)
      
      return healthResults
    } catch (error) {
      trackManagerError('UnifiedDataManager', 'performHealthCheck', error, {
        context: 'Performing system health check'
      })
      
      return {
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        overall: false,
        error: error.message
      }
    }
  }

  /**
   * Start automated health checking
   */
  startHealthChecking () {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        devLogger.warn('UnifiedDataManager: Automated health check failed', error)
      }
    }, this.config.healthCheckInterval)
    
    devLogger.manager('UnifiedDataManager: Started automated health checking')
  }

  /**
   * Stop automated health checking
   */
  stopHealthChecking () {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
      devLogger.manager('UnifiedDataManager: Stopped automated health checking')
    }
  }

  // ==========================================
  // DATA SYNCHRONIZATION
  // ==========================================

  /**
   * Synchronize data between all managers
   */
  async synchronizeData () {
    return this.executeOperation('synchronizeData', async () => {
      if (!this.wordDataManager) {
        throw new Error('WordDataManager not available for synchronization')
      }
      
      const syncResults = await this.wordDataManager.synchronizeData()
      
      // Save game state after synchronization
      if (this.gameStateManager) {
        await this.gameStateManager.saveGameSessionState()
      }
      
      this.stats.lastSync = Date.now()
      
      return syncResults
    })
  }

  /**
   * Start automated data synchronization
   */
  startAutoSync () {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    
    this.syncTimer = setInterval(async () => {
      try {
        await this.synchronizeData()
        devLogger.manager('UnifiedDataManager: Automated sync completed')
      } catch (error) {
        devLogger.warn('UnifiedDataManager: Automated sync failed', error)
      }
    }, this.config.syncInterval)
    
    devLogger.manager('UnifiedDataManager: Started automated data synchronization')
  }

  /**
   * Stop automated data synchronization
   */
  stopAutoSync () {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      devLogger.manager('UnifiedDataManager: Stopped automated data synchronization')
    }
  }

  // ==========================================
  // PERFORMANCE MONITORING
  // ==========================================

  /**
   * Execute operation with performance monitoring
   */
  async executeOperation (operationName, operation) {
    const startTime = performance.now()
    
    try {
      this.stats.totalOperations++
      
      const result = await operation()
      
      // Update success stats
      this.stats.successfulOperations++
      this.stats.cacheHits++ // Assume cache hit for successful operations
      
      const duration = performance.now() - startTime
      this.updateResponseTimeStats(duration)
      
      return result
    } catch (error) {
      this.stats.failedOperations++
      this.stats.cacheMisses++
      
      trackManagerError('UnifiedDataManager', operationName, error, {
        context: `Operation: ${operationName}`,
        performance: true
      })
      
      // Check if we should activate degradation
      if (this.stats.failedOperations / this.stats.totalOperations > 0.1) {
        gracefulDegradation.activateDegradation('performance_degraded', {
          reason: `High failure rate in ${operationName}`,
          manager: 'UnifiedDataManager'
        })
      }
      
      throw error
    }
  }

  /**
   * Update response time statistics
   */
  updateResponseTimeStats (duration) {
    this.stats.totalResponseTime += duration
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.successfulOperations
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics () {
    const successRate = this.stats.totalOperations > 0
      ? (this.stats.successfulOperations / this.stats.totalOperations) * 100
      : 0
    
    const cacheHitRate = (this.stats.cacheHits + this.stats.cacheMisses) > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
      : 0
    
    return {
      ...this.stats,
      successRate: Number(successRate.toFixed(2)),
      cacheHitRate: Number(cacheHitRate.toFixed(2)),
      operationsPerSecond: this.stats.totalOperations / ((Date.now() - (this.stats.lastHealthCheck || Date.now())) / 1000)
    }
  }

  // ==========================================
  // CONFIGURATION AND UTILITIES
  // ==========================================

  /**
   * Configure unified data manager
   */
  configure (config = {}) {
    this.config = { ...this.config, ...config }
    
    // Apply configuration changes
    if (config.enableHealthChecks !== undefined) {
      if (config.enableHealthChecks && !this.healthCheckTimer) {
        this.startHealthChecking()
      } else if (!config.enableHealthChecks && this.healthCheckTimer) {
        this.stopHealthChecking()
      }
    }
    
    if (config.enableAutoSync !== undefined) {
      if (config.enableAutoSync && !this.syncTimer) {
        this.startAutoSync()
      } else if (!config.enableAutoSync && this.syncTimer) {
        this.stopAutoSync()
      }
    }
    
    // Configure WordDataManager if available
    if (this.wordDataManager && config.wordDataConfig) {
      this.wordDataManager.configureUnifiedSystem(config.wordDataConfig)
    }
    
    devLogger.manager('UnifiedDataManager: Configuration updated', this.config)
    
    return this.config
  }

  /**
   * Export all data for backup
   */
  exportData () {
    return this.executeOperation('exportData', () => {
      const exportData = {
        metadata: {
          exportedAt: Date.now(),
          version: '1.0',
          systemHealth: this.getSystemHealth()
        },
        
        wordData: this.wordDataManager?.exportUnifiedData() || null,
        gameState: this.gameStateManager?.getGameState() || null,
        performance: this.getPerformanceMetrics(),
        configuration: this.config
      }
      
      return exportData
    })
  }

  /**
   * Reset all statistics
   */
  resetStats () {
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastHealthCheck: null,
      lastSync: null,
      cacheHits: 0,
      cacheMisses: 0
    }
    
    devLogger.manager('UnifiedDataManager: Statistics reset')
  }

  /**
   * Destroy the unified data manager
   */
  async destroy () {
    try {
      // Stop timers
      this.stopHealthChecking()
      this.stopAutoSync()
      
      // Perform final sync if needed
      if (this.config.enableAutoSync && this.wordDataManager) {
        await this.synchronizeData()
      }
      
      // Destroy individual managers
      if (this.wordDataManager) {
        this.wordDataManager.destroy?.()
      }
      
      if (this.gameStateManager) {
        this.gameStateManager.destroy?.()
      }
      
      // Clear references
      this.wordDataManager = null
      this.gameStateManager = null
      this.categoryDataManager = null
      this.letterGenerator = null
      this.combinationGenerator = null
      this.storageManager = null
      this.gameInstance = null
      
      this.initialized = false
      
      devLogger.manager('UnifiedDataManager: Destroyed')
    } catch (error) {
      trackManagerError('UnifiedDataManager', 'destroy', error, {
        context: 'Destroying unified data manager'
      })
    }
  }
}

// Export convenience functions
export async function createUnifiedDataManager (storageManager = null, gameInstance = null) {
  const manager = new UnifiedDataManager(storageManager, gameInstance)
  await manager.init()
  return manager
}

export function isUnifiedDataManagerReady (manager) {
  return manager && manager.initialized && !manager.initializationError
}