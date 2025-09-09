import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('UI Integration System', () => {
  let mockElement, mockGame

  beforeEach(() => {
    // Mock DOM elements
    mockElement = {
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false)
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
      innerText: '',
      offsetWidth: 800,
      offsetHeight: 600
    }

    // Mock game
    mockGame = {
      canvas: mockElement,
      scale: {
        resize: vi.fn(),
        setMaxZoom: vi.fn(),
        setZoom: vi.fn()
      },
      events: {
        emit: vi.fn(),
        on: vi.fn()
      }
    }

    // Mock document
    Object.defineProperty(global, 'document', {
      value: {
        getElementById: vi.fn(() => mockElement),
        createElement: vi.fn(() => mockElement),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true
    })

    // Mock window
    Object.defineProperty(global, 'window', {
      value: {
        innerWidth: 1200,
        innerHeight: 800,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getComputedStyle: vi.fn(() => ({ getPropertyValue: vi.fn() }))
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create UIManager correctly', async () => {
    const { UIManager } = await import('../src/managers/UIManager.js')
    const uiManager = new UIManager(mockGame)
    
    expect(uiManager).toBeDefined()
    expect(typeof uiManager.createOverlay).toBe('function')
    expect(typeof uiManager.showNotification).toBe('function')
  })

  it('should handle responsive canvas setup', async () => {
    const { ResponsiveCanvas } = await import('../src/utils/ResponsiveCanvas.js')
    const canvas = new ResponsiveCanvas(mockGame)
    
    expect(canvas).toBeDefined()
    expect(typeof canvas.resize).toBe('function')
    expect(typeof canvas.setAspectRatio).toBe('function')
  })

  it('should create notifications', async () => {
    const { UIManager } = await import('../src/managers/UIManager.js')
    const uiManager = new UIManager(mockGame)
    
    const notification = uiManager.showNotification('Test message', 'success')
    expect(notification).toBeDefined()
  })

  it('should handle overlay creation', async () => {
    const { UIManager } = await import('../src/managers/UIManager.js')
    const uiManager = new UIManager(mockGame)
    
    const overlay = uiManager.createOverlay('test-overlay', '<div>Test</div>')
    expect(overlay).toBeDefined()
  })
})

describe('Responsive Canvas System', () => {
  let mockCanvas, mockGame

  beforeEach(() => {
    mockCanvas = {
      width: 800,
      height: 600,
      style: {},
      offsetWidth: 800,
      offsetHeight: 600
    }

    mockGame = {
      canvas: mockCanvas,
      scale: {
        resize: vi.fn(),
        setMaxZoom: vi.fn(),
        setZoom: vi.fn(),
        displaySize: { width: 800, height: 600 },
        gameSize: { width: 800, height: 600 }
      },
      events: {
        emit: vi.fn(),
        on: vi.fn()
      }
    }
  })

  it('should calculate correct aspect ratios', async () => {
    const { ResponsiveCanvas } = await import('../src/utils/ResponsiveCanvas.js')
    const canvas = new ResponsiveCanvas(mockGame)
    
    const ratio = canvas.calculateAspectRatio(1600, 900)
    expect(ratio).toBeCloseTo(16/9, 2)
  })

  it('should handle mobile viewport', async () => {
    const { ResponsiveCanvas } = await import('../src/utils/ResponsiveCanvas.js')
    const canvas = new ResponsiveCanvas(mockGame)
    
    // Mock mobile dimensions
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })
    
    const isMobile = canvas.isMobileViewport()
    expect(typeof isMobile).toBe('boolean')
  })

  it('should handle window resize', async () => {
    const { ResponsiveCanvas } = await import('../src/utils/ResponsiveCanvas.js')
    const canvas = new ResponsiveCanvas(mockGame)
    
    const resizeHandler = vi.fn()
    canvas.on('resize', resizeHandler)
    
    canvas.handleWindowResize()
    
    // Verify resize handling was attempted
    expect(mockGame.scale.resize).toHaveBeenCalled()
  })
})

describe('Event Communication System', () => {
  it('should create EventBridge correctly', async () => {
    const { EventBridge } = await import('../src/utils/EventBridge.js')
    const bridge = new EventBridge()
    
    expect(bridge).toBeDefined()
    expect(typeof bridge.emit).toBe('function')
    expect(typeof bridge.on).toBe('function')
  })

  it('should handle cross-system events', async () => {
    const { EventBridge } = await import('../src/utils/EventBridge.js')
    const bridge = new EventBridge()
    
    const handler = vi.fn()
    bridge.on('test:event', handler)
    
    bridge.emit('test:event', { data: 'test' })
    
    expect(handler).toHaveBeenCalledWith({ data: 'test' })
  })

  it('should remove event listeners', async () => {
    const { EventBridge } = await import('../src/utils/EventBridge.js')
    const bridge = new EventBridge()
    
    const handler = vi.fn()
    bridge.on('test:event', handler)
    bridge.off('test:event', handler)
    
    bridge.emit('test:event', { data: 'test' })
    
    expect(handler).not.toHaveBeenCalled()
  })
})