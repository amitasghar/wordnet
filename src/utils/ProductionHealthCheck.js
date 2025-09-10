// Production health checks and system status monitoring
import { diagnosticTools } from '@/utils/DiagnosticTools.js'
import { devLogger } from '@/utils/devTools.js'

export class ProductionHealthCheck {
  constructor() {
    this.checks = new Map()
    this.systemStatus = {
      overall: 'unknown',
      components: {},
      lastCheck: null,
      uptime: Date.now()
    }
    
    this.thresholds = {
      responseTime: 200,
      memoryUsage: 80, // percentage
      errorRate: 5, // percentage
      frameRate: 30
    }
    
    this.isInitialized = false
  }

  /**
   * Initialize production health checks
   */
  async initialize() {
    if (this.isInitialized) return
    
    try {
      await this.registerCoreHealthChecks()
      await this.registerManagerHealthChecks()
      await this.registerSystemHealthChecks()
      
      this.isInitialized = true
      devLogger.info('ProductionHealthCheck: Initialized successfully')
      
      // Start monitoring
      this.startMonitoring()
      
    } catch (error) {
      devLogger.error('ProductionHealthCheck: Failed to initialize', error)
      throw error
    }
  }

  /**
   * Register core application health checks
   */
  async registerCoreHealthChecks() {
    // Game initialization check
    diagnosticTools.registerHealthCheck('game_initialization', async () => {
      try {
        // Check if main game components are accessible
        const gameInstance = window.gameInstance
        if (!gameInstance) {
          return { status: 'unhealthy', reason: 'Game instance not found' }
        }
        
        if (!gameInstance.initialized) {
          return { status: 'unhealthy', reason: 'Game not initialized' }
        }
        
        return {
          status: 'healthy',
          gameInstance: !!gameInstance,
          initialized: gameInstance.initialized,
          scenes: gameInstance.game?.scene?.scenes?.length || 0
        }
      } catch (error) {
        return { status: 'unhealthy', reason: error.message }
      }
    }, { critical: true, interval: 60000 })

    // Storage system check
    diagnosticTools.registerHealthCheck('storage_system', async () => {
      try {
        const testKey = 'health_check_test'
        const testValue = { timestamp: Date.now() }
        
        // Test localStorage
        localStorage.setItem(testKey, JSON.stringify(testValue))
        const retrieved = JSON.parse(localStorage.getItem(testKey))
        localStorage.removeItem(testKey)
        
        if (retrieved.timestamp !== testValue.timestamp) {
          return { status: 'unhealthy', reason: 'localStorage data integrity failed' }
        }
        
        // Test IndexedDB availability
        const idbAvailable = 'indexedDB' in window
        
        return {
          status: 'healthy',
          localStorage: true,
          indexedDB: idbAvailable,
          storageQuota: await this.getStorageQuota()
        }
      } catch (error) {
        return { status: 'unhealthy', reason: `Storage error: ${error.message}` }
      }
    }, { critical: true, interval: 300000 })

    // Canvas and rendering check
    diagnosticTools.registerHealthCheck('rendering_system', async () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          return { status: 'unhealthy', reason: 'Canvas 2D context not available' }
        }
        
        // Test WebGL availability
        const webglCtx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        
        return {
          status: 'healthy',
          canvas2D: true,
          webGL: !!webglCtx,
          devicePixelRatio: window.devicePixelRatio || 1,
          viewport: `${window.innerWidth}x${window.innerHeight}`
        }
      } catch (error) {
        return { status: 'unhealthy', reason: `Rendering error: ${error.message}` }
      }
    }, { critical: true, interval: 300000 })
  }

  /**
   * Register manager-specific health checks
   */
  async registerManagerHealthChecks() {
    // Category manager health
    diagnosticTools.registerHealthCheck('category_manager', async () => {
      try {
        const categoryManager = window.wordDataManager?.categoryManager || 
                               window.unifiedManager?.categoryManager
        
        if (!categoryManager) {
          return { status: 'unhealthy', reason: 'CategoryManager not found' }
        }
        
        if (!categoryManager.initialized) {
          return { status: 'unhealthy', reason: 'CategoryManager not initialized' }
        }
        
        const categories = categoryManager.getCategories()
        if (categories.length === 0) {
          return { status: 'unhealthy', reason: 'No categories loaded' }
        }
        
        return {
          status: 'healthy',
          initialized: true,
          categoryCount: categories.length,
          cacheStats: categoryManager.stats?.cacheStats?.() || null
        }
      } catch (error) {
        return { status: 'unhealthy', reason: error.message }
      }
    }, { critical: true, interval: 120000 })

    // Letter generator health
    diagnosticTools.registerHealthCheck('letter_generator', async () => {
      try {
        const letterGenerator = window.wordDataManager?.letterGenerator ||
                              window.unifiedManager?.letterGenerator
        
        if (!letterGenerator) {
          return { status: 'unhealthy', reason: 'LetterGenerator not found' }
        }
        
        // Test letter generation
        const startTime = performance.now()
        const letter = letterGenerator.generateLetter()
        const duration = performance.now() - startTime
        
        if (!letter || typeof letter !== 'string') {
          return { status: 'unhealthy', reason: 'Letter generation failed' }
        }
        
        return {
          status: 'healthy',
          generationTime: Math.round(duration * 100) / 100,
          testLetter: letter,
          performance: duration < this.thresholds.responseTime ? 'good' : 'slow'
        }
      } catch (error) {
        return { status: 'unhealthy', reason: error.message }
      }
    }, { critical: false, interval: 180000 })

    // Combination generator health
    diagnosticTools.registerHealthCheck('combination_generator', async () => {
      try {
        const combinationGenerator = window.wordDataManager?.combinationGenerator ||
                                   window.unifiedManager?.combinationGenerator
        
        if (!combinationGenerator) {
          return { status: 'unhealthy', reason: 'CombinationGenerator not found' }
        }
        
        // Test combination generation
        const startTime = performance.now()
        const combination = await combinationGenerator.generateCombination()
        const duration = performance.now() - startTime
        
        if (!combination || !combination.category || !combination.letter) {
          return { status: 'unhealthy', reason: 'Combination generation failed' }
        }
        
        return {
          status: 'healthy',
          generationTime: Math.round(duration * 100) / 100,
          testCombination: {
            category: combination.category.name,
            letter: combination.letter
          },
          performance: duration < this.thresholds.responseTime ? 'good' : 'slow'
        }
      } catch (error) {
        return { status: 'unhealthy', reason: error.message }
      }
    }, { critical: true, interval: 180000 })
  }

  /**
   * Register system-level health checks
   */
  async registerSystemHealthChecks() {
    // Memory pressure check
    diagnosticTools.registerHealthCheck('memory_pressure', async () => {
      if (!performance.memory) {
        return { status: 'unavailable', reason: 'Performance Memory API not available' }
      }
      
      const memory = performance.memory
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      const utilization = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      
      const status = utilization > this.thresholds.memoryUsage ? 'unhealthy' : 'healthy'
      
      return {
        status,
        usedMB,
        limitMB,
        utilization: Math.round(utilization),
        threshold: this.thresholds.memoryUsage,
        warning: utilization > (this.thresholds.memoryUsage * 0.8)
      }
    }, { critical: true, interval: 30000 })

    // Performance monitoring check
    diagnosticTools.registerHealthCheck('performance_metrics', async () => {
      const metrics = {
        now: performance.now(),
        timing: null,
        navigation: null
      }
      
      // Navigation timing if available
      if (performance.timing) {
        metrics.timing = {
          domContentLoaded: performance.timing.domContentLoadedEventStart - performance.timing.navigationStart,
          loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
        }
      }
      
      // Navigation info
      if (performance.navigation) {
        metrics.navigation = {
          type: performance.navigation.type,
          redirectCount: performance.navigation.redirectCount
        }
      }
      
      return {
        status: 'healthy',
        metrics,
        uptime: Date.now() - this.systemStatus.uptime
      }
    }, { critical: false, interval: 120000 })

    // Network connectivity check
    diagnosticTools.registerHealthCheck('network_connectivity', async () => {
      return {
        status: navigator.onLine ? 'healthy' : 'unhealthy',
        online: navigator.onLine,
        connection: navigator.connection ? {
          type: navigator.connection.type,
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt
        } : null
      }
    }, { critical: false, interval: 60000 })
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage,
          utilization: Math.round((estimate.usage / estimate.quota) * 100)
        }
      }
    } catch (error) {
      devLogger.warn('Failed to get storage quota:', error)
    }
    
    return null
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    // Start diagnostic tools
    diagnosticTools.start()
    
    // Listen for alerts
    if (typeof window !== 'undefined') {
      window.addEventListener('diagnostic:alert', this.handleAlert.bind(this))
    }
    
    // Periodic status updates
    setInterval(() => {
      this.updateSystemStatus()
    }, 30000) // Every 30 seconds
    
    devLogger.info('ProductionHealthCheck: Monitoring started')
  }

  /**
   * Handle diagnostic alerts
   */
  handleAlert(event) {
    const alert = event.detail
    devLogger.warn(`Health Alert: ${alert.message}`, alert)
    
    // Update component status based on alert
    if (alert.type === 'health_check_failed') {
      this.systemStatus.components[alert.data.checkName] = {
        status: 'unhealthy',
        error: alert.data.error,
        timestamp: alert.timestamp
      }
    }
    
    this.updateSystemStatus()
  }

  /**
   * Update overall system status
   */
  updateSystemStatus() {
    const healthChecks = diagnosticTools.diagnostics.get('health_checks')
    
    if (healthChecks) {
      this.systemStatus.lastCheck = healthChecks.timestamp
      
      // Update component statuses
      for (const result of healthChecks.results) {
        this.systemStatus.components[result.name] = {
          status: result.status,
          result: result.result,
          duration: result.duration,
          timestamp: result.timestamp,
          error: result.error
        }
      }
      
      // Calculate overall status
      this.systemStatus.overall = this.calculateOverallStatus()
    }
  }

  /**
   * Calculate overall system status
   */
  calculateOverallStatus() {
    const components = Object.values(this.systemStatus.components)
    
    if (components.length === 0) return 'unknown'
    
    const unhealthyComponents = components.filter(c => c.status === 'unhealthy')
    const criticalChecks = ['game_initialization', 'storage_system', 'rendering_system', 'category_manager']
    
    // Check if any critical components are unhealthy
    const criticalUnhealthy = unhealthyComponents.some(c => 
      criticalChecks.some(check => c.name === check || (c.result && c.result.critical))
    )
    
    if (criticalUnhealthy) return 'critical'
    if (unhealthyComponents.length > components.length * 0.3) return 'degraded'
    if (unhealthyComponents.length > 0) return 'warning'
    
    return 'healthy'
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    return {
      ...this.systemStatus,
      uptime: Date.now() - this.systemStatus.uptime,
      checks: Array.from(diagnosticTools.healthChecks.keys()),
      alerts: diagnosticTools.getRecentAlerts(1), // Last hour
      thresholds: this.thresholds
    }
  }

  /**
   * Get health report
   */
  getHealthReport() {
    const diagnosticReport = diagnosticTools.getDiagnosticReport()
    
    return {
      timestamp: Date.now(),
      systemStatus: this.getSystemStatus(),
      diagnostics: diagnosticReport,
      recommendations: this.generateRecommendations(diagnosticReport),
      summary: this.generateSummary()
    }
  }

  /**
   * Generate recommendations based on health status
   */
  generateRecommendations(diagnosticReport) {
    const recommendations = []
    
    // Memory recommendations
    if (diagnosticReport.system?.memory?.utilization > this.thresholds.memoryUsage) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Memory usage is high. Consider clearing caches or reducing resource usage.',
        action: 'reduce_memory_usage'
      })
    }
    
    // Performance recommendations
    const healthChecks = diagnosticReport.healthChecks
    if (healthChecks?.results) {
      const slowChecks = healthChecks.results.filter(check => 
        check.duration > this.thresholds.responseTime
      )
      
      if (slowChecks.length > 0) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          message: `${slowChecks.length} health checks are running slowly.`,
          action: 'optimize_performance',
          details: slowChecks.map(check => check.name)
        })
      }
    }
    
    // Component recommendations
    const unhealthyComponents = Object.entries(this.systemStatus.components)
      .filter(([, component]) => component.status === 'unhealthy')
    
    if (unhealthyComponents.length > 0) {
      recommendations.push({
        type: 'components',
        priority: 'high',
        message: `${unhealthyComponents.length} components are unhealthy.`,
        action: 'fix_unhealthy_components',
        details: unhealthyComponents.map(([name]) => name)
      })
    }
    
    return recommendations
  }

  /**
   * Generate health summary
   */
  generateSummary() {
    const components = Object.values(this.systemStatus.components)
    const healthy = components.filter(c => c.status === 'healthy').length
    const total = components.length
    
    return {
      overall: this.systemStatus.overall,
      healthyComponents: healthy,
      totalComponents: total,
      healthRate: total > 0 ? Math.round((healthy / total) * 100) : 0,
      uptime: Date.now() - this.systemStatus.uptime,
      lastCheck: this.systemStatus.lastCheck
    }
  }

  /**
   * Force health check run
   */
  async runHealthChecks() {
    await diagnosticTools.runHealthChecks()
    this.updateSystemStatus()
    return this.getSystemStatus()
  }

  /**
   * Reset health monitoring
   */
  reset() {
    this.systemStatus = {
      overall: 'unknown',
      components: {},
      lastCheck: null,
      uptime: Date.now()
    }
    
    diagnosticTools.alerts = []
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    diagnosticTools.stop()
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('diagnostic:alert', this.handleAlert.bind(this))
    }
    
    this.isInitialized = false
  }
}

// Global production health check instance
export const productionHealthCheck = new ProductionHealthCheck()