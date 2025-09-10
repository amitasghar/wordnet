import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VisualFeedbackManager } from '../src/managers/VisualFeedbackManager.js'

// Mock dependencies
vi.mock('../src/utils/devTools.js', () => ({
  devLogger: {
    ui: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../src/utils/ErrorTracker.js', () => ({
  trackManagerError: vi.fn()
}))

describe('VisualFeedbackManager', () => {
  let visualFeedbackManager
  let mockGameScene
  let mockInputText
  let mockPhaserObjects
  let mockTweens

  beforeEach(() => {
    // Setup fake timers for animation testing
    vi.useFakeTimers()

    // Mock Phaser text and graphics objects
    mockInputText = {
      x: 400,
      y: 300,
      width: 200,
      height: 40,
      setText: vi.fn(),
      setTint: vi.fn(),
      setAlpha: vi.fn(),
      setVisible: vi.fn(),
      text: ''
    }

    // Mock Phaser objects for character count and animations
    mockPhaserObjects = {
      characterCountText: {
        setText: vi.fn(),
        setTint: vi.fn(),
        setAlpha: vi.fn(),
        setVisible: vi.fn(),
        setOrigin: vi.fn(() => mockPhaserObjects.characterCountText),
        x: 500,
        y: 330
      },
      typingCursor: {
        setVisible: vi.fn(),
        setAlpha: vi.fn(),
        x: 410,
        y: 300,
        width: 2,
        height: 30
      },
      inputBg: {
        setTint: vi.fn(),
        setAlpha: vi.fn(),
        setScale: vi.fn(),
        width: 400,
        height: 60
      },
      feedbackText: {
        setText: vi.fn(),
        setTint: vi.fn(),
        setVisible: vi.fn(),
        setAlpha: vi.fn()
      }
    }

    // Mock Phaser tweens for animations
    mockTweens = {
      add: vi.fn(),
      killTweensOf: vi.fn()
    }

    // Mock GameScene with Phaser components
    mockGameScene = {
      inputText: mockInputText,
      typingCursor: mockPhaserObjects.typingCursor,
      inputBg: mockPhaserObjects.inputBg,
      feedbackText: mockPhaserObjects.feedbackText,
      tweens: mockTweens,
      add: {
        text: vi.fn(() => mockPhaserObjects.characterCountText),
        rectangle: vi.fn(() => mockPhaserObjects.typingCursor),
        graphics: vi.fn()
      },
      cameras: {
        main: { width: 800, height: 600 }
      },
      game: {
        loop: {
          time: 1000,
          delta: 16.67
        }
      },
      events: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      }
    }

    // Create VisualFeedbackManager after mocks are set up
    visualFeedbackManager = new VisualFeedbackManager(mockGameScene)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Character Count Display', () => {
    it('should initialize character count display with zero count', async () => {
      const result = await visualFeedbackManager.init()

      expect(result).toBe(true)
      expect(visualFeedbackManager.character_count).toBe(0)
      expect(visualFeedbackManager.max_length).toBe(20)
      
      // Verify the text element was created
      expect(mockGameScene.add.text).toHaveBeenCalled()
      
      // Verify the character count text was set and styled correctly
      expect(mockPhaserObjects.characterCountText.setText).toHaveBeenCalledWith('0/20')
      expect(mockPhaserObjects.characterCountText.setTint).toHaveBeenCalledWith(0x10b981) // Green
      expect(mockPhaserObjects.characterCountText.setVisible).toHaveBeenCalledWith(true)
    })

    it('should update character count when input changes', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.update_character_count('hello')

      expect(visualFeedbackManager.character_count).toBe(5)
      expect(mockPhaserObjects.characterCountText.setText).toHaveBeenCalledWith('5/20')
      expect(mockPhaserObjects.characterCountText.setTint).toHaveBeenCalledWith(0x10b981) // Green
    })

    it('should show warning color when approaching maximum length', async () => {
      await visualFeedbackManager.init()

      const longInput = 'a'.repeat(16) // 16 chars, warning at 80% (16/20)
      visualFeedbackManager.update_character_count(longInput)

      expect(visualFeedbackManager.character_count).toBe(16)
      expect(mockPhaserObjects.characterCountText.setText).toHaveBeenCalledWith('16/20')
      expect(mockPhaserObjects.characterCountText.setTint).toHaveBeenCalledWith(0xf59e0b) // Orange warning
    })

    it('should show error color when at maximum length', async () => {
      await visualFeedbackManager.init()

      const maxInput = 'a'.repeat(20) // 20 chars, at maximum
      visualFeedbackManager.update_character_count(maxInput)

      expect(visualFeedbackManager.character_count).toBe(20)
      expect(mockPhaserObjects.characterCountText.setText).toHaveBeenCalledWith('20/20')
      expect(mockPhaserObjects.characterCountText.setTint).toHaveBeenCalledWith(0xef4444) // Red error
    })

    it('should handle empty input correctly', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.update_character_count('test')
      visualFeedbackManager.update_character_count('')

      expect(visualFeedbackManager.character_count).toBe(0)
      expect(mockPhaserObjects.characterCountText.setText).toHaveBeenCalledWith('0/20')
      expect(mockPhaserObjects.characterCountText.setTint).toHaveBeenCalledWith(0x10b981) // Green
    })

    it('should respect custom maximum length', async () => {
      visualFeedbackManager.set_max_length(15)
      await visualFeedbackManager.init()

      expect(visualFeedbackManager.max_length).toBe(15)
      expect(mockPhaserObjects.characterCountText.setText).toHaveBeenCalledWith('0/15')
    })
  })

  describe('Typing Cursor Animation', () => {
    it('should initialize cursor animation system', async () => {
      await visualFeedbackManager.init()

      expect(visualFeedbackManager.cursor_animation_active).toBe(false)
      expect(visualFeedbackManager.cursor_blink_rate).toBe(500) // 500ms default
    })

    it('should start cursor blinking when typing begins', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.start_typing_animation()

      expect(visualFeedbackManager.cursor_animation_active).toBe(true)
      expect(mockPhaserObjects.typingCursor.setVisible).toHaveBeenCalledWith(true)
      expect(mockTweens.add).toHaveBeenCalled()
    })

    it('should stop cursor blinking when typing ends', async () => {
      await visualFeedbackManager.init()
      visualFeedbackManager.start_typing_animation()

      visualFeedbackManager.stop_typing_animation()

      expect(visualFeedbackManager.cursor_animation_active).toBe(false)
      expect(mockTweens.killTweensOf).toHaveBeenCalledWith(mockPhaserObjects.typingCursor)
      expect(mockPhaserObjects.typingCursor.setVisible).toHaveBeenCalledWith(false)
    })

    it('should update cursor position based on text width', async () => {
      await visualFeedbackManager.init()
      mockInputText.width = 150

      visualFeedbackManager.update_cursor_position()

      const expectedX = mockInputText.x + (mockInputText.width / 2) + 5
      expect(mockPhaserObjects.typingCursor.x).toBe(expectedX)
    })

    it('should change cursor style based on typing state', async () => {
      await visualFeedbackManager.init()

      // Test active state
      visualFeedbackManager.set_cursor_state('active')
      expect(mockPhaserObjects.typingCursor.setTint).toHaveBeenCalledWith(0xffffff) // White

      // Test error state  
      visualFeedbackManager.set_cursor_state('error')
      expect(mockPhaserObjects.typingCursor.setTint).toHaveBeenCalledWith(0xef4444) // Red

      // Test warning state
      visualFeedbackManager.set_cursor_state('warning')
      expect(mockPhaserObjects.typingCursor.setTint).toHaveBeenCalledWith(0xf59e0b) // Orange
    })

    it('should handle cursor animation performance at 60 FPS', async () => {
      await visualFeedbackManager.init()
      visualFeedbackManager.start_typing_animation()

      // Simulate multiple frame updates
      const frameTime = 1000 / 60 // 16.67ms per frame at 60 FPS
      vi.advanceTimersByTime(frameTime * 5) // 5 frames

      expect(visualFeedbackManager.animation_performance.frame_count).toBeGreaterThan(0)
      expect(visualFeedbackManager.animation_performance.average_frame_time).toBeLessThanOrEqual(frameTime * 1.1) // Allow 10% variance
    })
  })

  describe('Input State Visualization', () => {
    it('should initialize input state system', async () => {
      await visualFeedbackManager.init()

      expect(visualFeedbackManager.input_state).toBe('idle')
      expect(visualFeedbackManager.validation_status).toBe('none')
    })

    it('should update input state with proper visual feedback', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.set_input_state('focused')

      expect(visualFeedbackManager.input_state).toBe('focused')
      expect(mockPhaserObjects.inputBg.setTint).toHaveBeenCalledWith(0x4f46e5) // Focused blue
    })

    it('should show validation status visually', async () => {
      await visualFeedbackManager.init()

      // Test valid state
      visualFeedbackManager.set_validation_status('valid')
      expect(visualFeedbackManager.validation_status).toBe('valid')
      expect(mockPhaserObjects.inputBg.setTint).toHaveBeenCalledWith(0x10b981) // Green

      // Test invalid state
      visualFeedbackManager.set_validation_status('invalid')
      expect(visualFeedbackManager.validation_status).toBe('invalid')
      expect(mockPhaserObjects.inputBg.setTint).toHaveBeenCalledWith(0xef4444) // Red
    })

    it('should show submission progress with visual indicator', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.show_submission_progress(0.5) // 50% progress

      expect(mockPhaserObjects.inputBg.setTint).toHaveBeenCalledWith(0x6366f1) // Processing blue
      expect(mockTweens.add).toHaveBeenCalled() // Progress animation
    })

    it('should handle focus state transitions smoothly', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.set_input_state('focused')
      visualFeedbackManager.set_input_state('idle')

      expect(mockTweens.add).toHaveBeenCalledTimes(2) // Two transition animations
    })
  })

  describe('Transition Animations', () => {
    it('should create smooth fade transition for success feedback', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.show_success_feedback('Great!')

      expect(mockPhaserObjects.feedbackText.setText).toHaveBeenCalledWith('Great!')
      expect(mockPhaserObjects.feedbackText.setTint).toHaveBeenCalledWith(0x10b981) // Green
      expect(mockTweens.add).toHaveBeenCalled() // Animation tween
    })

    it('should create smooth fade transition for error feedback', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.show_error_feedback('Try again!')

      expect(mockPhaserObjects.feedbackText.setText).toHaveBeenCalledWith('Try again!')
      expect(mockPhaserObjects.feedbackText.setTint).toHaveBeenCalledWith(0xef4444) // Red
      expect(mockTweens.add).toHaveBeenCalled() // Animation tween
    })

    it('should handle multiple feedback messages in sequence', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.show_success_feedback('Good!')
      visualFeedbackManager.show_error_feedback('Wrong!')

      // Should cancel previous animation and start new one
      expect(mockTweens.killTweensOf).toHaveBeenCalledWith(mockPhaserObjects.feedbackText)
      expect(mockTweens.add).toHaveBeenCalledTimes(2)
    })

    it('should animate input background color changes smoothly', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.animate_background_color(0x10b981, 300) // Green, 300ms duration

      expect(mockTweens.add).toHaveBeenCalledWith(expect.objectContaining({
        targets: mockPhaserObjects.inputBg,
        duration: 300
      }))
    })

    it('should handle animation interruption gracefully', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.animate_background_color(0x10b981, 500)
      visualFeedbackManager.animate_background_color(0xef4444, 300) // Interrupt with new animation

      expect(mockTweens.killTweensOf).toHaveBeenCalledWith(mockPhaserObjects.inputBg)
    })
  })

  describe('Responsive Input Area Sizing', () => {
    it('should calculate responsive input area size for mobile', async () => {
      mockGameScene.cameras.main.width = 375 // iPhone width
      mockGameScene.cameras.main.height = 667 // iPhone height

      await visualFeedbackManager.init()
      const dimensions = visualFeedbackManager.get_responsive_input_dimensions()

      expect(dimensions.width).toBeLessThanOrEqual(375 - 40) // Screen width minus padding
      expect(dimensions.height).toBeGreaterThanOrEqual(44) // Minimum touch target size
    })

    it('should calculate responsive input area size for tablet', async () => {
      mockGameScene.cameras.main.width = 768 // iPad width
      mockGameScene.cameras.main.height = 1024 // iPad height

      await visualFeedbackManager.init()
      const dimensions = visualFeedbackManager.get_responsive_input_dimensions()

      expect(dimensions.width).toBeLessThanOrEqual(600) // Maximum width for tablets
      expect(dimensions.width).toBeGreaterThan(335) // Larger than mobile
    })

    it('should calculate responsive input area size for desktop', async () => {
      mockGameScene.cameras.main.width = 1920 // Desktop width
      mockGameScene.cameras.main.height = 1080 // Desktop height

      await visualFeedbackManager.init()
      const dimensions = visualFeedbackManager.get_responsive_input_dimensions()

      expect(dimensions.width).toBeLessThanOrEqual(500) // Maximum width for desktop
      expect(dimensions.height).toBe(60) // Standard height for desktop
    })

    it('should update input area size when screen orientation changes', async () => {
      await visualFeedbackManager.init()
      
      // Simulate orientation change from portrait to landscape
      mockGameScene.cameras.main.width = 667
      mockGameScene.cameras.main.height = 375

      visualFeedbackManager.handle_orientation_change()

      const dimensions = visualFeedbackManager.get_responsive_input_dimensions()
      expect(dimensions.width).toBeGreaterThan(335) // Adjusted for landscape
    })

    it('should maintain minimum touch target sizes on all devices', async () => {
      // Test various screen sizes
      const screenSizes = [
        { width: 320, height: 568 }, // Small mobile
        { width: 375, height: 812 }, // iPhone X
        { width: 414, height: 896 }, // iPhone XS Max
        { width: 768, height: 1024 } // iPad
      ]

      for (const size of screenSizes) {
        mockGameScene.cameras.main.width = size.width
        mockGameScene.cameras.main.height = size.height

        await visualFeedbackManager.init()
        const dimensions = visualFeedbackManager.get_responsive_input_dimensions()

        expect(dimensions.height).toBeGreaterThanOrEqual(44) // iOS minimum touch target
        expect(dimensions.width).toBeGreaterThanOrEqual(44) // Minimum width
      }
    })
  })

  describe('Performance Integration', () => {
    it('should integrate with Phaser game loop for 60 FPS performance', async () => {
      await visualFeedbackManager.init()

      // Simulate game loop updates
      const deltaTime = 16.67 // 60 FPS frame time
      visualFeedbackManager.update(deltaTime)

      expect(visualFeedbackManager.performance.frame_time_budget).toBe(16.67)
      expect(visualFeedbackManager.performance.last_update_time).toBeGreaterThan(0)
    })

    it('should track performance metrics during animations', async () => {
      await visualFeedbackManager.init()

      visualFeedbackManager.start_typing_animation()
      vi.advanceTimersByTime(100) // 100ms of animation

      const metrics = visualFeedbackManager.get_performance_metrics()
      expect(metrics.active_animations).toBeGreaterThan(0)
      expect(metrics.average_frame_time).toBeDefined()
    })

    it('should optimize performance by throttling updates', async () => {
      await visualFeedbackManager.init()

      // Rapid character count updates
      for (let i = 0; i < 10; i++) {
        visualFeedbackManager.update_character_count('a'.repeat(i))
      }

      // Should throttle updates to prevent excessive DOM manipulation
      expect(visualFeedbackManager.performance.throttled_updates).toBeGreaterThan(0)
    })

    it('should handle memory cleanup properly', async () => {
      await visualFeedbackManager.init()
      visualFeedbackManager.start_typing_animation()

      visualFeedbackManager.destroy()

      expect(mockTweens.killTweensOf).toHaveBeenCalled() // Animation cleanup
      expect(visualFeedbackManager.cursor_animation_active).toBe(false)
      expect(visualFeedbackManager.isInitialized).toBe(false)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing Phaser objects gracefully', async () => {
      mockGameScene.inputText = null

      expect(async () => {
        await visualFeedbackManager.init()
      }).not.toThrow()
    })

    it('should handle negative character counts', () => {
      visualFeedbackManager.update_character_count('')
      expect(visualFeedbackManager.character_count).toBe(0)
    })

    it('should handle very large input strings', async () => {
      await visualFeedbackManager.init()
      const veryLongInput = 'a'.repeat(1000)

      visualFeedbackManager.update_character_count(veryLongInput)

      expect(visualFeedbackManager.character_count).toBe(20) // Should cap at max_length
    })

    it('should handle rapid state transitions', async () => {
      await visualFeedbackManager.init()

      // Rapid state changes
      visualFeedbackManager.set_input_state('focused')
      visualFeedbackManager.set_input_state('idle')
      visualFeedbackManager.set_input_state('focused')

      expect(mockTweens.killTweensOf).toHaveBeenCalled() // Should cancel intermediate animations
    })

    it('should recover from animation failures', async () => {
      await visualFeedbackManager.init()

      // Mock animation failure
      mockTweens.add.mockImplementationOnce(() => {
        throw new Error('Animation failed')
      })

      expect(() => {
        visualFeedbackManager.show_success_feedback('Test')
      }).not.toThrow()
    })
  })
})