// Configuration management for production deployment
import { devLogger } from '@/utils/devTools.js'

export class ConfigurationManager {
  constructor() {
    this.config = new Map()
    this.environment = this.detectEnvironment()
    this.defaults = this.loadDefaults()
    this.overrides = new Map()
    this.watchers = new Map()
    
    // Performance and monitoring settings
    this.performanceConfig = {
      enableMonitoring: true,
      sampleRate: 1.0,
      metricsRetention: 3600000, // 1 hour
      alertThresholds: {
        memoryUsage: 80,
        responseTime: 200,
        errorRate: 5,
        frameRate: 30
      }
    }
    
    this.initialize()
  }

  /**
   * Initialize configuration manager
   */
  initialize() {
    try {
      this.loadEnvironmentConfig()
      this.loadUserPreferences()
      this.setupConfigWatchers()
      
      devLogger.info(`ConfigurationManager: Initialized for ${this.environment} environment`)
    } catch (error) {
      devLogger.error('ConfigurationManager: Failed to initialize', error)
    }
  }

  /**
   * Detect current environment
   */
  detectEnvironment() {
    // Check various environment indicators
    if (typeof __DEV__ !== 'undefined' && __DEV__) return 'development'
    if (import.meta.env?.DEV) return 'development'
    if (import.meta.env?.PROD) return 'production'
    if (location.hostname === 'localhost') return 'development'
    if (location.protocol === 'file:') return 'development'
    if (location.hostname.includes('staging')) return 'staging'
    if (location.hostname.includes('test')) return 'testing'
    
    return 'production'
  }

  /**
   * Load default configuration
   */
  loadDefaults() {
    return {
      // Application settings
      app: {
        name: 'WordNet Category Challenge',
        version: '1.0.0',
        debugMode: false,
        performanceMode: false,
        autoSave: true,
        autoSaveInterval: 30000
      },
      
      // Game settings
      game: {
        difficulty: 3,
        roundDuration: 90000, // 90 seconds
        maxRounds: 10,
        enableHints: true,
        enableTimer: true,
        enableSound: true
      },
      
      // Performance settings
      performance: {
        enableMonitoring: this.environment !== 'production',
        enableAnalytics: true,
        cacheSize: 1000,
        cacheTTL: 300000, // 5 minutes
        enablePrefetch: true,
        batchSize: 10
      },
      
      // UI settings
      ui: {
        theme: 'default',
        animations: true,
        reducedMotion: false,
        fontSize: 'medium',
        colorScheme: 'auto'
      },
      
      // Storage settings
      storage: {
        useIndexedDB: true,
        fallbackToLocalStorage: true,
        compressionEnabled: false,
        maxStorageSize: 50 * 1024 * 1024 // 50MB
      },
      
      // Network settings
      network: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableOfflineMode: true
      },
      
      // Logging settings
      logging: {
        level: this.environment === 'development' ? 'debug' : 'warn',
        enableConsole: this.environment === 'development',
        enableRemote: this.environment === 'production',
        maxLogSize: 1000
      }
    }
  }

  /**
   * Load environment-specific configuration
   */
  loadEnvironmentConfig() {
    const envConfigs = {
      development: {
        app: { debugMode: true },
        performance: { enableMonitoring: true, cacheSize: 500 },
        logging: { level: 'debug', enableConsole: true }
      },
      
      staging: {
        app: { debugMode: true },
        performance: { enableMonitoring: true, enableAnalytics: true },
        logging: { level: 'info', enableConsole: true, enableRemote: true }
      },
      
      testing: {
        app: { debugMode: true, autoSave: false },
        performance: { enableMonitoring: false, enableAnalytics: false },
        logging: { level: 'error', enableConsole: false }
      },
      
      production: {
        app: { debugMode: false, performanceMode: true },
        performance: { 
          enableMonitoring: true, 
          enableAnalytics: true, 
          cacheSize: 2000,
          cacheTTL: 600000 // 10 minutes
        },
        logging: { level: 'error', enableConsole: false, enableRemote: true }
      }
    }
    
    const envConfig = envConfigs[this.environment] || {}
    this.mergeConfig(this.defaults, envConfig)
  }

  /**
   * Load user preferences from storage
   */
  loadUserPreferences() {
    try {
      const stored = localStorage.getItem('user_preferences')
      if (stored) {
        const preferences = JSON.parse(stored)
        this.mergeConfig(this.defaults, { user: preferences })
        devLogger.info('ConfigurationManager: Loaded user preferences')
      }
    } catch (error) {
      devLogger.warn('ConfigurationManager: Failed to load user preferences', error)
    }
  }

  /**
   * Merge configuration objects
   */
  mergeConfig(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (target[key] && typeof target[key] === 'object' && typeof value === 'object') {
        this.mergeConfig(target[key], value)
      } else {
        target[key] = value
      }
    }
  }

  /**
   * Get configuration value
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.')
    let value = this.defaults
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return this.getOverride(path) ?? defaultValue
      }
    }
    
    return this.getOverride(path) ?? value
  }

  /**
   * Set configuration value
   */
  set(path, value, persist = false) {
    if (persist) {
      this.setOverride(path, value)
      this.saveUserPreferences()
    } else {
      this.setOverride(path, value)
    }
    
    // Notify watchers
    this.notifyWatchers(path, value)
  }

  /**
   * Get override value
   */
  getOverride(path) {
    return this.overrides.get(path)
  }

  /**
   * Set override value
   */
  setOverride(path, value) {
    this.overrides.set(path, value)
  }

  /**
   * Watch configuration changes
   */
  watch(path, callback) {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set())
    }
    
    this.watchers.get(path).add(callback)
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(path)
      if (watchers) {
        watchers.delete(callback)
        if (watchers.size === 0) {
          this.watchers.delete(path)
        }
      }
    }
  }

  /**
   * Notify watchers of configuration changes
   */
  notifyWatchers(path, value) {
    // Notify exact path watchers
    const exactWatchers = this.watchers.get(path)
    if (exactWatchers) {
      exactWatchers.forEach(callback => {
        try {
          callback(value, path)
        } catch (error) {
          devLogger.warn(`Config watcher error for ${path}:`, error)
        }
      })
    }
    
    // Notify parent path watchers
    const pathParts = path.split('.')
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.')
      const parentWatchers = this.watchers.get(parentPath)
      
      if (parentWatchers) {
        const parentValue = this.get(parentPath)
        parentWatchers.forEach(callback => {
          try {
            callback(parentValue, parentPath)
          } catch (error) {
            devLogger.warn(`Config watcher error for ${parentPath}:`, error)
          }
        })
      }
    }
  }

  /**
   * Setup configuration watchers for critical settings
   */
  setupConfigWatchers() {
    // Performance mode watcher
    this.watch('app.performanceMode', (enabled) => {
      if (enabled) {
        this.activatePerformanceMode()
      } else {
        this.deactivatePerformanceMode()
      }
    })
    
    // Theme watcher
    this.watch('ui.theme', (theme) => {
      this.applyTheme(theme)
    })
    
    // Logging level watcher
    this.watch('logging.level', (level) => {
      this.updateLoggingLevel(level)
    })
    
    // Memory usage watcher
    this.watch('performance.cacheSize', (size) => {
      this.updateCacheSettings(size)
    })
  }

  /**
   * Activate performance mode
   */
  activatePerformanceMode() {
    const performanceSettings = {
      'ui.animations': false,
      'ui.reducedMotion': true,
      'performance.cacheSize': Math.min(this.get('performance.cacheSize'), 500),
      'performance.enablePrefetch': false,
      'game.enableHints': false
    }
    
    Object.entries(performanceSettings).forEach(([path, value]) => {
      this.setOverride(path, value)
    })
    
    devLogger.info('ConfigurationManager: Performance mode activated')
  }

  /**
   * Deactivate performance mode
   */
  deactivatePerformanceMode() {
    const performanceOverrides = [
      'ui.animations',
      'ui.reducedMotion', 
      'performance.cacheSize',
      'performance.enablePrefetch',
      'game.enableHints'
    ]
    
    performanceOverrides.forEach(path => {
      this.overrides.delete(path)
    })
    
    devLogger.info('ConfigurationManager: Performance mode deactivated')
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    devLogger.info(`ConfigurationManager: Applied theme: ${theme}`)
  }

  /**
   * Update logging level
   */
  updateLoggingLevel(level) {
    // This would integrate with the logging system
    devLogger.info(`ConfigurationManager: Updated logging level to: ${level}`)
  }

  /**
   * Update cache settings
   */
  updateCacheSettings(size) {
    // This would notify cache systems of the new size limit
    devLogger.info(`ConfigurationManager: Updated cache size to: ${size}`)
  }

  /**
   * Save user preferences
   */
  saveUserPreferences() {
    try {
      const userPreferences = {}
      
      // Extract user-specific overrides
      const userPaths = [
        'ui.theme',
        'ui.animations',
        'ui.fontSize',
        'ui.colorScheme',
        'game.enableSound',
        'game.difficulty'
      ]
      
      userPaths.forEach(path => {
        const value = this.getOverride(path)
        if (value !== undefined) {
          this.setNestedValue(userPreferences, path, value)
        }
      })
      
      localStorage.setItem('user_preferences', JSON.stringify(userPreferences))
      devLogger.info('ConfigurationManager: Saved user preferences')
      
    } catch (error) {
      devLogger.warn('ConfigurationManager: Failed to save user preferences', error)
    }
  }

  /**
   * Set nested value in object
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.')
    let current = obj
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }
    
    current[keys[keys.length - 1]] = value
  }

  /**
   * Get all configuration
   */
  getAll() {
    const merged = JSON.parse(JSON.stringify(this.defaults))
    
    // Apply overrides
    for (const [path, value] of this.overrides) {
      this.setNestedValue(merged, path, value)
    }
    
    return merged
  }

  /**
   * Get environment info
   */
  getEnvironmentInfo() {
    return {
      environment: this.environment,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      url: window.location.href,
      timestamp: Date.now()
    }
  }

  /**
   * Export configuration for debugging
   */
  export() {
    return {
      environment: this.environment,
      config: this.getAll(),
      overrides: Array.from(this.overrides.entries()),
      watchers: Array.from(this.watchers.keys()),
      environmentInfo: this.getEnvironmentInfo()
    }
  }

  /**
   * Import configuration
   */
  import(configData) {
    try {
      if (configData.overrides) {
        this.overrides.clear()
        configData.overrides.forEach(([path, value]) => {
          this.overrides.set(path, value)
        })
      }
      
      devLogger.info('ConfigurationManager: Imported configuration')
    } catch (error) {
      devLogger.error('ConfigurationManager: Failed to import configuration', error)
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.overrides.clear()
    localStorage.removeItem('user_preferences')
    devLogger.info('ConfigurationManager: Reset to defaults')
  }

  /**
   * Validate configuration
   */
  validate() {
    const issues = []
    const config = this.getAll()
    
    // Validate performance settings
    if (config.performance.cacheSize < 100) {
      issues.push('Cache size is too small (< 100)')
    }
    
    if (config.performance.cacheTTL < 60000) {
      issues.push('Cache TTL is too short (< 1 minute)')
    }
    
    // Validate game settings
    if (config.game.roundDuration < 30000) {
      issues.push('Round duration is too short (< 30 seconds)')
    }
    
    // Validate storage settings
    if (config.storage.maxStorageSize < 1024 * 1024) {
      issues.push('Max storage size is too small (< 1MB)')
    }
    
    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// Global configuration manager instance
export const configManager = new ConfigurationManager()

// Export convenience functions
export const getConfig = (path, defaultValue) => configManager.get(path, defaultValue)
export const setConfig = (path, value, persist = false) => configManager.set(path, value, persist)
export const watchConfig = (path, callback) => configManager.watch(path, callback)