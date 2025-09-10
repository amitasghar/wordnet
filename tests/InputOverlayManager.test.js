import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('InputOverlayManager', () => {
  let inputOverlayManager
  let mockGameScene
  let mockUIManager
  let mockCanvas
  let mockHTMLElement
  let mockDocument

  beforeEach(() => {
    // Setup fake timers for debouncing and intervals
    vi.useFakeTimers()
    
    // Mock DOM elements
    mockHTMLElement = {
      style: {},
      value: '',
      focus: vi.fn(),
      blur: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        left: 100,
        top: 200,
        width: 300,
        height: 50
      }))
    }

    mockDocument = {
      createElement: vi.fn(() => mockHTMLElement),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      getElementById: vi.fn(() => mockHTMLElement),
      activeElement: mockHTMLElement
    }

    // Mock Phaser canvas
    mockCanvas = {
      getBoundingClientRect: vi.fn(() => ({
        left: 50,
        top: 100,
        width: 800,
        height: 600
      })),
      style: {
        touchAction: 'none'
      }
    }

    // Mock GameScene
    mockGameScene = {
      game: {
        canvas: mockCanvas,
        config: {
          width: 800,
          height: 600
        }
      },
      input: {
        activePointer: {
          isDown: false
        }
      },
      inputText: {
        x: 400,
        y: 300,
        width: 200,
        height: 40
      },
      handleKeyInput: vi.fn(),
      updateInputDisplay: vi.fn(),
      emit: vi.fn()
    }

    // Mock UIManager
    mockUIManager = {
      getInputBounds: vi.fn(() => ({
        x: 300,
        y: 250,
        width: 200,
        height: 40
      })),
      isInputFocused: vi.fn(() => true)
    }

    // Mock global objects
    global.document = mockDocument
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
      }))
    }

    // Mock navigator for mobile detection
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      maxTouchPoints: 5,
      platform: 'Linux armv7l'
    }

    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    if (inputOverlayManager) {
      inputOverlayManager.destroy()
    }
  })

  describe('Initialization', () => {
    it('should create InputOverlayManager instance', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      
      expect(inputOverlayManager).toBeDefined()
      expect(inputOverlayManager.gameScene).toBe(mockGameScene)
      expect(inputOverlayManager.uiManager).toBe(mockUIManager)
      expect(inputOverlayManager.isInitialized).toBe(false)
    })

    it('should initialize HTML overlay element', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      
      await inputOverlayManager.init()
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('input')
      expect(mockHTMLElement.setAttribute).toHaveBeenCalledWith('type', 'text')
      expect(mockHTMLElement.setAttribute).toHaveBeenCalledWith('autocomplete', 'off')
      expect(mockHTMLElement.setAttribute).toHaveBeenCalledWith('autocapitalize', 'off')
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockHTMLElement)
      expect(inputOverlayManager.isInitialized).toBe(true)
    })

    it('should detect mobile devices correctly', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      
      expect(inputOverlayManager.isMobile).toBe(true)
    })

    it('should detect desktop devices correctly', async () => {
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      global.navigator.maxTouchPoints = 0
      
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      
      expect(inputOverlayManager.isMobile).toBe(false)
    })
  })

  describe('HTML Overlay Management', () => {
    beforeEach(async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()
    })

    it('should position overlay element correctly over Phaser input', () => {
      inputOverlayManager.updateOverlayPosition()
      
      expect(mockHTMLElement.style.position).toBe('absolute')
      expect(mockHTMLElement.style.left).toBe('350px') // canvas.left + input.x
      expect(mockHTMLElement.style.top).toBe('350px')  // canvas.top + input.y
      expect(mockHTMLElement.style.width).toBe('200px')
      expect(mockHTMLElement.style.height).toBe('40px')
    })

    it('should make overlay invisible but functional', () => {
      expect(mockHTMLElement.style.opacity).toBe('0')
      expect(mockHTMLElement.style.pointerEvents).toBe('auto')
      expect(mockHTMLElement.style.zIndex).toBe('1000')
    })

    it('should synchronize HTML input with Phaser display', () => {
      const testText = 'hello'
      mockHTMLElement.value = testText
      
      inputOverlayManager.syncInputContent()
      
      expect(mockGameScene.handleKeyInput).toHaveBeenCalled()
      expect(mockGameScene.updateInputDisplay).toHaveBeenCalled()
    })

    it('should handle input focus and blur events', () => {
      const focusHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'focus'
      )[1]
      const blurHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'blur'
      )[1]

      focusHandler()
      expect(inputOverlayManager.isFocused).toBe(true)
      expect(mockGameScene.emit).toHaveBeenCalledWith('input:focus')

      blurHandler()
      expect(inputOverlayManager.isFocused).toBe(false)
      expect(mockGameScene.emit).toHaveBeenCalledWith('input:blur')
    })
  })

  describe('Mobile Keyboard Detection', () => {
    beforeEach(async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()
    })

    it('should detect virtual keyboard on iOS', () => {
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)'
      global.window.visualViewport.height = 400 // Reduced from 768

      const resizeHandler = global.window.visualViewport.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      resizeHandler()

      expect(inputOverlayManager.isVirtualKeyboardVisible).toBe(true)
      expect(mockGameScene.emit).toHaveBeenCalledWith('virtualKeyboard:show')
    })

    it('should detect virtual keyboard on Android', () => {
      const originalHeight = global.window.innerHeight
      global.window.innerHeight = 400 // Reduced height indicates keyboard

      const resizeHandler = global.window.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      resizeHandler()

      expect(inputOverlayManager.isVirtualKeyboardVisible).toBe(true)
      expect(mockGameScene.emit).toHaveBeenCalledWith('virtualKeyboard:show')
    })

    it('should adjust canvas viewport when virtual keyboard appears', () => {
      inputOverlayManager.handleVirtualKeyboard(true)

      expect(mockGameScene.emit).toHaveBeenCalledWith('viewport:adjust', {
        keyboardHeight: expect.any(Number),
        availableHeight: expect.any(Number)
      })
    })

    it('should restore viewport when virtual keyboard disappears', () => {
      inputOverlayManager.handleVirtualKeyboard(false)

      expect(mockGameScene.emit).toHaveBeenCalledWith('viewport:restore')
    })
  })

  describe('Auto-focus Management', () => {
    beforeEach(async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()
    })

    it('should auto-focus input when game round starts', () => {
      inputOverlayManager.enableAutoFocus()

      expect(mockHTMLElement.focus).toHaveBeenCalled()
      expect(inputOverlayManager.autoFocusEnabled).toBe(true)
    })

    it('should maintain focus during gameplay', () => {
      inputOverlayManager.enableAutoFocus()
      
      // Simulate focus loss
      mockDocument.activeElement = null
      const focusCheckInterval = setInterval(() => {
        inputOverlayManager.checkFocus()
      }, 100)

      vi.advanceTimersByTime(150)
      
      expect(mockHTMLElement.focus).toHaveBeenCalledTimes(2) // Initial + refocus
      
      clearInterval(focusCheckInterval)
    })

    it('should disable auto-focus when round ends', () => {
      inputOverlayManager.enableAutoFocus()
      inputOverlayManager.disableAutoFocus()

      expect(inputOverlayManager.autoFocusEnabled).toBe(false)
      expect(mockHTMLElement.blur).toHaveBeenCalled()
    })
  })

  describe('Touch Event Handling', () => {
    beforeEach(async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()
    })

    it('should prevent unwanted touch behaviors on input area', () => {
      expect(mockHTMLElement.style.touchAction).toBe('manipulation')
      expect(mockCanvas.style.touchAction).toBe('none')
    })

    it('should handle touch events on overlay', () => {
      const touchHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1]

      const mockTouchEvent = {
        preventDefault: vi.fn(),
        touches: [{ clientX: 100, clientY: 200 }]
      }

      touchHandler(mockTouchEvent)

      expect(mockTouchEvent.preventDefault).toHaveBeenCalled()
      expect(mockHTMLElement.focus).toHaveBeenCalled()
    })

    it('should support swipe gesture for clearing input', () => {
      let startX = 0
      const touchStartHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1]
      const touchEndHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'touchend'
      )[1]

      // Start touch
      touchStartHandler({
        preventDefault: vi.fn(),
        touches: [{ clientX: 100, clientY: 200 }]
      })

      // End touch with significant horizontal movement
      touchEndHandler({
        preventDefault: vi.fn(),
        changedTouches: [{ clientX: 200, clientY: 200 }]
      })

      expect(mockGameScene.emit).toHaveBeenCalledWith('input:clear')
    })
  })

  describe('Input Synchronization', () => {
    beforeEach(async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()
    })

    it('should sync HTML input changes to Phaser display', () => {
      mockHTMLElement.value = 'test'
      
      const inputHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'input'
      )[1]

      inputHandler({ target: mockHTMLElement })

      expect(mockGameScene.handleKeyInput).toHaveBeenCalledWith('test')
      expect(mockGameScene.updateInputDisplay).toHaveBeenCalled()
    })

    it('should handle Enter key for word submission', () => {
      const keydownHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1]

      keydownHandler({
        key: 'Enter',
        preventDefault: vi.fn()
      })

      expect(mockGameScene.emit).toHaveBeenCalledWith('input:submit')
    })

    it('should handle Escape key for input clearing', () => {
      const keydownHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1]

      keydownHandler({
        key: 'Escape',
        preventDefault: vi.fn()
      })

      expect(mockGameScene.emit).toHaveBeenCalledWith('input:clear')
    })

    it('should limit input length based on game constraints', () => {
      mockHTMLElement.value = 'verylongwordthatexceedsmaximumlength'
      
      const inputHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'input'
      )[1]

      inputHandler({ target: mockHTMLElement })

      expect(mockHTMLElement.value).toHaveLength(20) // Assuming 20 char limit
    })
  })

  describe('Performance and Memory Management', () => {
    beforeEach(async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()
    })

    it('should debounce input updates for performance', () => {
      const inputHandler = mockHTMLElement.addEventListener.mock.calls.find(
        call => call[0] === 'input'
      )[1]

      // Trigger multiple rapid inputs
      inputHandler({ target: { value: 'a' } })
      inputHandler({ target: { value: 'ab' } })
      inputHandler({ target: { value: 'abc' } })

      // Only the final debounced call should update Phaser
      vi.advanceTimersByTime(250) // Assuming 250ms debounce

      expect(mockGameScene.handleKeyInput).toHaveBeenCalledTimes(1)
      expect(mockGameScene.handleKeyInput).toHaveBeenCalledWith('abc')
    })

    it('should clean up resources on destroy', () => {
      inputOverlayManager.destroy()

      expect(mockHTMLElement.removeEventListener).toHaveBeenCalled()
      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockHTMLElement)
      expect(global.window.removeEventListener).toHaveBeenCalled()
      expect(inputOverlayManager.isInitialized).toBe(false)
    })

    it('should handle overlay repositioning efficiently', () => {
      const updateSpy = vi.spyOn(inputOverlayManager, 'updateOverlayPosition')
      
      // Simulate multiple resize events
      const resizeHandler = global.window.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]
      
      resizeHandler()
      resizeHandler()
      resizeHandler()

      vi.advanceTimersByTime(100) // Throttling delay

      expect(updateSpy).toHaveBeenCalledTimes(1) // Throttled
    })
  })

  describe('Error Handling', () => {
    it('should handle missing DOM gracefully', async () => {
      global.document = null

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)

      expect(() => inputOverlayManager.init()).not.toThrow()
      expect(inputOverlayManager.isInitialized).toBe(false)
    })

    it('should handle canvas positioning errors gracefully', async () => {
      mockCanvas.getBoundingClientRect.mockImplementation(() => {
        throw new Error('Canvas not available')
      })

      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()

      expect(() => inputOverlayManager.updateOverlayPosition()).not.toThrow()
    })

    it('should handle focus events when input element is removed', async () => {
      const { InputOverlayManager } = await import('../src/managers/InputOverlayManager.js')
      inputOverlayManager = new InputOverlayManager(mockGameScene, mockUIManager)
      await inputOverlayManager.init()

      inputOverlayManager.inputElement = null

      expect(() => inputOverlayManager.enableAutoFocus()).not.toThrow()
    })
  })
})