import { devLogger } from '@/utils/devTools.js'

// UI component types
export const UI_TYPES = {
  OVERLAY: 'overlay',
  NOTIFICATION: 'notification',
  MODAL: 'modal',
  TOOLTIP: 'tooltip',
  HUD: 'hud'
}

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

export class UIManager {
  constructor (game) {
    this.game = game
    this.overlays = new Map()
    this.notifications = new Map()
    this.modals = new Map()
    this.activeComponents = new Set()
    
    // UI containers
    this.uiContainer = null
    this.overlayContainer = null
    this.notificationContainer = null
    
    // Animation settings
    this.animationDuration = 300
    this.notificationTimeout = 3000
    
    this.init()
  }
  
  init () {
    this.setupUIContainers()
    this.setupEventListeners()
    
    devLogger.game('UIManager: Initialized')
  }
  
  setupUIContainers () {
    // Get or create main UI container
    this.uiContainer = document.getElementById('ui-container')
    if (!this.uiContainer) {
      this.uiContainer = this.createElement('div', {
        id: 'ui-container',
        className: 'fixed top-0 left-0 w-full h-full pointer-events-none z-10'
      })
      document.body.appendChild(this.uiContainer)
    }
    
    // Create overlay container
    this.overlayContainer = this.createElement('div', {
      id: 'overlay-container',
      className: 'absolute top-0 left-0 w-full h-full pointer-events-none'
    })
    this.uiContainer.appendChild(this.overlayContainer)
    
    // Create notification container
    this.notificationContainer = this.createElement('div', {
      id: 'notification-container',
      className: 'absolute top-4 right-4 z-50 pointer-events-none'
    })
    this.uiContainer.appendChild(this.notificationContainer)
    
    devLogger.game('UIManager: UI containers created')
  }
  
  setupEventListeners () {
    // Listen for game events
    if (this.game && this.game.events) {
      this.game.events.on('game:pause', this.onGamePause.bind(this))
      this.game.events.on('game:resume', this.onGameResume.bind(this))
      this.game.events.on('game:over', this.onGameOver.bind(this))
    }
    
    // Listen for global UI events
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
    
    // Listen for window resize for responsive behavior
    window.addEventListener('resize', this.handleWindowResize.bind(this))
  }
  
  // Utility function to create elements
  createElement (tag, options = {}) {
    const element = document.createElement(tag)
    
    if (options.id) element.id = options.id
    if (options.className) element.className = options.className
    if (options.innerHTML) element.innerHTML = options.innerHTML
    if (options.textContent) element.textContent = options.textContent
    
    if (options.styles) {
      Object.assign(element.style, options.styles)
    }
    
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value)
      })
    }
    
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => {
        element.addEventListener(event, handler)
      })
    }
    
    return element
  }
  
  // Create overlay UI components
  createOverlay (id, content, options = {}) {
    if (this.overlays.has(id)) {
      devLogger.game(`UIManager: Overlay "${id}" already exists`)
      return this.overlays.get(id)
    }
    
    const {
      className = '',
      closable = true,
      modal = false,
      zIndex = 100
    } = options
    
    const overlay = this.createElement('div', {
      id: `overlay-${id}`,
      className: `absolute inset-0 pointer-events-auto ${className}`,
      innerHTML: content,
      styles: {
        zIndex: zIndex.toString()
      }
    })
    
    // Add modal background if specified
    if (modal) {
      overlay.className += ' bg-black bg-opacity-50 flex items-center justify-center'
    }
    
    // Add close functionality
    if (closable) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideOverlay(id)
        }
      })
    }
    
    // Store overlay reference
    this.overlays.set(id, {
      element: overlay,
      options,
      visible: false
    })
    
    this.overlayContainer.appendChild(overlay)
    this.activeComponents.add(id)
    
    // Hide initially
    overlay.style.display = 'none'
    
    devLogger.game(`UIManager: Created overlay "${id}"`)
    return overlay
  }
  
  // Show overlay with animation
  showOverlay (id, animationType = 'fade') {
    const overlayData = this.overlays.get(id)
    if (!overlayData) {
      console.error(`UIManager: Overlay "${id}" not found`)
      return false
    }
    
    const { element } = overlayData
    
    // Show element
    element.style.display = 'block'
    overlayData.visible = true
    
    // Apply animation
    this.animateIn(element, animationType)
    
    devLogger.game(`UIManager: Showing overlay "${id}"`)
    return true
  }
  
  // Hide overlay with animation
  hideOverlay (id, animationType = 'fade') {
    const overlayData = this.overlays.get(id)
    if (!overlayData || !overlayData.visible) {
      return false
    }
    
    const { element } = overlayData
    
    // Apply animation
    this.animateOut(element, animationType, () => {
      element.style.display = 'none'
      overlayData.visible = false
    })
    
    devLogger.game(`UIManager: Hiding overlay "${id}"`)
    return true
  }
  
  // Create notification
  showNotification (message, type = NOTIFICATION_TYPES.INFO, duration = null) {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const timeout = duration || this.notificationTimeout
    
    const typeStyles = {
      [NOTIFICATION_TYPES.SUCCESS]: 'bg-green-500 text-white',
      [NOTIFICATION_TYPES.ERROR]: 'bg-red-500 text-white',
      [NOTIFICATION_TYPES.WARNING]: 'bg-yellow-500 text-black',
      [NOTIFICATION_TYPES.INFO]: 'bg-blue-500 text-white'
    }
    
    const notification = this.createElement('div', {
      id,
      className: `pointer-events-auto px-4 py-3 rounded-lg shadow-lg mb-2 transform transition-all duration-300 ${typeStyles[type] || typeStyles[NOTIFICATION_TYPES.INFO]}`,
      innerHTML: `
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">${message}</span>
          <button class="ml-3 text-lg font-bold opacity-70 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      `,
      styles: {
        transform: 'translateX(100%)',
        opacity: '0'
      }
    })
    
    // Store notification reference
    this.notifications.set(id, {
      element: notification,
      timeout: null,
      type
    })
    
    this.notificationContainer.appendChild(notification)
    this.activeComponents.add(id)
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)'
      notification.style.opacity = '1'
    })
    
    // Auto-remove after timeout
    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        this.hideNotification(id)
      }, timeout)
      
      this.notifications.get(id).timeout = timeoutId
    }
    
    devLogger.game(`UIManager: Showing ${type} notification: "${message}"`)
    return notification
  }
  
  // Hide notification
  hideNotification (id) {
    const notificationData = this.notifications.get(id)
    if (!notificationData) return false
    
    const { element, timeout } = notificationData
    
    // Clear timeout if exists
    if (timeout) {
      clearTimeout(timeout)
    }
    
    // Animate out
    element.style.transform = 'translateX(100%)'
    element.style.opacity = '0'
    
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element)
      }
      this.notifications.delete(id)
      this.activeComponents.delete(id)
    }, this.animationDuration)
    
    return true
  }
  
  // Create modal dialog
  createModal (id, title, content, options = {}) {
    const {
      closable = true,
      width = '400px',
      height = 'auto'
    } = options
    
    const modalHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-lg mx-auto" style="width: ${width}; height: ${height};">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
          ${closable ? '<button class="text-gray-400 hover:text-gray-600 text-2xl font-bold" onclick="window.uiManager?.hideModal(\'' + id + '\')">&times;</button>' : ''}
        </div>
        <div class="p-4">
          ${content}
        </div>
      </div>
    `
    
    const modal = this.createOverlay(id, modalHTML, {
      className: 'flex items-center justify-center p-4',
      modal: true,
      closable,
      zIndex: 200
    })
    
    this.modals.set(id, { element: modal, options })
    
    devLogger.game(`UIManager: Created modal "${id}"`)
    return modal
  }
  
  // Show modal
  showModal (id) {
    return this.showOverlay(id, 'scale')
  }
  
  // Hide modal
  hideModal (id) {
    const result = this.hideOverlay(id, 'scale')
    if (result) {
      this.modals.delete(id)
    }
    return result
  }
  
  // Animation functions
  animateIn (element, type) {
    switch (type) {
      case 'fade':
        element.style.opacity = '0'
        requestAnimationFrame(() => {
          element.style.transition = `opacity ${this.animationDuration}ms ease-in-out`
          element.style.opacity = '1'
        })
        break
        
      case 'scale':
        element.style.transform = 'scale(0.8)'
        element.style.opacity = '0'
        requestAnimationFrame(() => {
          element.style.transition = `transform ${this.animationDuration}ms ease-in-out, opacity ${this.animationDuration}ms ease-in-out`
          element.style.transform = 'scale(1)'
          element.style.opacity = '1'
        })
        break
        
      case 'slide':
        element.style.transform = 'translateY(-20px)'
        element.style.opacity = '0'
        requestAnimationFrame(() => {
          element.style.transition = `transform ${this.animationDuration}ms ease-in-out, opacity ${this.animationDuration}ms ease-in-out`
          element.style.transform = 'translateY(0)'
          element.style.opacity = '1'
        })
        break
    }
  }
  
  animateOut (element, type, callback) {
    switch (type) {
      case 'fade':
        element.style.transition = `opacity ${this.animationDuration}ms ease-in-out`
        element.style.opacity = '0'
        break
        
      case 'scale':
        element.style.transition = `transform ${this.animationDuration}ms ease-in-out, opacity ${this.animationDuration}ms ease-in-out`
        element.style.transform = 'scale(0.8)'
        element.style.opacity = '0'
        break
        
      case 'slide':
        element.style.transition = `transform ${this.animationDuration}ms ease-in-out, opacity ${this.animationDuration}ms ease-in-out`
        element.style.transform = 'translateY(-20px)'
        element.style.opacity = '0'
        break
    }
    
    setTimeout(callback, this.animationDuration)
  }
  
  // Event handlers
  handleKeyDown (event) {
    // ESC key to close topmost modal
    if (event.key === 'Escape') {
      const visibleModals = Array.from(this.modals.entries())
        .filter(([id, data]) => this.overlays.get(id)?.visible)
        .sort((a, b) => b[1].options.zIndex - a[1].options.zIndex)
      
      if (visibleModals.length > 0) {
        const [topModalId] = visibleModals[0]
        this.hideModal(topModalId)
        event.preventDefault()
      }
    }
  }
  
  handleWindowResize () {
    // Trigger responsive updates for overlays
    this.overlays.forEach((overlayData, id) => {
      if (overlayData.visible) {
        // Re-center modals or adjust layouts as needed
        this.updateOverlayLayout(id)
      }
    })
  }
  
  updateOverlayLayout (id) {
    const overlayData = this.overlays.get(id)
    if (!overlayData) return
    
    // Responsive adjustments can be implemented here
    // For now, just log the resize event
    devLogger.game(`UIManager: Updating layout for overlay "${id}"`)
  }
  
  // Game event handlers
  onGamePause () {
    devLogger.game('UIManager: Game paused')
    this.showNotification('Game Paused', NOTIFICATION_TYPES.INFO, 2000)
  }
  
  onGameResume () {
    devLogger.game('UIManager: Game resumed')
  }
  
  onGameOver (data) {
    devLogger.game('UIManager: Game over', data)
    
    const score = data?.score || 0
    const modalContent = `
      <div class="text-center">
        <div class="text-6xl mb-4">🎮</div>
        <h2 class="text-2xl font-bold mb-2">Game Over!</h2>
        <p class="text-lg text-gray-600 mb-4">Final Score: <span class="font-bold text-blue-600">${score}</span></p>
        <div class="flex gap-2 justify-center">
          <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded" onclick="window.location.reload()">
            Play Again
          </button>
          <button class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded" onclick="window.uiManager?.hideModal('game-over')">
            Close
          </button>
        </div>
      </div>
    `
    
    this.createModal('game-over', 'Game Over', modalContent, { closable: true })
    this.showModal('game-over')
  }
  
  // Utility methods
  clearAllNotifications () {
    this.notifications.forEach((data, id) => {
      this.hideNotification(id)
    })
  }
  
  clearAllOverlays () {
    this.overlays.forEach((data, id) => {
      this.hideOverlay(id)
    })
  }
  
  // Get component status
  isOverlayVisible (id) {
    return this.overlays.get(id)?.visible || false
  }
  
  getActiveComponents () {
    return Array.from(this.activeComponents)
  }
  
  // Clean up
  destroy () {
    // Clear all timeouts
    this.notifications.forEach((data) => {
      if (data.timeout) {
        clearTimeout(data.timeout)
      }
    })
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this))
    window.removeEventListener('resize', this.handleWindowResize.bind(this))
    
    // Clear all UI components
    this.clearAllNotifications()
    this.clearAllOverlays()
    
    // Remove containers
    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer)
    }
    
    // Clear data structures
    this.overlays.clear()
    this.notifications.clear()
    this.modals.clear()
    this.activeComponents.clear()
    
    devLogger.game('UIManager: Destroyed')
  }
  
  // Debug information
  getDebugInfo () {
    return {
      overlays: this.overlays.size,
      notifications: this.notifications.size,
      modals: this.modals.size,
      activeComponents: this.activeComponents.size,
      visibleOverlays: Array.from(this.overlays.entries())
        .filter(([id, data]) => data.visible)
        .map(([id]) => id)
    }
  }
}