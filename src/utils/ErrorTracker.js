import { devLogger } from './devTools.js'

/**
 * ErrorTracker
 * 
 * Comprehensive error tracking and reporting system for the word game.
 * Tracks errors, categorizes them, and provides recovery suggestions.
 */
export class ErrorTracker {
  constructor (storageManager = null) {
    this.storageManager = storageManager
    this.errors = []
    this.errorStats = {
      total: 0,
      byCategory: {},
      bySeverity: {},
      byManager: {},
      recoverable: 0,
      critical: 0
    }
    
    // Error categories for classification
    this.categories = {
      INITIALIZATION: 'initialization',
      DATA_LOADING: 'data_loading',
      VALIDATION: 'validation',
      GENERATION: 'generation',
      STORAGE: 'storage',
      NETWORK: 'network',
      PERFORMANCE: 'performance',
      USER_INPUT: 'user_input',
      UNKNOWN: 'unknown'
    }
    
    // Severity levels
    this.severity = {
      LOW: 1,      // Minor issues, doesn't affect functionality
      MEDIUM: 2,   // Some features affected, workarounds available
      HIGH: 3,     // Major features broken, limited functionality
      CRITICAL: 4  // Game breaking, requires immediate attention
    }
    
    this.maxStoredErrors = 100
    this.initialized = false
  }

  /**
   * Initialize the error tracker
   */
  async init () {
    try {
      devLogger.storage('ErrorTracker: Initializing error tracking system')
      
      // Load previous error history if available
      if (this.storageManager) {
        await this.loadErrorHistory()
      }
      
      // Setup global error handlers
      this.setupGlobalHandlers()
      
      this.initialized = true
      devLogger.storage('ErrorTracker: Error tracking system initialized')
      
      return true
    } catch (error) {
      console.error('ErrorTracker: Failed to initialize', error)
      this.initialized = false
      return false
    }
  }

  /**
   * Track an error with detailed context
   */
  trackError (error, context = {}) {
    try {
      const errorEntry = {
        id: this.generateErrorId(),
        timestamp: Date.now(),
        message: error.message || 'Unknown error',
        stack: error.stack || '',
        category: this.categorizeError(error, context),
        severity: this.assessSeverity(error, context),
        manager: context.manager || 'unknown',
        operation: context.operation || 'unknown',
        recoverable: this.isRecoverable(error, context),
        recovery: this.suggestRecovery(error, context),
        userImpact: this.assessUserImpact(error, context),
        context: {
          ...context,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          url: typeof window !== 'undefined' ? window.location?.href : 'unknown'
        },
        resolved: false
      }
      
      // Add to errors array
      this.errors.unshift(errorEntry)
      
      // Limit stored errors
      if (this.errors.length > this.maxStoredErrors) {
        this.errors = this.errors.slice(0, this.maxStoredErrors)
      }
      
      // Update statistics
      this.updateStats(errorEntry)
      
      // Log appropriately based on severity
      this.logError(errorEntry)
      
      // Auto-persist if storage available
      if (this.storageManager) {
        this.saveErrorHistory().catch(err => 
          console.warn('ErrorTracker: Failed to save error history', err)
        )
      }
      
      return errorEntry.id
    } catch (trackingError) {
      console.error('ErrorTracker: Failed to track error', trackingError)
      return null
    }
  }

  /**
   * Categorize error based on content and context
   */
  categorizeError (error, context) {
    const message = error.message?.toLowerCase() || ''
    const operation = context.operation?.toLowerCase() || ''
    const manager = context.manager?.toLowerCase() || ''
    
    // Initialization errors
    if (operation.includes('init') || message.includes('initialize')) {
      return this.categories.INITIALIZATION
    }
    
    // Data loading errors
    if (operation.includes('load') || message.includes('load') || message.includes('fetch')) {
      return this.categories.DATA_LOADING
    }
    
    // Validation errors
    if (operation.includes('validat') || message.includes('invalid') || message.includes('validat')) {
      return this.categories.VALIDATION
    }
    
    // Generation errors
    if (operation.includes('generat') || manager.includes('generator')) {
      return this.categories.GENERATION
    }
    
    // Storage errors
    if (operation.includes('save') || operation.includes('storage') || manager.includes('storage')) {
      return this.categories.STORAGE
    }
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return this.categories.NETWORK
    }
    
    // Performance errors
    if (message.includes('timeout') || message.includes('performance') || context.performance) {
      return this.categories.PERFORMANCE
    }
    
    // User input errors
    if (context.userInput || message.includes('input')) {
      return this.categories.USER_INPUT
    }
    
    return this.categories.UNKNOWN
  }

  /**
   * Assess error severity
   */
  assessSeverity (error, context) {
    const message = error.message?.toLowerCase() || ''
    const category = this.categorizeError(error, context)
    
    // Critical errors
    if (message.includes('cannot read') || message.includes('undefined')) {
      return this.severity.CRITICAL
    }
    
    if (category === this.categories.INITIALIZATION && context.critical) {
      return this.severity.CRITICAL
    }
    
    // High severity
    if (category === this.categories.DATA_LOADING && !context.fallback) {
      return this.severity.HIGH
    }
    
    if (category === this.categories.GENERATION && context.required) {
      return this.severity.HIGH
    }
    
    // Medium severity
    if (category === this.categories.STORAGE) {
      return this.severity.MEDIUM
    }
    
    if (category === this.categories.VALIDATION && !context.optional) {
      return this.severity.MEDIUM
    }
    
    // Low severity (default)
    return this.severity.LOW
  }

  /**
   * Determine if error is recoverable
   */
  isRecoverable (error, context) {
    const category = this.categorizeError(error, context)
    
    // Generally recoverable categories
    const recoverableCategories = [
      this.categories.STORAGE,
      this.categories.NETWORK,
      this.categories.USER_INPUT,
      this.categories.PERFORMANCE
    ]
    
    if (recoverableCategories.includes(category)) {
      return true
    }
    
    // Check for fallback mechanisms
    if (context.fallback || context.retry) {
      return true
    }
    
    // Validation errors are usually recoverable
    if (category === this.categories.VALIDATION) {
      return true
    }
    
    return false
  }

  /**
   * Suggest recovery actions
   */
  suggestRecovery (error, context) {
    const category = this.categorizeError(error, context)
    const suggestions = []
    
    switch (category) {
      case this.categories.INITIALIZATION:
        suggestions.push('Restart the application')
        suggestions.push('Clear browser cache and reload')
        if (context.fallback) suggestions.push('Use fallback initialization')
        break
        
      case this.categories.DATA_LOADING:
        suggestions.push('Retry loading data')
        suggestions.push('Use cached data if available')
        suggestions.push('Load default/fallback data')
        break
        
      case this.categories.STORAGE:
        suggestions.push('Clear local storage')
        suggestions.push('Use in-memory storage')
        suggestions.push('Retry save operation')
        break
        
      case this.categories.NETWORK:
        suggestions.push('Check internet connection')
        suggestions.push('Retry request')
        suggestions.push('Use offline mode')
        break
        
      case this.categories.VALIDATION:
        suggestions.push('Validate input data')
        suggestions.push('Use default values')
        suggestions.push('Skip validation if optional')
        break
        
      case this.categories.GENERATION:
        suggestions.push('Use fallback generation method')
        suggestions.push('Simplify generation parameters')
        suggestions.push('Retry with different settings')
        break
        
      case this.categories.PERFORMANCE:
        suggestions.push('Reduce data size')
        suggestions.push('Implement caching')
        suggestions.push('Optimize algorithm')
        break
        
      case this.categories.USER_INPUT:
        suggestions.push('Show user-friendly error message')
        suggestions.push('Provide input validation hints')
        suggestions.push('Use default values')
        break
        
      default:
        suggestions.push('Restart the affected component')
        suggestions.push('Report the issue')
        suggestions.push('Try again later')
    }
    
    return suggestions
  }

  /**
   * Assess user impact
   */
  assessUserImpact (error, context) {
    const severity = this.assessSeverity(error, context)
    const category = this.categorizeError(error, context)
    
    const impacts = {
      [this.severity.CRITICAL]: 'Game completely broken, cannot play',
      [this.severity.HIGH]: 'Major features unavailable, limited gameplay',
      [this.severity.MEDIUM]: 'Some features affected, workarounds available',
      [this.severity.LOW]: 'Minor issue, minimal impact on gameplay'
    }
    
    let impact = impacts[severity] || 'Unknown impact'
    
    // Add category-specific details
    if (category === this.categories.STORAGE) {
      impact += ' (progress may not be saved)'
    } else if (category === this.categories.GENERATION) {
      impact += ' (new rounds may not work)'
    } else if (category === this.categories.DATA_LOADING) {
      impact += ' (game content unavailable)'
    }
    
    return impact
  }

  /**
   * Generate unique error ID
   */
  generateErrorId () {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update error statistics
   */
  updateStats (errorEntry) {
    this.errorStats.total++
    
    // By category
    this.errorStats.byCategory[errorEntry.category] = 
      (this.errorStats.byCategory[errorEntry.category] || 0) + 1
    
    // By severity
    this.errorStats.bySeverity[errorEntry.severity] = 
      (this.errorStats.bySeverity[errorEntry.severity] || 0) + 1
    
    // By manager
    this.errorStats.byManager[errorEntry.manager] = 
      (this.errorStats.byManager[errorEntry.manager] || 0) + 1
    
    // Special counters
    if (errorEntry.recoverable) {
      this.errorStats.recoverable++
    }
    
    if (errorEntry.severity === this.severity.CRITICAL) {
      this.errorStats.critical++
    }
  }

  /**
   * Log error with appropriate level
   */
  logError (errorEntry) {
    const logData = {
      id: errorEntry.id,
      category: errorEntry.category,
      severity: errorEntry.severity,
      manager: errorEntry.manager,
      operation: errorEntry.operation,
      recoverable: errorEntry.recoverable,
      userImpact: errorEntry.userImpact
    }
    
    switch (errorEntry.severity) {
      case this.severity.CRITICAL:
        devLogger.error(`CRITICAL ERROR [${errorEntry.category}]`, errorEntry.message, logData)
        break
      case this.severity.HIGH:
        devLogger.error(`HIGH SEVERITY [${errorEntry.category}]`, errorEntry.message, logData)
        break
      case this.severity.MEDIUM:
        devLogger.warn(`MEDIUM SEVERITY [${errorEntry.category}]`, errorEntry.message, logData)
        break
      default:
        devLogger.info(`LOW SEVERITY [${errorEntry.category}]`, errorEntry.message, logData)
    }
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers () {
    if (typeof window !== 'undefined') {
      // Unhandled JavaScript errors
      window.addEventListener('error', (event) => {
        this.trackError(event.error || new Error(event.message), {
          manager: 'global',
          operation: 'unhandled_error',
          critical: true,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        })
      })
      
      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.trackError(event.reason || new Error('Unhandled promise rejection'), {
          manager: 'global',
          operation: 'unhandled_rejection',
          critical: true
        })
      })
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors (count = 10, category = null, severity = null) {
    let filteredErrors = [...this.errors]
    
    if (category) {
      filteredErrors = filteredErrors.filter(err => err.category === category)
    }
    
    if (severity) {
      filteredErrors = filteredErrors.filter(err => err.severity === severity)
    }
    
    return filteredErrors.slice(0, count)
  }

  /**
   * Get error statistics
   */
  getStats () {
    return {
      ...this.errorStats,
      recentErrors: this.errors.slice(0, 5).map(err => ({
        id: err.id,
        timestamp: err.timestamp,
        category: err.category,
        severity: err.severity,
        message: err.message,
        recoverable: err.recoverable
      })),
      initialized: this.initialized
    }
  }

  /**
   * Mark error as resolved
   */
  resolveError (errorId, resolution = '') {
    const error = this.errors.find(err => err.id === errorId)
    if (error) {
      error.resolved = true
      error.resolution = resolution
      error.resolvedAt = Date.now()
      
      devLogger.info(`ErrorTracker: Error ${errorId} marked as resolved`, resolution)
      return true
    }
    return false
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors () {
    const originalCount = this.errors.length
    this.errors = this.errors.filter(err => !err.resolved)
    const clearedCount = originalCount - this.errors.length
    
    devLogger.info(`ErrorTracker: Cleared ${clearedCount} resolved errors`)
    return clearedCount
  }

  /**
   * Get error report for debugging
   */
  generateReport () {
    const report = {
      summary: {
        total: this.errorStats.total,
        critical: this.errorStats.critical,
        recoverable: this.errorStats.recoverable,
        unresolved: this.errors.filter(err => !err.resolved).length
      },
      breakdown: {
        byCategory: this.errorStats.byCategory,
        bySeverity: this.errorStats.bySeverity,
        byManager: this.errorStats.byManager
      },
      recentErrors: this.getRecentErrors(10),
      timestamp: Date.now()
    }
    
    return report
  }

  /**
   * Load error history from storage
   */
  async loadErrorHistory () {
    try {
      if (await this.storageManager.has('errorHistory')) {
        const history = await this.storageManager.get('errorHistory')
        if (history && Array.isArray(history.errors)) {
          this.errors = history.errors.slice(0, this.maxStoredErrors)
          this.errorStats = history.stats || this.errorStats
          
          devLogger.storage(`ErrorTracker: Loaded ${this.errors.length} errors from history`)
        }
      }
    } catch (error) {
      devLogger.warn('ErrorTracker: Failed to load error history', error)
    }
  }

  /**
   * Save error history to storage
   */
  async saveErrorHistory () {
    try {
      const history = {
        errors: this.errors.slice(0, 50), // Store only recent errors
        stats: this.errorStats,
        lastSaved: Date.now()
      }
      
      await this.storageManager.set('errorHistory', history)
    } catch (error) {
      devLogger.warn('ErrorTracker: Failed to save error history', error)
    }
  }

  /**
   * Reset error tracker
   */
  reset () {
    this.errors = []
    this.errorStats = {
      total: 0,
      byCategory: {},
      bySeverity: {},
      byManager: {},
      recoverable: 0,
      critical: 0
    }
    
    devLogger.info('ErrorTracker: Reset all error data')
  }

  /**
   * Destroy error tracker
   */
  destroy () {
    if (this.storageManager) {
      this.saveErrorHistory().catch(() => {})
    }
    
    this.reset()
    this.storageManager = null
    this.initialized = false
    
    devLogger.info('ErrorTracker: Destroyed')
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker()

// Helper function for easy error tracking
export function trackError (error, context = {}) {
  return errorTracker.trackError(error, context)
}

// Helper function for tracking with automatic context
export function trackManagerError (manager, operation, error, additional = {}) {
  return errorTracker.trackError(error, {
    manager,
    operation,
    ...additional
  })
}