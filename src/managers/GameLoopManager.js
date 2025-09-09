import { devLogger } from '@/utils/devTools.js'

export class GameLoopManager {
  constructor (game) {
    this.game = game
    this.isActive = false
    this.isPaused = false
    
    // Performance monitoring
    this.fps = 0
    this.deltaTime = 0
    this.averageFPS = 0
    this.frameCount = 0
    this.fpsHistory = []
    
    // Game timing
    this.gameTime = 0
    this.pausedTime = 0
    this.startTime = 0
    
    // Update callbacks
    this.updateCallbacks = new Map()
    this.fixedUpdateCallbacks = new Map()
    
    // Fixed update timing (for game logic that needs consistent timing)
    this.fixedUpdateInterval = 1000 / 60 // 60 FPS fixed updates
    this.fixedUpdateTimer = 0
    this.fixedUpdateAccumulator = 0
    
    // Performance thresholds
    this.lowFPSThreshold = 30
    this.performanceWarningThreshold = 45
    
    this.init()
  }
  
  init () {
    // Hook into Phaser's game loop
    if (this.game && this.game.events) {
      this.game.events.on('step', this.onStep, this)
      this.game.events.on('prestep', this.onPreStep, this)
      this.game.events.on('poststep', this.onPostStep, this)
    }
    
    this.startTime = Date.now()
    this.isActive = true
    
    devLogger.game('GameLoopManager: Initialized and started')
  }
  
  // Main update callback (called every frame)
  onStep (time, delta) {
    if (!this.isActive || this.isPaused) return
    
    this.updatePerformanceMetrics(delta)
    this.updateGameTime(delta)
    
    // Fixed update logic
    this.handleFixedUpdates(delta)
    
    // Call registered update callbacks
    this.callUpdateCallbacks(delta)
    
    // Performance monitoring
    this.monitorPerformance()
  }
  
  onPreStep (time, delta) {
    // Called before main step - useful for input processing
    this.deltaTime = delta
  }
  
  onPostStep (time, delta) {
    // Called after main step - useful for cleanup
    this.frameCount++
  }
  
  updatePerformanceMetrics (delta) {
    // Calculate FPS
    this.fps = this.game.loop.actualFps
    
    // Track FPS history for averaging
    this.fpsHistory.push(this.fps)
    if (this.fpsHistory.length > 60) { // Keep last 60 frames
      this.fpsHistory.shift()
    }
    
    // Calculate average FPS
    if (this.fpsHistory.length > 0) {
      this.averageFPS = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length
    }
  }
  
  updateGameTime (delta) {
    if (!this.isPaused) {
      this.gameTime += delta
    }
  }
  
  handleFixedUpdates (delta) {
    this.fixedUpdateAccumulator += delta
    
    while (this.fixedUpdateAccumulator >= this.fixedUpdateInterval) {
      // Call fixed update callbacks
      this.callFixedUpdateCallbacks(this.fixedUpdateInterval)
      
      this.fixedUpdateAccumulator -= this.fixedUpdateInterval
      this.fixedUpdateTimer += this.fixedUpdateInterval
    }
  }
  
  callUpdateCallbacks (delta) {
    this.updateCallbacks.forEach((callback, id) => {
      try {
        callback(delta, this.gameTime)
      } catch (error) {
        console.error(`GameLoopManager: Error in update callback "${id}":`, error)
      }
    })
  }
  
  callFixedUpdateCallbacks (fixedDelta) {
    this.fixedUpdateCallbacks.forEach((callback, id) => {
      try {
        callback(fixedDelta, this.fixedUpdateTimer)
      } catch (error) {
        console.error(`GameLoopManager: Error in fixed update callback "${id}":`, error)
      }
    })
  }
  
  monitorPerformance () {
    // Check for performance issues
    if (this.fps < this.lowFPSThreshold && this.frameCount % 60 === 0) {
      devLogger.game(`GameLoopManager: Low FPS detected - Current: ${this.fps.toFixed(1)}, Average: ${this.averageFPS.toFixed(1)}`)
      
      // Emit performance warning
      this.game.events.emit('performance:lowfps', {
        currentFPS: this.fps,
        averageFPS: this.averageFPS,
        frameCount: this.frameCount
      })
    }
    
    // Memory monitoring (if available)
    if (performance.memory && this.frameCount % 300 === 0) { // Check every 5 seconds at 60fps
      const memory = performance.memory
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576)
      
      devLogger.game(`GameLoopManager: Memory usage - ${usedMB}MB used`)
      
      if (usedMB > 100) { // Warning at 100MB
        this.game.events.emit('performance:highmemory', {
          usedMB,
          totalMB: Math.round(memory.totalJSHeapSize / 1048576)
        })
      }
    }
  }
  
  // Register update callback (called every frame)
  registerUpdate (id, callback) {
    this.updateCallbacks.set(id, callback)
    devLogger.game(`GameLoopManager: Registered update callback "${id}"`)
  }
  
  // Unregister update callback
  unregisterUpdate (id) {
    const removed = this.updateCallbacks.delete(id)
    if (removed) {
      devLogger.game(`GameLoopManager: Unregistered update callback "${id}"`)
    }
    return removed
  }
  
  // Register fixed update callback (called at consistent intervals)
  registerFixedUpdate (id, callback) {
    this.fixedUpdateCallbacks.set(id, callback)
    devLogger.game(`GameLoopManager: Registered fixed update callback "${id}"`)
  }
  
  // Unregister fixed update callback
  unregisterFixedUpdate (id) {
    const removed = this.fixedUpdateCallbacks.delete(id)
    if (removed) {
      devLogger.game(`GameLoopManager: Unregistered fixed update callback "${id}"`)
    }
    return removed
  }
  
  // Pause the game loop
  pause () {
    if (!this.isPaused) {
      this.isPaused = true
      this.pausedTime = Date.now()
      devLogger.game('GameLoopManager: Paused')
      
      this.game.events.emit('gameloop:paused')
    }
  }
  
  // Resume the game loop
  resume () {
    if (this.isPaused) {
      this.isPaused = false
      
      // Adjust timing to account for pause
      const pauseDuration = Date.now() - this.pausedTime
      this.startTime += pauseDuration
      
      devLogger.game(`GameLoopManager: Resumed after ${pauseDuration}ms pause`)
      
      this.game.events.emit('gameloop:resumed')
    }
  }
  
  // Stop the game loop
  stop () {
    this.isActive = false
    this.updateCallbacks.clear()
    this.fixedUpdateCallbacks.clear()
    
    // Unhook from Phaser events
    if (this.game && this.game.events) {
      this.game.events.off('step', this.onStep, this)
      this.game.events.off('prestep', this.onPreStep, this)
      this.game.events.off('poststep', this.onPostStep, this)
    }
    
    devLogger.game('GameLoopManager: Stopped')
  }
  
  // Restart the game loop
  restart () {
    this.stop()
    this.frameCount = 0
    this.gameTime = 0
    this.fixedUpdateTimer = 0
    this.fpsHistory = []
    this.init()
  }
  
  // Get current performance metrics
  getPerformanceMetrics () {
    return {
      fps: this.fps,
      averageFPS: this.averageFPS,
      deltaTime: this.deltaTime,
      frameCount: this.frameCount,
      gameTime: this.gameTime,
      isActive: this.isActive,
      isPaused: this.isPaused,
      updateCallbackCount: this.updateCallbacks.size,
      fixedUpdateCallbackCount: this.fixedUpdateCallbacks.size
    }
  }
  
  // Get timing information
  getTimingInfo () {
    const currentTime = Date.now()
    const totalTime = currentTime - this.startTime
    
    return {
      startTime: this.startTime,
      currentTime,
      totalTime,
      gameTime: this.gameTime,
      pausedTime: this.isPaused ? currentTime - this.pausedTime : 0,
      fixedUpdateTimer: this.fixedUpdateTimer
    }
  }
  
  // Performance optimization helpers
  optimizeForLowEnd () {
    // Reduce fixed update frequency for low-end devices
    this.fixedUpdateInterval = 1000 / 30 // 30 FPS instead of 60
    devLogger.game('GameLoopManager: Optimized for low-end device')
  }
  
  optimizeForHighEnd () {
    // Restore normal fixed update frequency
    this.fixedUpdateInterval = 1000 / 60 // 60 FPS
    devLogger.game('GameLoopManager: Optimized for high-end device')
  }
  
  // Auto-optimization based on performance
  autoOptimize () {
    if (this.averageFPS < this.performanceWarningThreshold && this.frameCount > 60) {
      this.optimizeForLowEnd()
    } else if (this.averageFPS > 55 && this.fixedUpdateInterval !== 1000 / 60) {
      this.optimizeForHighEnd()
    }
  }
  
  // Debug information
  getDebugInfo () {
    return {
      ...this.getPerformanceMetrics(),
      ...this.getTimingInfo(),
      lowFPSThreshold: this.lowFPSThreshold,
      performanceWarningThreshold: this.performanceWarningThreshold,
      fixedUpdateInterval: this.fixedUpdateInterval
    }
  }
}