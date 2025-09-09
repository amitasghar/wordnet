import { devLogger } from '@/utils/devTools.js'

// Event categories for organization
export const EVENT_CATEGORIES = {
  GAME: 'game',
  UI: 'ui',
  SYSTEM: 'system',
  USER: 'user',
  NETWORK: 'network'
}

// Common event types
export const EVENTS = {
  // Game events
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  GAME_OVER: 'game:over',
  GAME_RESET: 'game:reset',
  SCORE_UPDATE: 'game:score:update',
  WORD_ENTERED: 'game:word:entered',
  WORD_VALIDATED: 'game:word:validated',
  CATEGORY_CHANGED: 'game:category:changed',
  TIMER_UPDATE: 'game:timer:update',
  
  // UI events
  UI_READY: 'ui:ready',
  OVERLAY_SHOW: 'ui:overlay:show',
  OVERLAY_HIDE: 'ui:overlay:hide',
  NOTIFICATION_SHOW: 'ui:notification:show',
  MODAL_SHOW: 'ui:modal:show',
  MODAL_HIDE: 'ui:modal:hide',
  CANVAS_RESIZE: 'ui:canvas:resize',
  
  // System events
  STORAGE_SAVE: 'system:storage:save',
  STORAGE_LOAD: 'system:storage:load',
  ASSET_LOADED: 'system:asset:loaded',
  ASSET_ERROR: 'system:asset:error',
  PERFORMANCE_WARNING: 'system:performance:warning',
  ERROR: 'system:error',
  
  // User events
  INPUT_START: 'user:input:start',
  INPUT_CHANGE: 'user:input:change',
  INPUT_SUBMIT: 'user:input:submit',
  BUTTON_CLICK: 'user:button:click',
  SETTINGS_CHANGE: 'user:settings:change'
}

export class EventBridge {
  constructor () {
    this.listeners = new Map()
    this.eventHistory = []
    this.maxHistorySize = 100
    this.debugMode = __DEV__
    
    // Event metrics for debugging
    this.metrics = {
      totalEvents: 0,
      eventsPerCategory: {},
      errorCount: 0
    }
    
    this.init()
  }
  
  init () {
    // Setup global error handling
    if (this.debugMode) {
      this.setupErrorHandling()
    }
    
    devLogger.game('EventBridge: Initialized')
  }
  
  setupErrorHandling () {
    // Catch and log event handler errors
    const originalEmit = this.emit.bind(this)
    
    this.emit = (event, data) => {
      try {
        return originalEmit(event, data)
      } catch (error) {
        this.handleEventError(event, error, data)
        return false
      }
    }
  }
  
  handleEventError (event, error, data) {
    this.metrics.errorCount++
    
    console.error(`EventBridge: Error handling event "${event}":`, error)
    devLogger.game(`EventBridge: Event error for "${event}"`, { error: error.message, data })
    
    // Emit error event (carefully to avoid recursion)
    if (event !== EVENTS.ERROR) {
      setTimeout(() => {
        this.emit(EVENTS.ERROR, {
          originalEvent: event,
          error: error.message,
          data,
          timestamp: Date.now()
        })
      }, 0)
    }
  }
  
  // Core event methods
  on (event, callback, options = {}) {
    if (typeof callback !== 'function') {
      console.error('EventBridge: Callback must be a function')
      return false
    }
    
    const {
      once = false,
      priority = 0,
      context = null
    } = options
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    
    const listenerData = {
      callback,
      once,
      priority,
      context,
      id: this.generateListenerId(),
      timestamp: Date.now()
    }
    
    const eventListeners = this.listeners.get(event)
    eventListeners.push(listenerData)
    
    // Sort by priority (higher priority first)
    eventListeners.sort((a, b) => b.priority - a.priority)
    
    if (this.debugMode) {
      devLogger.game(`EventBridge: Registered listener for "${event}" (ID: ${listenerData.id})`)
    }
    
    return listenerData.id
  }
  
  once (event, callback, options = {}) {
    return this.on(event, callback, { ...options, once: true })
  }
  
  off (event, callbackOrId) {
    if (!this.listeners.has(event)) {
      return false
    }
    
    const eventListeners = this.listeners.get(event)
    let removed = false
    
    if (typeof callbackOrId === 'string') {
      // Remove by ID
      const index = eventListeners.findIndex(listener => listener.id === callbackOrId)
      if (index > -1) {
        eventListeners.splice(index, 1)
        removed = true
      }
    } else {
      // Remove by callback function
      const index = eventListeners.findIndex(listener => listener.callback === callbackOrId)
      if (index > -1) {
        eventListeners.splice(index, 1)
        removed = true
      }
    }
    
    // Clean up empty event arrays
    if (eventListeners.length === 0) {
      this.listeners.delete(event)
    }
    
    if (this.debugMode && removed) {
      devLogger.game(`EventBridge: Removed listener for "${event}"`)
    }
    
    return removed
  }
  
  emit (event, data = null) {
    this.metrics.totalEvents++
    
    // Update category metrics
    const category = this.getEventCategory(event)
    if (!this.metrics.eventsPerCategory[category]) {
      this.metrics.eventsPerCategory[category] = 0
    }
    this.metrics.eventsPerCategory[category]++
    
    // Add to history
    this.addToHistory(event, data)
    
    if (!this.listeners.has(event)) {
      if (this.debugMode) {
        devLogger.game(`EventBridge: No listeners for event "${event}"`)
      }
      return false
    }
    
    const eventListeners = this.listeners.get(event)
    const listenersToRemove = []
    let handled = false
    
    // Call all listeners
    for (const listener of eventListeners) {
      try {
        // Apply context if provided
        if (listener.context) {
          listener.callback.call(listener.context, data)
        } else {
          listener.callback(data)
        }
        
        handled = true
        
        // Mark once-only listeners for removal
        if (listener.once) {
          listenersToRemove.push(listener)
        }
        
      } catch (error) {
        this.handleEventError(event, error, data)
      }
    }
    
    // Remove once-only listeners
    if (listenersToRemove.length > 0) {
      listenersToRemove.forEach(listener => {
        this.off(event, listener.id)
      })
    }
    
    if (this.debugMode) {
      devLogger.game(`EventBridge: Emitted "${event}" to ${eventListeners.length} listeners`, data)
    }
    
    return handled
  }
  
  // Utility methods
  generateListenerId () {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  getEventCategory (event) {
    const parts = event.split(':')
    return parts[0] || EVENT_CATEGORIES.SYSTEM
  }
  
  addToHistory (event, data) {
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now()
    })
    
    // Maintain history size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }
  
  // Advanced event methods
  emitAsync (event, data = null) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this.emit(event, data)
        resolve(result)
      }, 0)
    })
  }
  
  emitDelayed (event, data = null, delay = 0) {
    return setTimeout(() => {
      this.emit(event, data)
    }, delay)
  }
  
  emitRepeated (event, data = null, interval = 1000, maxRepeats = null) {
    let count = 0
    
    const intervalId = setInterval(() => {
      this.emit(event, data)
      count++
      
      if (maxRepeats && count >= maxRepeats) {
        clearInterval(intervalId)
      }
    }, interval)
    
    return intervalId
  }
  
  // Event filtering and middleware
  addMiddleware (event, middlewareFn) {
    const originalEmit = this.emit.bind(this)
    
    this.emit = (emittedEvent, data) => {
      if (emittedEvent === event) {
        try {
          const processedData = middlewareFn(data)
          return originalEmit(emittedEvent, processedData)
        } catch (error) {
          this.handleEventError(emittedEvent, error, data)
          return false
        }
      }
      
      return originalEmit(emittedEvent, data)
    }
  }
  
  // Event waiting/promises
  waitFor (event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      let timeoutId = null
      
      const listenerId = this.once(event, (data) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        resolve(data)
      })
      
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(event, listenerId)
          reject(new Error(`EventBridge: Timeout waiting for event "${event}"`))
        }, timeout)
      }
    })
  }
  
  // Batch operations
  emitBatch (events) {
    const results = []
    
    events.forEach(({ event, data }) => {
      const result = this.emit(event, data)
      results.push({ event, success: result })
    })
    
    return results
  }
  
  onBatch (eventCallbackPairs) {
    const listenerIds = []
    
    eventCallbackPairs.forEach(({ event, callback, options }) => {
      const id = this.on(event, callback, options)
      listenerIds.push({ event, id })
    })
    
    return listenerIds
  }
  
  offBatch (listenerIds) {
    let removedCount = 0
    
    listenerIds.forEach(({ event, id }) => {
      if (this.off(event, id)) {
        removedCount++
      }
    })
    
    return removedCount
  }
  
  // Query and inspection methods
  hasListeners (event) {
    return this.listeners.has(event) && this.listeners.get(event).length > 0
  }
  
  getListenerCount (event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0
  }
  
  getAllEvents () {
    return Array.from(this.listeners.keys())
  }
  
  getEventHistory (limit = null) {
    const history = [...this.eventHistory]
    return limit ? history.slice(-limit) : history
  }
  
  getMetrics () {
    return {
      ...this.metrics,
      totalListeners: Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
      uniqueEvents: this.listeners.size,
      historySize: this.eventHistory.length
    }
  }
  
  // Cleanup and maintenance
  removeAllListeners (event = null) {
    if (event) {
      this.listeners.delete(event)
      devLogger.game(`EventBridge: Removed all listeners for "${event}"`)
    } else {
      const eventCount = this.listeners.size
      this.listeners.clear()
      devLogger.game(`EventBridge: Removed all listeners for ${eventCount} events`)
    }
  }
  
  clearHistory () {
    this.eventHistory = []
    devLogger.game('EventBridge: Cleared event history')
  }
  
  resetMetrics () {
    this.metrics = {
      totalEvents: 0,
      eventsPerCategory: {},
      errorCount: 0
    }
    devLogger.game('EventBridge: Reset metrics')
  }
  
  // Debug and development helpers
  enableDebug () {
    this.debugMode = true
    devLogger.game('EventBridge: Debug mode enabled')
  }
  
  disableDebug () {
    this.debugMode = false
    devLogger.game('EventBridge: Debug mode disabled')
  }
  
  logListeners (event = null) {
    if (event) {
      const listeners = this.listeners.get(event) || []
      console.log(`EventBridge: Listeners for "${event}":`, listeners)
    } else {
      console.log('EventBridge: All listeners:', Object.fromEntries(this.listeners))
    }
  }
  
  // Cleanup
  destroy () {
    this.removeAllListeners()
    this.clearHistory()
    this.resetMetrics()
    
    devLogger.game('EventBridge: Destroyed')
  }
  
  // Debug information
  getDebugInfo () {
    return {
      ...this.getMetrics(),
      debugMode: this.debugMode,
      recentEvents: this.getEventHistory(10).map(entry => entry.event)
    }
  }
}