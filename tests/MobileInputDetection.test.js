import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Mobile Input Detection', () => {
  let originalNavigator
  let originalWindow

  beforeEach(() => {
    // Store original objects
    originalNavigator = global.navigator
    originalWindow = global.window

    // Mock basic window object
    global.window = {
      innerWidth: 1024,
      innerHeight: 768,
      visualViewport: {
        height: 768,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })),
      screen: {
        orientation: {
          angle: 0,
          type: 'portrait-primary',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      }
    }

    vi.resetModules()
  })

  afterEach(() => {
    global.navigator = originalNavigator
    global.window = originalWindow
    vi.clearAllMocks()
  })

  describe('Device Type Detection', () => {
    it('should detect iOS devices', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        maxTouchPoints: 5,
        platform: 'iPhone'
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(inputManager.deviceInfo.isIOS).toBe(true)
      expect(inputManager.deviceInfo.isAndroid).toBe(false)
      expect(inputManager.deviceInfo.isMobile).toBe(true)
    })

    it('should detect Android devices', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        maxTouchPoints: 10,
        platform: 'Linux armv7l'
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(inputManager.deviceInfo.isAndroid).toBe(true)
      expect(inputManager.deviceInfo.isIOS).toBe(false)
      expect(inputManager.deviceInfo.isMobile).toBe(true)
    })

    it('should detect tablet devices', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        maxTouchPoints: 5,
        platform: 'MacIntel'
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(inputManager.deviceInfo.isTablet).toBe(true)
      expect(inputManager.deviceInfo.isMobile).toBe(true)
    })

    it('should detect desktop devices', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        maxTouchPoints: 0,
        platform: 'Win32'
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(inputManager.deviceInfo.isMobile).toBe(false)
      expect(inputManager.deviceInfo.isDesktop).toBe(true)
    })

    it('should handle touch capability detection', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        maxTouchPoints: 1,
        platform: 'Win32'
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(inputManager.deviceInfo.hasTouch).toBe(true)
      expect(inputManager.deviceInfo.touchPoints).toBe(1)
    })
  })

  describe('Virtual Keyboard Detection', () => {
    it('should detect iOS virtual keyboard using visualViewport', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
        maxTouchPoints: 5
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      // Simulate keyboard appearance
      global.window.visualViewport.height = 400 // Reduced from initial 768

      const resizeHandler = global.window.visualViewport.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      resizeHandler()

      expect(inputManager.virtualKeyboard.isVisible).toBe(true)
      expect(inputManager.virtualKeyboard.height).toBeGreaterThan(0)
      expect(mockGameScene.emit).toHaveBeenCalledWith('virtualKeyboard:show', {
        height: expect.any(Number),
        availableHeight: 400
      })
    })

    it('should detect Android virtual keyboard using window resize', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (Linux; Android 10)',
        maxTouchPoints: 10
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      const originalHeight = global.window.innerHeight
      global.window.innerHeight = 400 // Keyboard reduces height

      const resizeHandler = global.window.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      resizeHandler()

      expect(inputManager.virtualKeyboard.isVisible).toBe(true)
      expect(mockGameScene.emit).toHaveBeenCalledWith('virtualKeyboard:show')
    })

    it('should calculate keyboard height accurately', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
        maxTouchPoints: 5
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      const originalHeight = 768
      const reducedHeight = 400
      global.window.visualViewport.height = reducedHeight

      const resizeHandler = global.window.visualViewport.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      resizeHandler()

      const expectedKeyboardHeight = originalHeight - reducedHeight
      expect(inputManager.virtualKeyboard.height).toBe(expectedKeyboardHeight)
    })

    it('should detect keyboard dismissal', async () => {
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
        maxTouchPoints: 5
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      // Show keyboard first
      global.window.visualViewport.height = 400
      const resizeHandler = global.window.visualViewport.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]
      resizeHandler()

      // Hide keyboard
      global.window.visualViewport.height = 768
      resizeHandler()

      expect(inputManager.virtualKeyboard.isVisible).toBe(false)
      expect(inputManager.virtualKeyboard.height).toBe(0)
      expect(mockGameScene.emit).toHaveBeenCalledWith('virtualKeyboard:hide')
    })
  })

  describe('Orientation Detection', () => {
    it('should detect portrait orientation', async () => {
      global.window.screen.orientation.type = 'portrait-primary'

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      expect(inputManager.orientation.isPortrait).toBe(true)
      expect(inputManager.orientation.isLandscape).toBe(false)
    })

    it('should detect landscape orientation', async () => {
      global.window.screen.orientation.type = 'landscape-primary'

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      expect(inputManager.orientation.isLandscape).toBe(true)
      expect(inputManager.orientation.isPortrait).toBe(false)
    })

    it('should handle orientation changes', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      const orientationHandler = global.window.screen.orientation.addEventListener.mock.calls.find(
        call => call[0] === 'change'
      )[1]

      // Change to landscape
      global.window.screen.orientation.type = 'landscape-primary'
      orientationHandler()

      expect(mockGameScene.emit).toHaveBeenCalledWith('orientation:change', {
        type: 'landscape-primary',
        isPortrait: false,
        isLandscape: true
      })
    })
  })

  describe('Viewport Management', () => {
    it('should calculate safe area insets', async () => {
      global.window.CSS = {
        supports: vi.fn((property, value) => {
          return property === 'padding' && value.includes('env(safe-area-inset')
        })
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      expect(inputManager.viewport.hasSafeArea).toBe(true)
    })

    it('should adjust for notched devices', async () => {
      global.window.CSS = {
        supports: vi.fn(() => true)
      }

      const mockComputedStyle = {
        getPropertyValue: vi.fn((prop) => {
          if (prop === '--safe-area-inset-top') return '44px'
          if (prop === '--safe-area-inset-bottom') return '34px'
          return '0px'
        })
      }

      global.window.getComputedStyle = vi.fn(() => mockComputedStyle)

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      expect(inputManager.viewport.safeAreaInsets.top).toBe(44)
      expect(inputManager.viewport.safeAreaInsets.bottom).toBe(34)
    })
  })

  describe('Input Method Detection', () => {
    it('should detect different keyboard types', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      // Test numeric keyboard
      inputManager.setInputMode('numeric')
      expect(inputManager.inputMode).toBe('numeric')

      // Test text keyboard  
      inputManager.setInputMode('text')
      expect(inputManager.inputMode).toBe('text')

      // Test search keyboard
      inputManager.setInputMode('search')
      expect(inputManager.inputMode).toBe('search')
    })

    it('should handle keyboard type changes', async () => {
      const mockElement = {
        setAttribute: vi.fn(),
        type: 'text',
        inputMode: 'text'
      }

      global.document = {
        createElement: vi.fn(() => mockElement),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      inputManager.setInputMode('numeric')

      expect(mockElement.setAttribute).toHaveBeenCalledWith('inputmode', 'numeric')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('pattern', '[0-9]*')
    })
  })

  describe('Performance Monitoring', () => {
    it('should track input response times', async () => {
      global.performance = {
        now: vi.fn()
          .mockReturnValueOnce(100)
          .mockReturnValueOnce(110)
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      inputManager.measureInputLatency()

      expect(inputManager.performance.inputLatency).toBe(10) // 110 - 100
    })

    it('should monitor keyboard detection timing', async () => {
      global.performance = {
        now: vi.fn()
          .mockReturnValueOnce(200)
          .mockReturnValueOnce(250)
      }

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      // Simulate keyboard detection
      global.window.visualViewport.height = 400
      const resizeHandler = global.window.visualViewport.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      resizeHandler()

      expect(inputManager.performance.keyboardDetectionTime).toBe(50) // 250 - 200
    })

    it('should report performance metrics', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      const metrics = inputManager.getPerformanceMetrics()

      expect(metrics).toHaveProperty('inputLatency')
      expect(metrics).toHaveProperty('keyboardDetectionTime')
      expect(metrics).toHaveProperty('updateFrequency')
      expect(metrics).toHaveProperty('memoryUsage')
    })
  })

  describe('Error Handling and Fallbacks', () => {
    it('should fallback gracefully when visualViewport is unavailable', async () => {
      delete global.window.visualViewport

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(() => inputManager.init()).not.toThrow()
      expect(inputManager.fallbackMode).toBe(true)
    })

    it('should handle orientation API unavailability', async () => {
      delete global.window.screen.orientation

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(() => inputManager.init()).not.toThrow()
      expect(inputManager.orientation.supported).toBe(false)
    })

    it('should handle CSS.supports unavailability', async () => {
      delete global.window.CSS

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { game: { canvas: {} } }
      const inputManager = new InputOverlayManager(mockGameScene)

      expect(() => inputManager.init()).not.toThrow()
      expect(inputManager.viewport.hasSafeArea).toBe(false)
    })

    it('should recover from detection failures', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      const mockGameScene = { 
        game: { canvas: {} },
        emit: vi.fn()
      }
      const inputManager = new InputOverlayManager(mockGameScene)
      await inputManager.init()

      // Simulate detection failure
      inputManager.handleDetectionError(new Error('Detection failed'))

      expect(mockGameScene.emit).toHaveBeenCalledWith('detection:error', {
        error: expect.any(Error),
        fallbackMode: true
      })
    })
  })
})