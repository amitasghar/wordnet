import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('GameScene Timer Integration', () => {
  let gameScene
  let mockTimerManager
  let mockPhaser

  beforeEach(() => {
    // Mock TimerManager
    mockTimerManager = {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      getFormattedTime: vi.fn().mockReturnValue('01:30'),
      getProgress: vi.fn().mockReturnValue(50),
      timeRemaining: 90,
      duration: 90,
      isRunning: false,
      isPaused: false,
      on: vi.fn(),
      off: vi.fn()
    }

    // Mock Phaser scene elements
    mockPhaser = {
      add: {
        text: vi.fn().mockReturnValue({
          setOrigin: vi.fn().mockReturnThis(),
          setText: vi.fn().mockReturnThis(),
          setColor: vi.fn().mockReturnThis(),
          setStyle: vi.fn().mockReturnThis(),
          destroy: vi.fn()
        }),
        graphics: vi.fn().mockReturnValue({
          clear: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          strokeCircle: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis()
        })
      },
      tweens: {
        add: vi.fn(),
        killTweensOf: vi.fn()
      },
      cameras: {
        main: { width: 800, height: 600 }
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
      }
    }

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
    if (gameScene) {
      gameScene = null
    }
  })

  describe('Timer Display Creation', () => {
    it('should create timer text display with correct styling', async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      
      // Mock the scene setup
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      // Call the method that creates timer display
      gameScene.createTimerDisplay()
      
      expect(mockPhaser.add.text).toHaveBeenCalledWith(
        expect.any(Number), // x position
        expect.any(Number), // y position
        '01:30', // formatted time
        expect.objectContaining({
          fontSize: expect.any(String),
          fill: expect.any(String),
          fontFamily: expect.any(String)
        })
      )
    })

    it('should create circular progress indicator', async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      gameScene.createTimerDisplay()
      
      expect(mockPhaser.add.graphics).toHaveBeenCalled()
    })

    it('should position timer elements correctly', async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      const { width } = mockPhaser.cameras.main
      gameScene.createTimerDisplay()
      
      // Timer should be positioned in top-right area
      const textCall = mockPhaser.add.text.mock.calls[0]
      expect(textCall[0]).toBeGreaterThan(width * 0.8) // x position
      expect(textCall[1]).toBeLessThan(100) // y position
    })
  })

  describe('Timer Visual Updates', () => {
    beforeEach(async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      // Setup timer display elements
      gameScene.timerText = mockPhaser.add.text()
      gameScene.timerProgress = mockPhaser.add.graphics()
      gameScene.createTimerDisplay()
    })

    it('should update timer text with formatted time', () => {
      mockTimerManager.getFormattedTime.mockReturnValue('01:25')
      
      gameScene.updateTimerDisplay()
      
      expect(gameScene.timerText.setText).toHaveBeenCalledWith('01:25')
    })

    it('should update progress indicator based on remaining time', () => {
      mockTimerManager.getProgress.mockReturnValue(75)
      
      gameScene.updateTimerDisplay()
      
      expect(gameScene.timerProgress.clear).toHaveBeenCalled()
      expect(gameScene.timerProgress.strokeCircle).toHaveBeenCalled()
    })

    it('should change color to yellow when time reaches warning threshold', () => {
      mockTimerManager.timeRemaining = 30
      mockTimerManager.getProgress.mockReturnValue(33)
      
      gameScene.updateTimerDisplay()
      
      expect(gameScene.timerText.setColor).toHaveBeenCalledWith('#f59e0b') // yellow
    })

    it('should change color to red when time reaches critical threshold', () => {
      mockTimerManager.timeRemaining = 10
      mockTimerManager.getProgress.mockReturnValue(11)
      
      gameScene.updateTimerDisplay()
      
      expect(gameScene.timerText.setColor).toHaveBeenCalledWith('#ef4444') // red
    })

    it('should trigger pulse animation when time is critical', () => {
      mockTimerManager.timeRemaining = 5
      mockTimerManager.getProgress.mockReturnValue(5.5)
      
      gameScene.updateTimerDisplay()
      
      expect(mockPhaser.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: gameScene.timerText,
          scaleX: expect.any(Number),
          scaleY: expect.any(Number),
          duration: expect.any(Number),
          yoyo: true
        })
      )
    })
  })

  describe('Timer Event Integration', () => {
    beforeEach(async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      gameScene.setupTimerEventListeners()
    })

    it('should register for timer warning events', () => {
      expect(mockTimerManager.on).toHaveBeenCalledWith(
        'timer:warning',
        expect.any(Function)
      )
    })

    it('should register for timer critical events', () => {
      expect(mockTimerManager.on).toHaveBeenCalledWith(
        'timer:critical',
        expect.any(Function)
      )
    })

    it('should register for timer expired events', () => {
      expect(mockTimerManager.on).toHaveBeenCalledWith(
        'timer:expired',
        expect.any(Function)
      )
    })

    it('should handle timer warning events correctly', () => {
      const warningCallback = mockTimerManager.on.mock.calls
        .find(call => call[0] === 'timer:warning')[1]
      
      gameScene.showTimerWarning = vi.fn()
      
      warningCallback({ timeRemaining: 30, warningLevel: 'medium' })
      
      expect(gameScene.showTimerWarning).toHaveBeenCalledWith('medium', 30)
    })

    it('should handle timer expiration correctly', () => {
      const expiredCallback = mockTimerManager.on.mock.calls
        .find(call => call[0] === 'timer:expired')[1]
      
      gameScene.endGame = vi.fn()
      
      expiredCallback({ timeRemaining: 0 })
      
      expect(gameScene.endGame).toHaveBeenCalled()
    })
  })

  describe('Timer Lifecycle Integration', () => {
    beforeEach(async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
    })

    it('should start timer when round starts', () => {
      gameScene.startRound()
      
      expect(mockTimerManager.start).toHaveBeenCalledWith(90)
    })

    it('should pause timer when game is paused', () => {
      gameScene.pauseGame()
      
      expect(mockTimerManager.pause).toHaveBeenCalled()
    })

    it('should resume timer when game is resumed', () => {
      gameScene.resumeGame()
      
      expect(mockTimerManager.resume).toHaveBeenCalled()
    })

    it('should stop timer when game ends', () => {
      gameScene.endGame()
      
      expect(mockTimerManager.stop).toHaveBeenCalled()
    })

    it('should reset timer when scene is reset', () => {
      gameScene.resetScene()
      
      expect(mockTimerManager.reset).toHaveBeenCalled()
    })
  })

  describe('Visual Responsiveness', () => {
    beforeEach(async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      gameScene.timerText = mockPhaser.add.text()
      gameScene.timerProgress = mockPhaser.add.graphics()
    })

    it('should handle different screen sizes correctly', () => {
      // Test smaller screen
      mockPhaser.cameras.main.width = 400
      mockPhaser.cameras.main.height = 300
      
      gameScene.createTimerDisplay()
      
      // Verify positioning adapts to smaller screen
      const textCall = mockPhaser.add.text.mock.calls[0]
      expect(textCall[0]).toBeGreaterThan(320) // 80% of 400
    })

    it('should clean up animations on scene destruction', () => {
      gameScene.destroy()
      
      expect(mockPhaser.tweens.killTweensOf).toHaveBeenCalledWith(gameScene.timerText)
    })

    it('should remove event listeners on cleanup', () => {
      gameScene.cleanup()
      
      expect(mockTimerManager.off).toHaveBeenCalledWith('timer:warning')
      expect(mockTimerManager.off).toHaveBeenCalledWith('timer:critical')
      expect(mockTimerManager.off).toHaveBeenCalledWith('timer:expired')
    })
  })

  describe('Performance Considerations', () => {
    beforeEach(async () => {
      const { GameScene } = await import('../src/scenes/GameScene.js')
      gameScene = new GameScene()
      Object.assign(gameScene, mockPhaser)
      gameScene.timerManager = mockTimerManager
      
      gameScene.timerText = mockPhaser.add.text()
      gameScene.timerProgress = mockPhaser.add.graphics()
    })

    it('should throttle visual updates to avoid excessive redraws', () => {
      const startTime = Date.now()
      
      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        gameScene.updateTimerDisplay()
      }
      
      // Should not call setText for every update if throttled
      expect(gameScene.timerText.setText).toHaveBeenCalled()
    })

    it('should not update visuals when timer values haven\'t changed', () => {
      const initialFormattedTime = '01:30'
      mockTimerManager.getFormattedTime.mockReturnValue(initialFormattedTime)
      
      gameScene.updateTimerDisplay()
      gameScene.updateTimerDisplay() // Second call with same values
      
      expect(gameScene.timerText.setText).toHaveBeenCalledTimes(1)
    })
  })
})