import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'
import { activateDegradation } from '@/utils/GracefulDegradation.js'

// Timer warning levels and thresholds
/** @typedef {Object} TimerWarning
 * @property {number} threshold - Time threshold in seconds
 * @property {string} level - Warning severity level
 * @property {string} event - Event name to emit
 */

/**
 * Timer warning configurations with thresholds and event mappings
 * @type {Object.<string, TimerWarning>}
 */
export const TIMER_WARNINGS = {
  MEDIUM: { threshold: 30, level: 'medium', event: 'timer:warning' },
  HIGH: { threshold: 15, level: 'high', event: 'timer:warning' },
  CRITICAL: { threshold: 10, level: 'critical', event: 'timer:critical' },
  URGENT: { threshold: 5, level: 'urgent', event: 'timer:critical' }
}

/**
 * Enhanced Timer Manager with precision timing, visual feedback, and state management
 * 
 * Features:
 * - Frame-based precision timing (60 FPS updates)
 * - Progressive warning system with visual feedback
 * - Browser visibility API integration for auto-pause
 * - GameStateManager integration for round configuration
 * - Comprehensive performance monitoring and error handling
 * - Graceful degradation and resource cleanup
 * 
 * @class TimerManager
 * @example
 * const timerManager = new TimerManager(gameLoopManager, gameStateManager)
 * timerManager.start(90) // Start 90-second timer
 * timerManager.on('timer:warning', (data) => console.log('Warning:', data))
 */
export class TimerManager {
  /**
   * Create a TimerManager instance
   * @param {GameLoopManager} [gameLoopManager=null] - Game loop manager for frame-based updates
   * @param {GameStateManager} [gameStateManager=null] - Game state manager for round configuration
   */
  constructor (gameLoopManager = null, gameStateManager = null) {
    this.gameLoopManager = gameLoopManager
    this.gameStateManager = gameStateManager
    
    // Timer state
    this.duration = 90 // Default 90 seconds
    this.timeRemaining = 90 // Initialize to default duration
    this.isRunning = false
    this.isPaused = false
    this.startTime = 0
    this.pauseTime = 0
    this.totalPausedTime = 0
    
    // Delta time accumulation for sub-second precision
    this.deltaAccumulator = 0
    this.lastUpdateTime = 0
    
    // Warning state tracking
    this.warningsTriggered = new Set()
    this.lastWarningCheck = 0
    
    // Performance monitoring
    this.updateCount = 0
    this.totalUpdateTime = 0
    
    this.initialized = false
    this.init()
  }
  
  init () {
    try {
      // Get default duration from GameStateManager if available
      if (this.gameStateManager?.roundConfig?.timeLimit) {
        this.duration = this.gameStateManager.roundConfig.timeLimit
        this.timeRemaining = this.duration // Update timeRemaining when duration changes
        devLogger.timer(`Duration set from roundConfig: ${this.duration}`)
      } else {
        devLogger.timer(`Using default duration: ${this.duration}`)
      }
      
      // Register with GameLoopManager for frame-based updates
      if (this.gameLoopManager && typeof this.gameLoopManager.addUpdateCallback === 'function') {
        this.gameLoopManager.addUpdateCallback(this.update.bind(this), 'timer')
        devLogger.timer('TimerManager registered with GameLoopManager')
      }
      
      // Setup browser visibility API for auto-pause
      this.setupVisibilityHandling()
      
      this.initialized = true
      devLogger.timer('TimerManager initialized', {
        defaultDuration: this.duration,
        timeRemaining: this.timeRemaining,
        hasGameLoop: !!this.gameLoopManager,
        hasGameState: !!this.gameStateManager
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'init', error)
      // Graceful fallback for initialization failure
      this.duration = 90
      this.timeRemaining = 90
      this.initialized = true
      devLogger.warn('TimerManager initialized with fallback values due to error', error)
    }
  }
  
  /**
   * Start the timer with specified duration
   * @param {number} [duration=null] - Timer duration in seconds (uses GameStateManager config if null)
   * @fires timer:start - When timer starts
   * @example
   * timerManager.start(90) // Start 90-second timer
   * timerManager.start() // Use duration from GameStateManager
   */
  start (duration = null) {
    try {
      // Validate and set duration
      if (duration && duration > 0 && duration <= 300) { // Max 5 minutes
        this.duration = duration
      } else if (this.gameStateManager?.roundConfig?.timeLimit) {
        this.duration = this.gameStateManager.roundConfig.timeLimit
      }
      
      // Initialize timer state
      this.timeRemaining = this.duration
      this.isRunning = true
      this.isPaused = false
      this.startTime = performance.now()
      this.pauseTime = 0
      this.totalPausedTime = 0
      this.deltaAccumulator = 0
      this.lastUpdateTime = this.startTime
      
      // Reset warning tracking
      this.warningsTriggered.clear()
      this.lastWarningCheck = this.duration
      
      devLogger.timer('Timer started', {
        duration: this.duration,
        startTime: this.startTime
      })
      
      // Emit start event
      this.emitEvent('timer:start', {
        duration: this.duration,
        timeRemaining: this.timeRemaining
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'start', error)
      devLogger.error('TimerManager start failed', error)
    }
  }
  
  /**
   * Pause the timer (preserves remaining time)
   * @fires timer:pause - When timer is paused
   */
  pause () {
    if (!this.isRunning || this.isPaused) return
    
    try {
      this.isPaused = true
      this.isRunning = false
      this.pauseTime = performance.now()
      
      devLogger.timer('Timer paused', {
        timeRemaining: this.timeRemaining,
        pauseTime: this.pauseTime
      })
      
      this.emitEvent('timer:pause', {
        timeRemaining: this.timeRemaining
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'pause', error)
    }
  }
  
  /**
   * Resume the timer
   */
  resume () {
    if (this.isRunning || !this.isPaused) return
    
    try {
      if (this.pauseTime > 0) {
        this.totalPausedTime += performance.now() - this.pauseTime
      }
      
      this.isPaused = false
      this.isRunning = true
      this.pauseTime = 0
      this.lastUpdateTime = performance.now()
      
      devLogger.timer('Timer resumed', {
        timeRemaining: this.timeRemaining,
        totalPausedTime: this.totalPausedTime
      })
      
      this.emitEvent('timer:resume', {
        timeRemaining: this.timeRemaining
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'resume', error)
    }
  }
  
  /**
   * Stop the timer
   */
  stop () {
    try {
      this.isRunning = false
      this.isPaused = false
      this.timeRemaining = 0
      
      devLogger.timer('Timer stopped')
      
      this.emitEvent('timer:stop', {
        timeRemaining: 0
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'stop', error)
    }
  }
  
  /**
   * Reset the timer to initial state
   */
  reset () {
    try {
      this.isRunning = false
      this.isPaused = false
      this.timeRemaining = this.duration
      this.startTime = 0
      this.pauseTime = 0
      this.totalPausedTime = 0
      this.deltaAccumulator = 0
      this.warningsTriggered.clear()
      this.lastWarningCheck = this.duration
      
      devLogger.timer('Timer reset', { duration: this.duration })
      
      this.emitEvent('timer:reset', {
        duration: this.duration,
        timeRemaining: this.timeRemaining
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'reset', error)
    }
  }
  
  /**
   * Update timer - called every frame by GameLoopManager
   * @param {number} deltaTime - Time elapsed since last update (milliseconds)
   */
  update (deltaTime = 16.67) {
    if (!this.isRunning || this.isPaused) return
    
    // Respect GameLoopManager pause state
    if (this.gameLoopManager?.isPaused) return
    
    const updateStartTime = performance.now()
    
    try {
      // Accumulate delta time for sub-second precision
      this.deltaAccumulator += deltaTime
      
      // Update time remaining when we have a full second accumulated
      while (this.deltaAccumulator >= 1000) {
        this.timeRemaining = Math.max(0, this.timeRemaining - 1)
        this.deltaAccumulator -= 1000
        
        // Check for warnings and expiration
        this.checkWarnings()
        
        if (this.timeRemaining <= 0) {
          this.handleExpiration()
          break
        }
      }
      
      // Performance monitoring
      this.updateCount++
      const updateTime = performance.now() - updateStartTime
      this.totalUpdateTime += updateTime
      
      // Log performance warning if update takes too long
      if (updateTime > 1.0) { // 1ms threshold
        devLogger.warn('TimerManager update exceeded 1ms', {
          updateTime: updateTime.toFixed(3),
          avgUpdateTime: (this.totalUpdateTime / this.updateCount).toFixed(3)
        })
      }
      
    } catch (error) {
      trackManagerError('TimerManager', 'update', error)
      devLogger.error('TimerManager update failed', error)
    }
  }
  
  /**
   * Check for warning thresholds and emit events
   */
  checkWarnings () {
    try {
      // Check each warning threshold
      Object.values(TIMER_WARNINGS).forEach(warning => {
        if (this.timeRemaining <= warning.threshold && 
            !this.warningsTriggered.has(warning.threshold)) {
          
          this.warningsTriggered.add(warning.threshold)
          
          devLogger.timer(`Timer warning: ${warning.level}`, {
            timeRemaining: this.timeRemaining,
            threshold: warning.threshold
          })
          
          this.emitEvent(warning.event, {
            timeRemaining: this.timeRemaining,
            warningLevel: warning.level,
            threshold: warning.threshold
          })
        }
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'checkWarnings', error)
    }
  }
  
  /**
   * Handle timer expiration
   */
  handleExpiration () {
    try {
      this.isRunning = false
      this.timeRemaining = 0
      
      devLogger.timer('Timer expired')
      
      this.emitEvent('timer:expired', {
        timeRemaining: 0,
        duration: this.duration
      })
      
    } catch (error) {
      trackManagerError('TimerManager', 'handleExpiration', error)
    }
  }
  
  /**
   * Emit events through GameStateManager
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  emitEvent (event, data) {
    try {
      if (this.gameStateManager?.emit) {
        this.gameStateManager.emit(event, data)
      } else {
        // Fallback to window events if GameStateManager unavailable
        window.dispatchEvent(new CustomEvent(event, { detail: data }))
      }
    } catch (error) {
      trackManagerError('TimerManager', 'emitEvent', error)
    }
  }
  
  /**
   * Get current timer progress as percentage
   * @returns {number} Progress percentage (0-100, where 100 = full time remaining)
   * @example
   * const progress = timerManager.getProgress() // Returns 75 if 75% time remaining
   */
  getProgress () {
    if (this.duration === 0) return 0
    return Math.max(0, Math.min(100, (this.timeRemaining / this.duration) * 100))
  }
  
  /**
   * Get formatted time string in MM:SS format
   * @returns {string} Formatted time string (e.g., "01:30", "00:45")
   * @example
   * const timeDisplay = timerManager.getFormattedTime() // "01:23"
   */
  getFormattedTime () {
    const totalSeconds = Math.ceil(this.timeRemaining)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  /**
   * Get timer statistics for debugging/monitoring
   * @returns {object} Timer statistics
   */
  getStats () {
    return {
      duration: this.duration,
      timeRemaining: this.timeRemaining,
      progress: this.getProgress(),
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      warningsTriggered: Array.from(this.warningsTriggered),
      averageUpdateTime: this.updateCount > 0 ? this.totalUpdateTime / this.updateCount : 0,
      updateCount: this.updateCount
    }
  }
  
  /**
   * Configure timer settings
   * @param {object} config - Configuration options
   */
  configure (config = {}) {
    try {
      if (config.defaultDuration && config.defaultDuration > 0) {
        this.duration = config.defaultDuration
      }
      
      // Update GameStateManager round config if available
      if (this.gameStateManager?.roundConfig && config.defaultDuration) {
        this.gameStateManager.roundConfig.timeLimit = config.defaultDuration
      }
      
      devLogger.timer('TimerManager configured', config)
      
    } catch (error) {
      trackManagerError('TimerManager', 'configure', error)
    }
  }
  
  /**
   * Setup browser visibility handling for auto-pause
   */
  setupVisibilityHandling () {
    try {
      this.wasRunningBeforeHide = false
      
      // Handle visibility change
      this.visibilityChangeHandler = () => {
        if (document.hidden) {
          // Tab became hidden - pause if running
          if (this.isRunning && !this.isPaused) {
            this.wasRunningBeforeHide = true
            this.pause()
            devLogger.timer('Timer auto-paused (tab hidden)')
          }
        } else {
          // Tab became visible - resume if was running
          if (this.wasRunningBeforeHide && this.isPaused) {
            this.resume()
            this.wasRunningBeforeHide = false
            devLogger.timer('Timer auto-resumed (tab visible)')
          }
        }
      }
      
      document.addEventListener('visibilitychange', this.visibilityChangeHandler)
      
    } catch (error) {
      trackManagerError('TimerManager', 'setupVisibilityHandling', error)
    }
  }

  /**
   * Clean up resources
   */
  destroy () {
    try {
      // Remove from GameLoopManager
      if (this.gameLoopManager) {
        this.gameLoopManager.removeUpdateCallback('timer')
      }
      
      // Remove visibility change listener
      if (this.visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
        this.visibilityChangeHandler = null
      }
      
      // Stop timer
      this.stop()
      
      // Clear state
      this.warningsTriggered.clear()
      this.initialized = false
      
      devLogger.timer('TimerManager destroyed')
      
    } catch (error) {
      trackManagerError('TimerManager', 'destroy', error)
    }
  }
}