import { devLogger } from '@/utils/devTools.js'

// Screen size breakpoints
export const BREAKPOINTS = {
  MOBILE_PORTRAIT: { width: 480, height: 640 },
  MOBILE_LANDSCAPE: { width: 640, height: 480 },
  TABLET_PORTRAIT: { width: 768, height: 1024 },
  TABLET_LANDSCAPE: { width: 1024, height: 768 },
  DESKTOP: { width: 1200, height: 800 }
}

// Aspect ratios
export const ASPECT_RATIOS = {
  SQUARE: 1,
  STANDARD: 4/3,
  WIDESCREEN: 16/9,
  MOBILE: 9/16
}

export class ResponsiveCanvas {
  constructor (game) {
    this.game = game
    this.originalWidth = 800
    this.originalHeight = 600
    this.targetAspectRatio = ASPECT_RATIOS.STANDARD
    this.minScale = 0.5
    this.maxScale = 2.0
    
    // Device detection
    this.isMobile = this.detectMobile()
    this.isTablet = this.detectTablet()
    this.isDesktop = !this.isMobile && !this.isTablet
    
    // Current viewport info
    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      aspectRatio: window.innerWidth / window.innerHeight,
      orientation: this.getOrientation()
    }
    
    // Event listeners
    this.listeners = new Map()
    this.resizeTimeout = null
    
    this.init()
  }
  
  init () {
    this.setupInitialSize()
    this.setupEventListeners()
    this.updateCanvasSize()
    
    devLogger.game(`ResponsiveCanvas: Initialized for ${this.getDeviceType()} device`)
  }
  
  setupInitialSize () {
    // Set initial game size based on device
    if (this.isMobile) {
      this.originalWidth = 400
      this.originalHeight = 600
      this.targetAspectRatio = ASPECT_RATIOS.MOBILE
    } else if (this.isTablet) {
      this.originalWidth = 600
      this.originalHeight = 800
      this.targetAspectRatio = ASPECT_RATIOS.STANDARD
    } else {
      this.originalWidth = 800
      this.originalHeight = 600
      this.targetAspectRatio = ASPECT_RATIOS.WIDESCREEN
    }
    
    devLogger.game(`ResponsiveCanvas: Set initial size ${this.originalWidth}x${this.originalHeight}`)
  }
  
  setupEventListeners () {
    // Window resize with debouncing
    window.addEventListener('resize', this.handleWindowResize.bind(this))
    
    // Orientation change
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this))
    
    // Visibility change (for performance optimization)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // Fullscreen changes
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this))
  }
  
  // Device detection
  detectMobile () {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
           (window.innerWidth <= BREAKPOINTS.MOBILE_LANDSCAPE.width)
  }
  
  detectTablet () {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent)
    const isTabletSize = window.innerWidth >= BREAKPOINTS.TABLET_PORTRAIT.width && 
                        window.innerWidth <= BREAKPOINTS.DESKTOP.width
    return isTabletUA || isTabletSize
  }
  
  getDeviceType () {
    if (this.isMobile) return 'mobile'
    if (this.isTablet) return 'tablet'
    return 'desktop'
  }
  
  getOrientation () {
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  }
  
  isMobileViewport () {
    return window.innerWidth <= BREAKPOINTS.MOBILE_LANDSCAPE.width
  }
  
  // Size calculation methods
  calculateOptimalSize () {
    const { width: viewportWidth, height: viewportHeight } = this.viewport
    
    // Calculate scale factors
    const scaleX = viewportWidth / this.originalWidth
    const scaleY = viewportHeight / this.originalHeight
    
    // Choose scale based on fit strategy
    let scale
    
    if (this.isMobile) {
      // On mobile, maximize usage of screen space
      scale = Math.min(scaleX, scaleY)
    } else {
      // On desktop/tablet, maintain aspect ratio with some padding
      scale = Math.min(scaleX * 0.9, scaleY * 0.9)
    }
    
    // Apply scale limits
    scale = Math.max(this.minScale, Math.min(this.maxScale, scale))
    
    // Calculate final dimensions
    const gameWidth = Math.floor(this.originalWidth * scale)
    const gameHeight = Math.floor(this.originalHeight * scale)
    
    return {
      width: gameWidth,
      height: gameHeight,
      scale,
      offsetX: Math.floor((viewportWidth - gameWidth) / 2),
      offsetY: Math.floor((viewportHeight - gameHeight) / 2)
    }
  }
  
  calculateAspectRatio (width, height) {
    return width / height
  }
  
  maintainAspectRatio (targetWidth, targetHeight, containerWidth, containerHeight) {
    const targetRatio = targetWidth / targetHeight
    const containerRatio = containerWidth / containerHeight
    
    let width, height
    
    if (containerRatio > targetRatio) {
      // Container is wider than target - fit by height
      height = containerHeight
      width = height * targetRatio
    } else {
      // Container is taller than target - fit by width
      width = containerWidth
      height = width / targetRatio
    }
    
    return { width, height }
  }
  
  // Canvas update methods
  updateCanvasSize () {
    if (!this.game || !this.game.scale) {
      console.error('ResponsiveCanvas: Game or scale manager not available')
      return false
    }
    
    // Update viewport info
    this.updateViewportInfo()
    
    // Calculate optimal size
    const optimalSize = this.calculateOptimalSize()
    
    // Update Phaser scale manager
    this.game.scale.resize(optimalSize.width, optimalSize.height)
    
    // Position canvas
    this.centerCanvas(optimalSize.offsetX, optimalSize.offsetY)
    
    // Update game configuration for responsive elements
    this.updateGameElements(optimalSize)
    
    devLogger.game(`ResponsiveCanvas: Updated to ${optimalSize.width}x${optimalSize.height} (scale: ${optimalSize.scale.toFixed(2)})`)
    
    // Emit resize event
    this.emit('resize', {
      ...optimalSize,
      viewport: this.viewport,
      device: this.getDeviceType()
    })
    
    return true
  }
  
  updateViewportInfo () {
    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      aspectRatio: window.innerWidth / window.innerHeight,
      orientation: this.getOrientation()
    }
  }
  
  centerCanvas (offsetX, offsetY) {
    if (this.game && this.game.canvas) {
      const canvas = this.game.canvas
      canvas.style.position = 'absolute'
      canvas.style.left = offsetX + 'px'
      canvas.style.top = offsetY + 'px'
    }
  }
  
  updateGameElements (sizeData) {
    // Update UI scaling for responsive elements
    if (this.game && this.game.events) {
      this.game.events.emit('canvas:resized', {
        ...sizeData,
        isMobile: this.isMobile,
        isTablet: this.isTablet,
        orientation: this.viewport.orientation
      })
    }
  }
  
  // Resize handling with debouncing
  handleWindowResize () {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout)
    }
    
    this.resizeTimeout = setTimeout(() => {
      this.updateCanvasSize()
    }, 100) // 100ms debounce
  }
  
  handleOrientationChange () {
    // Delay to allow browser to complete orientation change
    setTimeout(() => {
      this.updateCanvasSize()
      devLogger.game(`ResponsiveCanvas: Orientation changed to ${this.getOrientation()}`)
    }, 100)
  }
  
  handleVisibilityChange () {
    if (document.hidden) {
      // Pause performance-intensive updates when tab is hidden
      if (this.game && this.game.loop) {
        this.game.loop.sleep()
      }
    } else {
      // Resume when tab becomes visible and check for size changes
      if (this.game && this.game.loop) {
        this.game.loop.wake()
      }
      this.updateCanvasSize()
    }
  }
  
  handleFullscreenChange () {
    // Update canvas size when entering/exiting fullscreen
    setTimeout(() => {
      this.updateCanvasSize()
    }, 100)
  }
  
  // Utility methods
  setAspectRatio (ratio) {
    this.targetAspectRatio = ratio
    this.updateCanvasSize()
  }
  
  setScaleLimits (min, max) {
    this.minScale = min
    this.maxScale = max
    this.updateCanvasSize()
  }
  
  // Force specific size (for special scenarios)
  setFixedSize (width, height) {
    this.originalWidth = width
    this.originalHeight = height
    this.updateCanvasSize()
  }
  
  // Get current canvas info
  getCanvasInfo () {
    const optimalSize = this.calculateOptimalSize()
    
    return {
      ...optimalSize,
      originalSize: {
        width: this.originalWidth,
        height: this.originalHeight
      },
      viewport: this.viewport,
      device: {
        type: this.getDeviceType(),
        isMobile: this.isMobile,
        isTablet: this.isTablet,
        isDesktop: this.isDesktop
      },
      limits: {
        minScale: this.minScale,
        maxScale: this.maxScale
      }
    }
  }
  
  // Screen utilities
  getScreenCategory () {
    const { width, height } = this.viewport
    
    if (width <= BREAKPOINTS.MOBILE_PORTRAIT.width) {
      return 'mobile-portrait'
    } else if (width <= BREAKPOINTS.MOBILE_LANDSCAPE.width) {
      return 'mobile-landscape'
    } else if (width <= BREAKPOINTS.TABLET_PORTRAIT.width) {
      return 'tablet-portrait'
    } else if (width <= BREAKPOINTS.TABLET_LANDSCAPE.width) {
      return 'tablet-landscape'
    } else {
      return 'desktop'
    }
  }
  
  // Performance optimization
  optimizeForDevice () {
    const deviceType = this.getDeviceType()
    
    if (this.game && this.game.renderer) {
      switch (deviceType) {
        case 'mobile':
          // Reduce quality for mobile devices
          this.game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          break
          
        case 'tablet':
          // Balanced quality for tablets
          this.game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5))
          break
          
        case 'desktop':
          // Full quality for desktop
          this.game.renderer.setPixelRatio(window.devicePixelRatio)
          break
      }
    }
    
    devLogger.game(`ResponsiveCanvas: Optimized for ${deviceType}`)
  }
  
  // Event system
  on (event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }
  
  off (event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
  
  emit (event, data = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`ResponsiveCanvas: Error in event listener for "${event}":`, error)
        }
      })
    }
  }
  
  // Cleanup
  destroy () {
    // Clear timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout)
    }
    
    // Remove event listeners
    window.removeEventListener('resize', this.handleWindowResize.bind(this))
    window.removeEventListener('orientationchange', this.handleOrientationChange.bind(this))
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange.bind(this))
    
    // Clear listeners
    this.listeners.clear()
    
    devLogger.game('ResponsiveCanvas: Destroyed')
  }
  
  // Debug information
  getDebugInfo () {
    return {
      ...this.getCanvasInfo(),
      breakpoints: BREAKPOINTS,
      listeners: this.listeners.size
    }
  }
}