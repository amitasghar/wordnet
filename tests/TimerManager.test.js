import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('TimerManager', () => {
  let timerManager
  let mockGameLoopManager
  let mockGameStateManager
  let mockDevLogger

  beforeEach(() => {
    // Mock GameLoopManager
    mockGameLoopManager = {
      addUpdateCallback: vi.fn(),
      removeUpdateCallback: vi.fn(),
      isPaused: false,
      deltaTime: 16.67 // ~60 FPS
    }

    // Mock GameStateManager
    mockGameStateManager = {
      roundConfig: {
        timeLimit: 90
      },
      emit: vi.fn(),
      getCurrentRound: vi.fn().mockReturnValue({ id: 1, type: 'standard' })
    }

    // Mock devLogger
    mockDevLogger = {
      timer: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    // Mock global performance
    global.performance = {
      now: vi.fn().mockReturnValue(0)
    }

    // Mock devLogger globally
    vi.doMock('@/utils/devTools.js', () => ({
      devLogger: mockDevLogger
    }))

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
    if (timerManager) {
      timerManager.destroy()
    }
  })

  describe('Initialization', () => {
    it('should create TimerManager instance', async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
      
      expect(timerManager).toBeDefined()
      expect(timerManager.isRunning).toBe(false)
      expect(timerManager.timeRemaining).toBe(90) // Should be initialized to duration
      expect(timerManager.duration).toBe(90)
    })

    it('should register with GameLoopManager on initialization', async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
      
      expect(mockGameLoopManager.addUpdateCallback).toHaveBeenCalledWith(
        expect.any(Function),
        'timer'
      )
    })

    it('should use custom duration when provided', async () => {
      // Reset modules to ensure fresh import
      vi.resetModules()
      
      // Create a new mock with custom duration
      const customMockGameStateManager = {
        roundConfig: {
          timeLimit: 60
        },
        emit: vi.fn(),
        getCurrentRound: vi.fn().mockReturnValue({ id: 1, type: 'standard' })
      }
      
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, customMockGameStateManager)
      
      expect(timerManager.duration).toBe(60)
      expect(timerManager.timeRemaining).toBe(60)
    })
  })

  describe('Timer Control', () => {
    beforeEach(async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
    })

    it('should start timer correctly', () => {
      timerManager.start(90)
      
      expect(timerManager.isRunning).toBe(true)
      expect(timerManager.timeRemaining).toBe(90)
      expect(timerManager.duration).toBe(90)
    })

    it('should pause timer correctly', () => {
      timerManager.start(90)
      timerManager.pause()
      
      expect(timerManager.isRunning).toBe(false)
      expect(timerManager.isPaused).toBe(true)
      expect(timerManager.timeRemaining).toBe(90)
    })

    it('should resume timer correctly', () => {
      timerManager.start(90)
      timerManager.pause()
      timerManager.resume()
      
      expect(timerManager.isRunning).toBe(true)
      expect(timerManager.isPaused).toBe(false)
    })

    it('should stop timer correctly', () => {
      timerManager.start(90)
      timerManager.stop()
      
      expect(timerManager.isRunning).toBe(false)
      expect(timerManager.isPaused).toBe(false)
      expect(timerManager.timeRemaining).toBe(0)
    })

    it('should reset timer correctly', () => {
      timerManager.start(90)
      timerManager.update(1000) // 1 second
      timerManager.reset()
      
      expect(timerManager.isRunning).toBe(false)
      expect(timerManager.timeRemaining).toBe(90)
      expect(timerManager.warningsTriggered.size).toBe(0)
    })
  })

  describe('Timer Updates', () => {
    beforeEach(async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
      timerManager.start(90)
    })

    it('should update time remaining correctly', () => {
      timerManager.update(1000) // 1 second
      
      expect(timerManager.timeRemaining).toBe(89)
    })

    it('should not update when paused', () => {
      timerManager.pause()
      timerManager.update(1000)
      
      expect(timerManager.timeRemaining).toBe(90)
    })

    it('should respect GameLoopManager pause state', () => {
      mockGameLoopManager.isPaused = true
      timerManager.update(1000)
      
      expect(timerManager.timeRemaining).toBe(90)
    })

    it('should handle sub-second precision with delta accumulation', () => {
      timerManager.update(500) // 0.5 seconds
      expect(timerManager.timeRemaining).toBe(90) // Should not decrease yet
      
      timerManager.update(600) // Another 0.6 seconds (total 1.1s)
      expect(timerManager.timeRemaining).toBe(89) // Should decrease by 1
    })
  })

  describe('Timer Events', () => {
    beforeEach(async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
    })

    it('should emit warning events at correct intervals', () => {
      timerManager.start(90)
      
      // Test 30-second warning
      timerManager.update(60 * 1000) // 60 seconds elapsed, 30 remaining
      expect(mockGameStateManager.emit).toHaveBeenCalledWith('timer:warning', {
        timeRemaining: 30,
        warningLevel: 'medium',
        threshold: 30
      })
      
      // Test 10-second critical warning
      timerManager.update(20 * 1000) // 20 more seconds elapsed, 10 remaining
      expect(mockGameStateManager.emit).toHaveBeenCalledWith('timer:critical', {
        timeRemaining: 10,
        warningLevel: 'critical',
        threshold: 10
      })
    })

    it('should emit expired event when time runs out', () => {
      timerManager.start(90)
      timerManager.update(90 * 1000) // 90 seconds elapsed
      
      expect(mockGameStateManager.emit).toHaveBeenCalledWith('timer:expired', {
        timeRemaining: 0,
        duration: 90
      })
      expect(timerManager.isRunning).toBe(false)
    })

    it('should not emit duplicate warning events', () => {
      timerManager.start(90)
      
      // Trigger 30-second warning twice
      timerManager.update(60 * 1000)
      timerManager.update(100) // Small additional time
      
      expect(mockGameStateManager.emit).toHaveBeenCalledWith('timer:warning', {
        timeRemaining: 30,
        warningLevel: 'medium',
        threshold: 30
      })
      expect(mockGameStateManager.emit).toHaveBeenCalledTimes(1)
    })
  })

  describe('Timer State Management', () => {
    beforeEach(async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
    })

    it('should preserve state during pause/resume cycle', () => {
      timerManager.start(90)
      timerManager.update(30 * 1000) // 30 seconds elapsed
      
      const timeBeforePause = timerManager.timeRemaining
      timerManager.pause()
      timerManager.update(10 * 1000) // Should not affect time
      timerManager.resume()
      
      expect(timerManager.timeRemaining).toBe(timeBeforePause)
      expect(timerManager.isRunning).toBe(true)
    })

    it('should maintain warning state across pause/resume', () => {
      timerManager.start(90)
      timerManager.update(60 * 1000) // Trigger 30-second warning
      
      timerManager.pause()
      timerManager.resume()
      timerManager.update(100) // Small time increment
      
      // Should not re-trigger the same warning
      expect(mockGameStateManager.emit).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
    })

    it('should handle invalid start duration gracefully', () => {
      expect(() => timerManager.start(-10)).not.toThrow()
      expect(timerManager.duration).toBe(90) // Should use default
    })

    it('should handle missing GameStateManager gracefully', async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, null)
      
      expect(() => timerManager.start(90)).not.toThrow()
      expect(() => timerManager.update(1000)).not.toThrow()
    })

    it('should handle extreme delta times gracefully', () => {
      timerManager.start(90)
      
      // Simulate very large delta (e.g., browser tab inactive for long time)
      timerManager.update(120 * 1000) // 120 seconds
      
      expect(timerManager.timeRemaining).toBe(0)
      expect(timerManager.isRunning).toBe(false)
      expect(mockGameStateManager.emit).toHaveBeenCalledWith('timer:expired', {
        timeRemaining: 0,
        duration: 90
      })
    })
  })

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
    })

    it('should complete update cycle in under 1ms', () => {
      const startTime = performance.now()
      timerManager.start(90)
      
      for (let i = 0; i < 100; i++) {
        timerManager.update(16.67) // Simulate 60 FPS updates
      }
      
      const endTime = performance.now()
      const avgTimePerUpdate = (endTime - startTime) / 100
      
      expect(avgTimePerUpdate).toBeLessThan(1) // Less than 1ms per update
    })

    it('should maintain accuracy within ±100ms over full duration', () => {
      timerManager.start(90)
      
      // Simulate 90 seconds of updates at 60 FPS
      for (let i = 0; i < 90 * 60; i++) {
        timerManager.update(16.67) // ~60 FPS delta
      }
      
      // Should be within ±100ms of expected
      expect(Math.abs(timerManager.timeRemaining - 0)).toBeLessThan(0.1)
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      const { TimerManager } = await import('../src/managers/TimerManager.js')
      timerManager = new TimerManager(mockGameLoopManager, mockGameStateManager)
      
      timerManager.destroy()
      
      expect(mockGameLoopManager.removeUpdateCallback).toHaveBeenCalledWith('timer')
      expect(timerManager.isRunning).toBe(false)
    })
  })
})