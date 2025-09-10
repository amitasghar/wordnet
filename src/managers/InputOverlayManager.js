import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'

/**
 * InputOverlayManager - Enhanced mobile input system with HTML overlay
 * 
 * Provides seamless mobile input experience by overlaying an invisible HTML input
 * element over the Phaser canvas. Handles virtual keyboard detection, auto-focus
 * management, and touch event optimization for mobile devices.
 * 
 * Features:
 * - HTML input overlay for proper mobile keyboard support
 * - Virtual keyboard detection and viewport adjustment
 * - Auto-focus management during gameplay
 * - Touch event handling and gesture support
 * - Real-time input synchronization with Phaser display
 * - Cross-platform compatibility (iOS/Android/Desktop)
 * 
 * @class InputOverlayManager
 * @example
 * const inputManager = new InputOverlayManager(gameScene, uiManager)
 * await inputManager.init()
 * inputManager.enableAutoFocus()
 */
export class InputOverlayManager {
  /**
   * Create an InputOverlayManager instance
   * @param {GameScene} gameScene - The Phaser GameScene instance
   * @param {UIManager} [uiManager=null] - Optional UI manager for layout information
   */
  constructor (gameScene, uiManager = null) {
    this.gameScene = gameScene
    this.uiManager = uiManager
    
    // Core state
    this.isInitialized = false
    this.inputElement = null
    this.isFocused = false
    this.autoFocusEnabled = false
    
    // Device and capability detection
    this.deviceInfo = this.detectDevice()
    this.isMobile = this.deviceInfo.isMobile
    this.hasTouch = this.deviceInfo.hasTouch
    
    // Virtual keyboard state
    this.virtualKeyboard = {
      isVisible: false,
      height: 0,
      detectionMethod: this.deviceInfo.isIOS ? 'visualViewport' : 'windowResize'
    }
    
    // Orientation state
    this.orientation = {
      current: 'unknown',
      isPortrait: false,
      isLandscape: false,
      supported: 'orientation' in (window.screen || {})
    }
    
    // Viewport state
    this.viewport = {
      originalHeight: window.innerHeight,
      currentHeight: window.innerHeight,
      hasSafeArea: this.detectSafeAreaSupport(),
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 }
    }
    
    // Input configuration
    this.inputMode = 'text'
    this.maxLength = 20
    this.debounceDelay = 100
    this.fallbackMode = false
    
    // Performance tracking
    this.performance = {
      inputLatency: 0,
      keyboardDetectionTime: 0,
      updateFrequency: 0,
      memoryUsage: 0,
      lastUpdateTime: 0
    }
    
    // Touch tracking
    this.touch = {
      startX: 0,
      startY: 0,
      isTracking: false,
      swipeThreshold: 50
    }
    
    // Event handlers (bound methods for cleanup)
    this.boundHandlers = {
      input: this.handleInput.bind(this),
      keydown: this.handleKeyDown.bind(this),
      focus: this.handleFocus.bind(this),
      blur: this.handleBlur.bind(this),
      touchstart: this.handleTouchStart.bind(this),
      touchmove: this.handleTouchMove.bind(this),
      touchend: this.handleTouchEnd.bind(this),
      resize: this.throttle(this.handleResize.bind(this), 100),
      orientationChange: this.handleOrientationChange.bind(this),
      visualViewportResize: this.handleVisualViewportResize.bind(this)
    }
    
    devLogger.input('InputOverlayManager created', {
      isMobile: this.isMobile,
      hasTouch: this.hasTouch,
      device: this.deviceInfo.type
    })
  }
  
  /**
   * Initialize the input overlay system
   * @returns {Promise<boolean>} Success status
   */
  async init () {
    try {
      if (this.isInitialized) {
        devLogger.input('InputOverlayManager already initialized')
        return true
      }
      
      if (!this.validateEnvironment()) {
        devLogger.warn('InputOverlayManager: Environment validation failed, using fallback mode')
        this.fallbackMode = true
      }
      
      await this.createOverlayElement()
      this.setupEventListeners()
      this.updateDeviceInfo()
      this.calculateSafeAreaInsets()
      
      if (this.isMobile) {
        this.setupVirtualKeyboardDetection()
      }
      
      this.isInitialized = true
      devLogger.input('InputOverlayManager initialized successfully', {
        fallbackMode: this.fallbackMode,
        hasOverlay: !!this.inputElement
      })
      
      return true
    } catch (error) {
      trackManagerError('InputOverlayManager', 'init', error)
      devLogger.error('InputOverlayManager initialization failed', error)
      this.fallbackMode = true
      return false
    }
  }
  
  /**
   * Create the HTML input overlay element
   * @private
   */
  async createOverlayElement () {
    if (!document || this.fallbackMode) {
      devLogger.warn('InputOverlayManager: Document unavailable, skipping overlay creation')
      return
    }
    
    try {
      this.inputElement = document.createElement('input')
      
      // Configure input element
      this.inputElement.setAttribute('type', 'text')
      this.inputElement.setAttribute('autocomplete', 'off')
      this.inputElement.setAttribute('autocapitalize', 'off')
      this.inputElement.setAttribute('autocorrect', 'off')
      this.inputElement.setAttribute('spellcheck', 'false')
      this.inputElement.setAttribute('maxlength', this.maxLength.toString())
      
      // Mobile-specific attributes
      if (this.isMobile) {
        this.inputElement.setAttribute('inputmode', this.inputMode)
        this.inputElement.setAttribute('enterkeyhint', 'go')
      }
      
      // Styling for invisible overlay
      const style = this.inputElement.style
      style.position = 'absolute'
      style.left = '-9999px'
      style.top = '-9999px'
      style.width = '1px'
      style.height = '1px'
      style.opacity = '0'
      style.pointerEvents = 'auto'
      style.zIndex = '1000'
      style.border = 'none'
      style.outline = 'none'
      style.background = 'transparent'
      
      // Touch behavior
      style.touchAction = 'manipulation'
      style.userSelect = 'text'
      
      // Add to DOM
      document.body.appendChild(this.inputElement)
      
      devLogger.input('InputOverlayManager: HTML overlay element created')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'createOverlayElement', error)
      throw error
    }
  }
  
  /**
   * Setup event listeners for input and system events
   * @private
   */
  setupEventListeners () {
    if (!this.inputElement || this.fallbackMode) {
      devLogger.warn('InputOverlayManager: No input element, skipping event setup')
      return
    }
    
    try {
      // Input element events
      this.inputElement.addEventListener('input', this.boundHandlers.input)
      this.inputElement.addEventListener('keydown', this.boundHandlers.keydown)
      this.inputElement.addEventListener('focus', this.boundHandlers.focus)
      this.inputElement.addEventListener('blur', this.boundHandlers.blur)
      
      // Touch events for mobile
      if (this.hasTouch) {
        this.inputElement.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: false })
        this.inputElement.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false })
        this.inputElement.addEventListener('touchend', this.boundHandlers.touchend, { passive: false })
      }
      
      // Window events
      window.addEventListener('resize', this.boundHandlers.resize)
      
      // Orientation events
      if (this.orientation.supported) {
        window.screen.orientation.addEventListener('change', this.boundHandlers.orientationChange)
      }
      
      devLogger.input('InputOverlayManager: Event listeners setup complete')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'setupEventListeners', error)
      devLogger.error('Failed to setup event listeners', error)
    }
  }
  
  /**
   * Setup virtual keyboard detection for mobile devices
   * @private
   */
  setupVirtualKeyboardDetection () {
    if (!this.isMobile) return
    
    try {
      if (this.deviceInfo.isIOS && window.visualViewport) {
        // iOS: Use Visual Viewport API
        window.visualViewport.addEventListener('resize', this.boundHandlers.visualViewportResize)
        devLogger.input('InputOverlayManager: iOS virtual keyboard detection enabled')
      } else {
        // Android/Fallback: Use window resize
        this.viewport.originalHeight = window.innerHeight
        devLogger.input('InputOverlayManager: Android virtual keyboard detection enabled')
      }
    } catch (error) {
      trackManagerError('InputOverlayManager', 'setupVirtualKeyboardDetection', error)
      devLogger.warn('Virtual keyboard detection setup failed', error)
    }
  }
  
  /**
   * Update overlay position to match Phaser input display
   */
  updateOverlayPosition () {
    if (!this.inputElement || !this.gameScene?.game?.canvas || this.fallbackMode) {
      return
    }
    
    try {
      const canvas = this.gameScene.game.canvas
      const canvasRect = canvas.getBoundingClientRect()
      
      // Get input bounds from UI manager or default to game scene input text
      let inputBounds
      if (this.uiManager?.getInputBounds) {
        inputBounds = this.uiManager.getInputBounds()
      } else if (this.gameScene.inputText) {
        const inputText = this.gameScene.inputText
        inputBounds = {
          x: inputText.x - (inputText.width || 100) / 2,
          y: inputText.y - (inputText.height || 20) / 2,
          width: inputText.width || 200,
          height: inputText.height || 40
        }
      } else {
        // Fallback to center of canvas
        inputBounds = {
          x: canvasRect.width / 2 - 100,
          y: canvasRect.height / 2 - 20,
          width: 200,
          height: 40
        }
      }
      
      // Calculate absolute position
      const left = canvasRect.left + inputBounds.x
      const top = canvasRect.top + inputBounds.y
      
      // Update overlay position and make it functional
      const style = this.inputElement.style
      style.left = Math.round(left) + 'px'
      style.top = Math.round(top) + 'px'
      style.width = Math.round(inputBounds.width) + 'px'
      style.height = Math.round(inputBounds.height) + 'px'
      style.opacity = '0' // Keep invisible but functional
      style.pointerEvents = 'auto' // Allow interaction
      
      devLogger.input('InputOverlayManager: Overlay position updated', {
        left, top, width: inputBounds.width, height: inputBounds.height
      })
    } catch (error) {
      trackManagerError('InputOverlayManager', 'updateOverlayPosition', error)
      devLogger.warn('Failed to update overlay position', error)
    }
  }
  
  /**
   * Enable auto-focus for input during gameplay
   */
  enableAutoFocus () {
    if (!this.inputElement || this.fallbackMode) {
      devLogger.warn('InputOverlayManager: Cannot enable auto-focus, no input element')
      return
    }
    
    try {
      this.autoFocusEnabled = true
      this.inputElement.focus()
      
      // Setup focus maintenance
      this.focusCheckInterval = setInterval(() => {
        this.checkFocus()
      }, 100)
      
      devLogger.input('InputOverlayManager: Auto-focus enabled')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'enableAutoFocus', error)
      devLogger.error('Failed to enable auto-focus', error)
    }
  }
  
  /**
   * Disable auto-focus
   */
  disableAutoFocus () {
    try {
      this.autoFocusEnabled = false
      
      if (this.focusCheckInterval) {
        clearInterval(this.focusCheckInterval)
        this.focusCheckInterval = null
      }
      
      if (this.inputElement) {
        this.inputElement.blur()
      }
      
      devLogger.input('InputOverlayManager: Auto-focus disabled')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'disableAutoFocus', error)
    }
  }
  
  /**
   * Check and maintain focus if auto-focus is enabled
   * @private
   */
  checkFocus () {
    if (!this.autoFocusEnabled || !this.inputElement) return
    
    try {
      if (document.activeElement !== this.inputElement) {
        this.inputElement.focus()
      }
    } catch (error) {
      // Silent fail for focus issues
    }
  }
  
  /**
   * Synchronize HTML input content with Phaser display
   */
  syncInputContent () {
    if (!this.inputElement || !this.gameScene) return
    
    try {
      const currentValue = this.inputElement.value
      
      // Update Phaser input display through game scene
      if (this.gameScene.handleKeyInput) {
        this.gameScene.handleKeyInput(currentValue)
      }
      
      if (this.gameScene.updateInputDisplay) {
        this.gameScene.updateInputDisplay()
      }
      
      devLogger.input('InputOverlayManager: Input content synced', { value: currentValue })
    } catch (error) {
      trackManagerError('InputOverlayManager', 'syncInputContent', error)
    }
  }
  
  /**
   * Set input mode for different keyboard types
   * @param {'text'|'numeric'|'search'|'email'|'url'} mode - Input mode
   */
  setInputMode (mode) {
    if (!this.inputElement) return
    
    try {
      this.inputMode = mode
      this.inputElement.setAttribute('inputmode', mode)
      
      // Set appropriate pattern for numeric mode
      if (mode === 'numeric') {
        this.inputElement.setAttribute('pattern', '[0-9]*')
      } else {
        this.inputElement.removeAttribute('pattern')
      }
      
      devLogger.input(`InputOverlayManager: Input mode set to ${mode}`)
    } catch (error) {
      trackManagerError('InputOverlayManager', 'setInputMode', error)
    }
  }
  
  /**
   * Clear the input content
   */
  clearInput () {
    if (!this.inputElement) return
    
    try {
      this.inputElement.value = ''
      this.syncInputContent()
      devLogger.input('InputOverlayManager: Input cleared')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'clearInput', error)
    }
  }
  
  /**
   * Get current input value
   * @returns {string} Current input value
   */
  getValue () {
    return this.inputElement?.value || ''
  }
  
  /**
   * Check if virtual keyboard is visible
   * @returns {boolean} Virtual keyboard visibility state
   */
  get isVirtualKeyboardVisible () {
    return this.virtualKeyboard.isVisible
  }
  
  /**
   * Set input value
   * @param {string} value - Value to set
   */
  setValue (value) {
    if (!this.inputElement) return
    
    try {
      this.inputElement.value = value.slice(0, this.maxLength)
      this.syncInputContent()
    } catch (error) {
      trackManagerError('InputOverlayManager', 'setValue', error)
    }
  }
  
  /**
   * Handle input events with debouncing
   * @private
   */
  handleInput (event) {
    try {
      const startTime = performance.now()
      
      // Apply length limit
      if (event.target.value.length > this.maxLength) {
        event.target.value = event.target.value.slice(0, this.maxLength)
      }
      
      // Debounced sync - preserve input value
      const currentValue = event.target.value
      clearTimeout(this.inputDebounce)
      this.inputDebounce = setTimeout(() => {
        if (this.gameScene.handleKeyInput) {
          this.gameScene.handleKeyInput(currentValue)
        }
        
        if (this.gameScene.updateInputDisplay) {
          this.gameScene.updateInputDisplay()
        }
        
        // Track performance
        this.performance.inputLatency = performance.now() - startTime
        this.performance.lastUpdateTime = performance.now()
      }, this.debounceDelay)
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleInput', error)
    }
  }
  
  /**
   * Handle keydown events
   * @private
   */
  handleKeyDown (event) {
    try {
      switch (event.key) {
        case 'Enter':
          event.preventDefault()
          this.gameScene.emit('input:submit')
          break
          
        case 'Escape':
          event.preventDefault()
          this.clearInput()
          this.gameScene.emit('input:clear')
          break
          
        case 'Tab':
          event.preventDefault() // Prevent tab navigation
          break
      }
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleKeyDown', error)
    }
  }
  
  /**
   * Handle focus events
   * @private
   */
  handleFocus () {
    try {
      this.isFocused = true
      this.gameScene.emit('input:focus')
      devLogger.input('InputOverlayManager: Input focused')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleFocus', error)
    }
  }
  
  /**
   * Handle blur events
   * @private
   */
  handleBlur () {
    try {
      this.isFocused = false
      this.gameScene.emit('input:blur')
      devLogger.input('InputOverlayManager: Input blurred')
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleBlur', error)
    }
  }
  
  /**
   * Handle touch start events
   * @private
   */
  handleTouchStart (event) {
    if (!this.hasTouch) return
    
    try {
      event.preventDefault()
      
      const touch = event.touches[0]
      this.touch.startX = touch.clientX
      this.touch.startY = touch.clientY
      this.touch.isTracking = true
      
      // Focus input on touch
      this.inputElement.focus()
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleTouchStart', error)
    }
  }
  
  /**
   * Handle touch move events
   * @private
   */
  handleTouchMove (event) {
    if (!this.hasTouch || !this.touch.isTracking) return
    
    try {
      event.preventDefault()
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleTouchMove', error)
    }
  }
  
  /**
   * Handle touch end events with swipe gesture detection
   * @private
   */
  handleTouchEnd (event) {
    if (!this.hasTouch || !this.touch.isTracking) return
    
    try {
      event.preventDefault()
      
      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - this.touch.startX
      const deltaY = touch.clientY - this.touch.startY
      
      // Detect horizontal swipe for clearing input
      if (Math.abs(deltaX) > this.touch.swipeThreshold && Math.abs(deltaY) < this.touch.swipeThreshold) {
        this.clearInput()
        this.gameScene.emit('input:clear')
        devLogger.input('InputOverlayManager: Swipe gesture detected, input cleared')
      }
      
      this.touch.isTracking = false
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleTouchEnd', error)
    }
  }
  
  /**
   * Handle window resize events
   * @private
   */
  handleResize () {
    try {
      this.updateOverlayPosition()
      
      // Android virtual keyboard detection
      if (this.deviceInfo.isAndroid) {
        const heightDifference = this.viewport.originalHeight - window.innerHeight
        const keyboardVisible = heightDifference > 150 // Threshold for keyboard detection
        
        if (keyboardVisible !== this.virtualKeyboard.isVisible) {
          this.handleVirtualKeyboard(keyboardVisible, heightDifference)
        }
      }
      
      this.viewport.currentHeight = window.innerHeight
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleResize', error)
    }
  }
  
  /**
   * Handle Visual Viewport resize for iOS
   * @private
   */
  handleVisualViewportResize () {
    if (!window.visualViewport) return
    
    try {
      const detectionStart = performance.now()
      const keyboardHeight = this.viewport.originalHeight - window.visualViewport.height
      const keyboardVisible = keyboardHeight > 150
      
      if (keyboardVisible !== this.virtualKeyboard.isVisible) {
        this.performance.keyboardDetectionTime = performance.now() - detectionStart
        this.handleVirtualKeyboard(keyboardVisible, keyboardHeight)
      }
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleVisualViewportResize', error)
    }
  }
  
  /**
   * Handle virtual keyboard show/hide
   * @private
   */
  handleVirtualKeyboard (isVisible, height = 0) {
    try {
      const wasVisible = this.virtualKeyboard.isVisible
      
      this.virtualKeyboard.isVisible = isVisible
      this.virtualKeyboard.height = isVisible ? height : 0
      
      if (isVisible && !wasVisible) {
        this.gameScene.emit('virtualKeyboard:show', {
          height: this.virtualKeyboard.height,
          availableHeight: window.visualViewport?.height || window.innerHeight
        })
        this.gameScene.emit('viewport:adjust', {
          keyboardHeight: this.virtualKeyboard.height,
          availableHeight: window.visualViewport?.height || window.innerHeight
        })
        devLogger.input('InputOverlayManager: Virtual keyboard shown', { height })
      } else if (!isVisible && wasVisible) {
        this.gameScene.emit('virtualKeyboard:hide')
        this.gameScene.emit('viewport:restore')
        devLogger.input('InputOverlayManager: Virtual keyboard hidden')
      }
      
      // Adjust overlay position if needed
      this.updateOverlayPosition()
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleVirtualKeyboard', error)
    }
  }
  
  /**
   * Handle orientation change events
   * @private
   */
  handleOrientationChange () {
    try {
      setTimeout(() => { // Delay to allow browser to update
        this.updateDeviceInfo()
        this.updateOverlayPosition()
        
        this.gameScene.emit('orientation:change', {
          type: this.orientation.current,
          isPortrait: this.orientation.isPortrait,
          isLandscape: this.orientation.isLandscape
        })
        
        devLogger.input('InputOverlayManager: Orientation changed', this.orientation)
      }, 100)
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'handleOrientationChange', error)
    }
  }
  
  /**
   * Detect device capabilities and type
   * @private
   * @returns {Object} Device information
   */
  detectDevice () {
    const ua = navigator.userAgent || ''
    const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
    
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && hasTouch)
    const isAndroid = /Android/.test(ua)
    const isTablet = /iPad/.test(ua) || (isAndroid && !/Mobile/.test(ua))
    const isMobile = isIOS || isAndroid || hasTouch
    
    return {
      isIOS,
      isAndroid,
      isTablet,
      isMobile,
      isDesktop: !isMobile,
      hasTouch,
      touchPoints: navigator.maxTouchPoints || 0,
      type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      userAgent: ua
    }
  }
  
  /**
   * Update device and orientation information
   * @private
   */
  updateDeviceInfo () {
    try {
      if (this.orientation.supported && window.screen.orientation) {
        const orientation = window.screen.orientation.type || window.screen.orientation
        this.orientation.current = orientation
        this.orientation.isPortrait = orientation.includes('portrait')
        this.orientation.isLandscape = orientation.includes('landscape')
      } else {
        // Fallback based on dimensions
        this.orientation.isPortrait = window.innerHeight > window.innerWidth
        this.orientation.isLandscape = !this.orientation.isPortrait
        this.orientation.current = this.orientation.isPortrait ? 'portrait-primary' : 'landscape-primary'
      }
    } catch (error) {
      trackManagerError('InputOverlayManager', 'updateDeviceInfo', error)
    }
  }
  
  /**
   * Detect safe area support
   * @private
   * @returns {boolean} Whether safe area is supported
   */
  detectSafeAreaSupport () {
    try {
      return window.CSS && window.CSS.supports && 
             window.CSS.supports('padding', 'env(safe-area-inset-top)')
    } catch {
      return false
    }
  }
  
  /**
   * Calculate safe area insets for notched devices
   * @private
   */
  calculateSafeAreaInsets () {
    if (!this.viewport.hasSafeArea) return
    
    try {
      const computedStyle = window.getComputedStyle(document.documentElement)
      
      this.viewport.safeAreaInsets = {
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0px', 10),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0px', 10),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0px', 10),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0px', 10)
      }
      
      devLogger.input('InputOverlayManager: Safe area insets calculated', this.viewport.safeAreaInsets)
    } catch (error) {
      trackManagerError('InputOverlayManager', 'calculateSafeAreaInsets', error)
    }
  }
  
  /**
   * Validate environment for proper functionality
   * @private
   * @returns {boolean} Whether environment is valid
   */
  validateEnvironment () {
    return !!(document && window && navigator)
  }
  
  /**
   * Measure input latency for performance monitoring
   */
  measureInputLatency () {
    if (this.performance.inputLatencyStart) {
      this.performance.inputLatency = performance.now() - this.performance.inputLatencyStart
      this.performance.inputLatencyStart = null
    } else {
      this.performance.inputLatencyStart = performance.now()
    }
  }
  
  /**
   * Handle detection errors with fallback
   * @private
   */
  handleDetectionError (error) {
    trackManagerError('InputOverlayManager', 'detection', error)
    this.fallbackMode = true
    
    this.gameScene.emit('detection:error', {
      error,
      fallbackMode: true
    })
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics () {
    return {
      ...this.performance,
      updateFrequency: this.performance.lastUpdateTime > 0 ? 1000 / (performance.now() - this.performance.lastUpdateTime) : 0,
      memoryUsage: this.getMemoryUsage()
    }
  }
  
  /**
   * Estimate memory usage
   * @private
   */
  getMemoryUsage () {
    try {
      return {
        eventListeners: Object.keys(this.boundHandlers).length,
        domElements: this.inputElement ? 1 : 0,
        intervals: this.focusCheckInterval ? 1 : 0
      }
    } catch {
      return { estimated: 'low' }
    }
  }
  
  /**
   * Throttle function calls
   * @private
   */
  throttle (func, delay) {
    let timeoutId
    let lastExecTime = 0
    
    return function (...args) {
      const currentTime = Date.now()
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args)
        lastExecTime = currentTime
      } else {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          func.apply(this, args)
          lastExecTime = Date.now()
        }, delay - (currentTime - lastExecTime))
      }
    }
  }
  
  /**
   * Clean up resources and event listeners
   */
  destroy () {
    try {
      // Clear intervals
      if (this.focusCheckInterval) {
        clearInterval(this.focusCheckInterval)
        this.focusCheckInterval = null
      }
      
      if (this.inputDebounce) {
        clearTimeout(this.inputDebounce)
        this.inputDebounce = null
      }
      
      // Remove event listeners
      if (this.inputElement) {
        Object.values(this.boundHandlers).forEach(handler => {
          this.inputElement.removeEventListener('input', handler)
          this.inputElement.removeEventListener('keydown', handler)
          this.inputElement.removeEventListener('focus', handler)
          this.inputElement.removeEventListener('blur', handler)
          this.inputElement.removeEventListener('touchstart', handler)
          this.inputElement.removeEventListener('touchmove', handler)
          this.inputElement.removeEventListener('touchend', handler)
        })
        
        // Remove from DOM
        if (document.body.contains(this.inputElement)) {
          document.body.removeChild(this.inputElement)
        }
        
        this.inputElement = null
      }
      
      // Remove window event listeners
      window.removeEventListener('resize', this.boundHandlers.resize)
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this.boundHandlers.visualViewportResize)
      }
      
      if (this.orientation.supported) {
        window.screen.orientation.removeEventListener('change', this.boundHandlers.orientationChange)
      }
      
      this.isInitialized = false
      this.autoFocusEnabled = false
      
      devLogger.input('InputOverlayManager destroyed')
      
    } catch (error) {
      trackManagerError('InputOverlayManager', 'destroy', error)
      devLogger.error('Failed to destroy InputOverlayManager', error)
    }
  }
}

export default InputOverlayManager