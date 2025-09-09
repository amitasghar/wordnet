import { devLogger } from './devTools.js'
import { trackManagerError } from './ErrorTracker.js'

/**
 * GracefulDegradation
 * 
 * Handles graceful degradation scenarios when data or services are unavailable.
 * Provides fallback mechanisms and maintains game functionality under adverse conditions.
 */
export class GracefulDegradation {
  constructor () {
    this.degradationLevel = 0 // 0 = normal, 1 = light, 2 = moderate, 3 = severe
    this.activeDegradations = new Set()
    this.fallbackData = {}
    this.recoveryStrategies = {}
    this.healthChecks = new Map()
    
    // Degradation types
    this.degradationTypes = {
      STORAGE_UNAVAILABLE: 'storage_unavailable',
      CATEGORY_DATA_MISSING: 'category_data_missing',
      WORD_DATA_MISSING: 'word_data_missing',
      GENERATION_SYSTEM_FAILED: 'generation_system_failed',
      NETWORK_OFFLINE: 'network_offline',
      PERFORMANCE_DEGRADED: 'performance_degraded',
      MEMORY_CONSTRAINED: 'memory_constrained'
    }
    
    this.setupFallbackData()
    this.setupRecoveryStrategies()
  }

  /**
   * Setup fallback data for emergency use
   */
  setupFallbackData () {
    this.fallbackData = {
      categories: [
        {
          id: 'emergency-basic',
          name: 'Basic Words',
          difficulty: 1,
          words: ['cat', 'dog', 'sun', 'car', 'book', 'home', 'tree', 'ball'],
          metadata: {
            letterCompatibility: ['A', 'B', 'C', 'D', 'H', 'S', 'T'],
            tags: ['emergency'],
            theme: 'Emergency basic category',
            estimatedWords: 8,
            averageWordLength: 4
          }
        },
        {
          id: 'emergency-animals',
          name: 'Animals',
          difficulty: 1,
          words: ['cat', 'dog', 'bird', 'fish', 'cow', 'pig'],
          metadata: {
            letterCompatibility: ['B', 'C', 'D', 'F', 'P'],
            tags: ['emergency', 'animals'],
            theme: 'Emergency animal category',
            estimatedWords: 6,
            averageWordLength: 4
          }
        }
      ],
      
      letters: ['A', 'B', 'C', 'D', 'E', 'S', 'T'],
      
      roundConfigs: {
        emergency: {
          duration: 60,
          difficulty: 1,
          targetWordCount: 5,
          scoring: {
            basePoints: 10,
            lengthMultiplier: 1,
            difficultyBonus: 0
          }
        }
      },
      
      gameSettings: {
        minimalMode: true,
        reducedAnimations: true,
        basicUI: true,
        offlineMode: true
      }
    }
  }

  /**
   * Setup recovery strategies for different degradation types
   */
  setupRecoveryStrategies () {
    this.recoveryStrategies = {
      [this.degradationTypes.STORAGE_UNAVAILABLE]: {
        fallback: () => this.enableMemoryOnlyMode(),
        recovery: () => this.attemptStorageRecovery(),
        userMessage: 'Progress saving disabled - using memory only',
        severity: 2
      },
      
      [this.degradationTypes.CATEGORY_DATA_MISSING]: {
        fallback: () => this.loadEmergencyCategories(),
        recovery: () => this.attemptCategoryRecovery(),
        userMessage: 'Limited categories available',
        severity: 2
      },
      
      [this.degradationTypes.WORD_DATA_MISSING]: {
        fallback: () => this.loadEmergencyWords(),
        recovery: () => this.attemptWordDataRecovery(),
        userMessage: 'Limited word database - some features reduced',
        severity: 3
      },
      
      [this.degradationTypes.GENERATION_SYSTEM_FAILED]: {
        fallback: () => this.enableBasicGeneration(),
        recovery: () => this.attemptGenerationSystemRecovery(),
        userMessage: 'Using basic round generation',
        severity: 1
      },
      
      [this.degradationTypes.NETWORK_OFFLINE]: {
        fallback: () => this.enableOfflineMode(),
        recovery: () => this.attemptNetworkRecovery(),
        userMessage: 'Offline mode - no online features',
        severity: 1
      },
      
      [this.degradationTypes.PERFORMANCE_DEGRADED]: {
        fallback: () => this.enablePerformanceMode(),
        recovery: () => this.attemptPerformanceRecovery(),
        userMessage: 'Performance mode - reduced visual effects',
        severity: 1
      },
      
      [this.degradationTypes.MEMORY_CONSTRAINED]: {
        fallback: () => this.enableLowMemoryMode(),
        recovery: () => this.attemptMemoryRecovery(),
        userMessage: 'Low memory mode - reduced caching',
        severity: 2
      }
    }
  }

  /**
   * Activate degradation for a specific type
   */
  activateDegradation (type, context = {}) {
    try {
      if (this.activeDegradations.has(type)) {
        devLogger.warn(`GracefulDegradation: ${type} already active`)
        return false
      }
      
      const strategy = this.recoveryStrategies[type]
      if (!strategy) {
        devLogger.error(`GracefulDegradation: Unknown degradation type: ${type}`)
        return false
      }
      
      // Track the degradation
      trackManagerError('GracefulDegradation', 'activateDegradation', 
        new Error(`Degradation activated: ${type}`), {
          manager: 'GracefulDegradation',
          degradationType: type,
          context: context.reason || 'Unknown',
          fallback: true
        }
      )
      
      // Execute fallback strategy
      strategy.fallback()
      
      // Add to active degradations
      this.activeDegradations.add(type)
      
      // Update degradation level
      this.updateDegradationLevel()
      
      devLogger.warn(`GracefulDegradation: Activated ${type} - ${strategy.userMessage}`)
      
      return true
    } catch (error) {
      devLogger.error(`GracefulDegradation: Failed to activate ${type}`, error)
      return false
    }
  }

  /**
   * Deactivate degradation and attempt recovery
   */
  async deactivateDegradation (type) {
    try {
      if (!this.activeDegradations.has(type)) {
        return true
      }
      
      const strategy = this.recoveryStrategies[type]
      if (!strategy) {
        return false
      }
      
      // Attempt recovery
      const recovered = await strategy.recovery()
      
      if (recovered) {
        this.activeDegradations.delete(type)
        this.updateDegradationLevel()
        
        devLogger.info(`GracefulDegradation: Recovered from ${type}`)
        return true
      }
      
      devLogger.warn(`GracefulDegradation: Recovery failed for ${type}`)
      return false
    } catch (error) {
      devLogger.error(`GracefulDegradation: Recovery error for ${type}`, error)
      return false
    }
  }

  /**
   * Update overall degradation level
   */
  updateDegradationLevel () {
    let maxSeverity = 0
    
    for (const type of this.activeDegradations) {
      const strategy = this.recoveryStrategies[type]
      if (strategy && strategy.severity > maxSeverity) {
        maxSeverity = strategy.severity
      }
    }
    
    this.degradationLevel = maxSeverity
    devLogger.info(`GracefulDegradation: Level updated to ${this.degradationLevel}`)
  }

  /**
   * Check if specific degradation is active
   */
  isDegradationActive (type) {
    return this.activeDegradations.has(type)
  }

  /**
   * Get current degradation status
   */
  getStatus () {
    return {
      level: this.degradationLevel,
      activeDegradations: Array.from(this.activeDegradations),
      userMessages: this.getUserMessages(),
      canRecover: this.canAttemptRecovery(),
      fallbackDataAvailable: this.isFallbackDataAvailable()
    }
  }

  /**
   * Get user-friendly messages for active degradations
   */
  getUserMessages () {
    const messages = []
    
    for (const type of this.activeDegradations) {
      const strategy = this.recoveryStrategies[type]
      if (strategy && strategy.userMessage) {
        messages.push(strategy.userMessage)
      }
    }
    
    return messages
  }

  /**
   * Check if recovery can be attempted
   */
  canAttemptRecovery () {
    return this.activeDegradations.size > 0
  }

  /**
   * Check if fallback data is available
   */
  isFallbackDataAvailable () {
    return Boolean(
      this.fallbackData.categories?.length > 0 &&
      this.fallbackData.letters?.length > 0
    )
  }

  // =================================
  // FALLBACK IMPLEMENTATIONS
  // =================================

  /**
   * Enable memory-only mode (no persistent storage)
   */
  enableMemoryOnlyMode () {
    devLogger.info('GracefulDegradation: Enabling memory-only mode')
    
    // Disable all storage operations
    this.memoryOnlyMode = true
    
    return true
  }

  /**
   * Load emergency categories
   */
  loadEmergencyCategories () {
    devLogger.info('GracefulDegradation: Loading emergency categories')
    
    // Return fallback categories
    return this.fallbackData.categories
  }

  /**
   * Load emergency word data
   */
  loadEmergencyWords () {
    devLogger.info('GracefulDegradation: Loading emergency word data')
    
    // Extract words from emergency categories
    const words = {}
    
    for (const category of this.fallbackData.categories) {
      words[category.id] = category.words.map(word => ({
        word,
        difficulty: 'easy',
        category: category.id,
        length: word.length,
        commonality: 'common',
        points: 10
      }))
    }
    
    return words
  }

  /**
   * Enable basic generation (no advanced algorithms)
   */
  enableBasicGeneration () {
    devLogger.info('GracefulDegradation: Enabling basic generation')
    
    this.basicGenerationMode = true
    
    return {
      generateBasicRound: () => this.generateBasicRound(),
      getEmergencyConfig: () => this.fallbackData.roundConfigs.emergency
    }
  }

  /**
   * Generate basic round without advanced systems
   */
  generateBasicRound () {
    const categories = this.fallbackData.categories
    const letters = this.fallbackData.letters
    
    if (categories.length === 0 || letters.length === 0) {
      return null
    }
    
    const category = categories[Math.floor(Math.random() * categories.length)]
    const letter = letters[Math.floor(Math.random() * letters.length)]
    
    return {
      category,
      letter,
      difficulty: 1,
      playability: {
        score: 5,
        feasible: true,
        estimatedWords: 3,
        reason: 'Emergency generation'
      },
      roundConfig: this.fallbackData.roundConfigs.emergency,
      metadata: {
        generationType: 'emergency',
        generatedAt: Date.now()
      }
    }
  }

  /**
   * Enable offline mode
   */
  enableOfflineMode () {
    devLogger.info('GracefulDegradation: Enabling offline mode')
    
    this.offlineMode = true
    
    return {
      disableNetworkFeatures: true,
      useLocalDataOnly: true,
      settings: this.fallbackData.gameSettings
    }
  }

  /**
   * Enable performance mode
   */
  enablePerformanceMode () {
    devLogger.info('GracefulDegradation: Enabling performance mode')
    
    this.performanceMode = true
    
    return {
      reducedAnimations: true,
      limitedVisualEffects: true,
      optimizedRendering: true
    }
  }

  /**
   * Enable low memory mode
   */
  enableLowMemoryMode () {
    devLogger.info('GracefulDegradation: Enabling low memory mode')
    
    this.lowMemoryMode = true
    
    return {
      reducedCaching: true,
      limitedHistory: true,
      compactDataStructures: true
    }
  }

  // =================================
  // RECOVERY IMPLEMENTATIONS
  // =================================

  /**
   * Attempt storage recovery
   */
  async attemptStorageRecovery () {
    try {
      // Test localStorage availability
      const testKey = 'graceful_degradation_test'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      
      this.memoryOnlyMode = false
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Attempt category recovery
   */
  async attemptCategoryRecovery () {
    // In a real implementation, this would try to reload category data
    // For now, we'll simulate a recovery attempt
    return Math.random() > 0.7 // 30% success rate
  }

  /**
   * Attempt word data recovery
   */
  async attemptWordDataRecovery () {
    // In a real implementation, this would try to reload word data
    return Math.random() > 0.8 // 20% success rate
  }

  /**
   * Attempt generation system recovery
   */
  async attemptGenerationSystemRecovery () {
    // Try to reinitialize the generation system
    try {
      this.basicGenerationMode = false
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Attempt network recovery
   */
  async attemptNetworkRecovery () {
    try {
      // Simple network connectivity test
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        this.offlineMode = false
        return true
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Attempt performance recovery
   */
  async attemptPerformanceRecovery () {
    // Check if performance has improved
    const start = performance.now()
    
    // Simple performance test
    for (let i = 0; i < 10000; i++) {
      Math.random()
    }
    
    const elapsed = performance.now() - start
    
    if (elapsed < 10) { // If under 10ms, performance is good
      this.performanceMode = false
      return true
    }
    
    return false
  }

  /**
   * Attempt memory recovery
   */
  async attemptMemoryRecovery () {
    try {
      // Simple memory pressure test
      if (typeof performance !== 'undefined' && performance.memory) {
        const memInfo = performance.memory
        const memoryPressure = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit
        
        if (memoryPressure < 0.8) { // Less than 80% memory usage
          this.lowMemoryMode = false
          return true
        }
      } else {
        // If no memory info available, assume recovery
        this.lowMemoryMode = false
        return true
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Attempt recovery for all active degradations
   */
  async attemptFullRecovery () {
    const recoveryResults = {}
    
    for (const type of this.activeDegradations) {
      try {
        recoveryResults[type] = await this.deactivateDegradation(type)
      } catch (error) {
        recoveryResults[type] = false
        devLogger.error(`GracefulDegradation: Recovery failed for ${type}`, error)
      }
    }
    
    return recoveryResults
  }

  /**
   * Setup health checks for proactive degradation detection
   */
  setupHealthChecks () {
    // Storage health check
    this.healthChecks.set('storage', () => {
      try {
        const testKey = 'health_check_storage'
        localStorage.setItem(testKey, 'test')
        localStorage.removeItem(testKey)
        return true
      } catch (error) {
        return false
      }
    })
    
    // Memory health check
    this.healthChecks.set('memory', () => {
      try {
        if (typeof performance !== 'undefined' && performance.memory) {
          const memInfo = performance.memory
          return (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) < 0.9
        }
        return true
      } catch (error) {
        return false
      }
    })
    
    // Performance health check
    this.healthChecks.set('performance', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        Math.random()
      }
      return (performance.now() - start) < 5
    })
  }

  /**
   * Run all health checks
   */
  runHealthChecks () {
    const results = {}
    
    for (const [name, check] of this.healthChecks) {
      try {
        results[name] = check()
      } catch (error) {
        results[name] = false
        devLogger.warn(`GracefulDegradation: Health check failed for ${name}`, error)
      }
    }
    
    return results
  }

  /**
   * Get fallback data
   */
  getFallbackData () {
    return { ...this.fallbackData }
  }

  /**
   * Reset degradation state
   */
  reset () {
    this.activeDegradations.clear()
    this.degradationLevel = 0
    this.memoryOnlyMode = false
    this.basicGenerationMode = false
    this.offlineMode = false
    this.performanceMode = false
    this.lowMemoryMode = false
    
    devLogger.info('GracefulDegradation: Reset to normal state')
  }
}

// Export singleton instance
export const gracefulDegradation = new GracefulDegradation()

// Helper functions for easy access
export function activateDegradation (type, context) {
  return gracefulDegradation.activateDegradation(type, context)
}

export function deactivateDegradation (type) {
  return gracefulDegradation.deactivateDegradation(type)
}

export function getDegradationStatus () {
  return gracefulDegradation.getStatus()
}

export function getFallbackData () {
  return gracefulDegradation.getFallbackData()
}