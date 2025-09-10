import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'

/**
 * VisualFeedbackManager - Enhanced visual feedback system for word input
 * 
 * Provides real-time character count display, typing animations, cursor state visualization,
 * smooth transition animations, and responsive input area sizing for optimal user experience.
 * 
 * Features:
 * - Real-time character count with color-coded length indicators
 * - Animated typing cursor with state visualization
 * - Input focus, validation, and submission progress feedback
 * - Smooth transition animations for success/error states
 * - Responsive input area sizing based on device screen dimensions
 * - Performance-optimized for 60 FPS Phaser integration
 * 
 * @class VisualFeedbackManager
 * @example
 * const feedbackManager = new VisualFeedbackManager(gameScene)
 * await feedbackManager.init()
 * feedbackManager.update_character_count('hello')
 */
export class VisualFeedbackManager {
  /**
   * Create a VisualFeedbackManager instance
   * @param {GameScene} gameScene - The Phaser GameScene instance
   */
  constructor (gameScene) {
    this.gameScene = gameScene
    
    // Core state
    this.isInitialized = false
    
    // Character count system
    this.character_count = 0
    this.max_length = 20
    this.character_count_text = null
    this.character_count_colors = {
      normal: 0x10b981,    // Green
      warning: 0xf59e0b,   // Orange (80% of max)
      error: 0xef4444      // Red (at max)
    }
    
    // Cursor animation system
    this.typing_cursor = null
    this.cursor_animation_active = false
    this.cursor_blink_rate = 500 // 500ms blink cycle
    this.cursor_tween = null
    this.cursor_states = {
      idle: 0x6b7280,      // Gray
      active: 0xffffff,    // White
      warning: 0xf59e0b,   // Orange
      error: 0xef4444      // Red
    }
    
    // Input state visualization
    this.input_state = 'idle' // 'idle', 'focused', 'typing', 'validating', 'submitting'
    this.validation_status = 'none' // 'none', 'valid', 'invalid', 'checking'
    this.input_bg_colors = {
      idle: 0x374151,      // Dark gray
      focused: 0x4f46e5,   // Blue
      typing: 0x6366f1,    // Light blue
      valid: 0x10b981,     // Green
      invalid: 0xef4444,   // Red
      checking: 0x6366f1   // Processing blue
    }
    
    // Feedback animation system
    this.feedback_text = null
    this.success_feedback_color = 0x10b981 // Green
    this.error_feedback_color = 0xef4444   // Red
    this.feedback_duration = 2000 // 2 seconds
    this.active_feedback_tween = null
    
    // Responsive sizing system
    this.responsive_dimensions = {
      mobile: { min_width: 280, max_width: 335, height: 50, padding: 20 },
      tablet: { min_width: 350, max_width: 600, height: 55, padding: 40 },
      desktop: { min_width: 400, max_width: 500, height: 60, padding: 60 }
    }
    this.current_device_type = 'desktop'
    this.current_dimensions = null
    
    // Performance tracking
    this.performance = {
      frame_time_budget: 16.67, // 60 FPS = 16.67ms per frame
      last_update_time: 0,
      frame_count: 0,
      throttled_updates: 0,
      active_animations: 0
    }
    
    // Animation performance tracking
    this.animation_performance = {
      frame_count: 0,
      total_frame_time: 0,
      average_frame_time: 0,
      dropped_frames: 0
    }
    
    devLogger.ui('VisualFeedbackManager created')
  }
  
  /**
   * Initialize the visual feedback system
   * @returns {Promise<boolean>} Success status
   */
  async init () {
    try {
      if (this.isInitialized) {
        devLogger.ui('VisualFeedbackManager already initialized')
        return true
      }
      
      if (!this.gameScene) {
        throw new Error('GameScene is required for VisualFeedbackManager')
      }
      
      this.detect_device_type()
      this.create_character_count_display()
      this.create_typing_cursor()
      this.create_feedback_text()
      this.setup_responsive_dimensions()
      this.setup_event_listeners()
      
      this.isInitialized = true
      devLogger.ui('VisualFeedbackManager initialized successfully', {
        device_type: this.current_device_type,
        max_length: this.max_length
      })
      
      return true
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'init', error)
      devLogger.error('VisualFeedbackManager initialization failed', error)
      return false
    }
  }
  
  /**
   * Create character count display element
   * @private
   */
  create_character_count_display () {
    if (!this.gameScene?.inputText) {
      devLogger.warn('VisualFeedbackManager: No inputText found, creating placeholder')
      return
    }
    
    try {
      const inputText = this.gameScene.inputText
      const x = inputText.x + 100 // Position to the right of input
      const y = inputText.y + 30  // Below the input text
      
      this.character_count_text = this.gameScene.add.text(x, y, '', {
        fontSize: '14px',
        fill: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'normal'
      }).setOrigin(0.5)
      
      // Set initial display
      this.character_count_text.setText('0/' + this.max_length)
      this.character_count_text.setTint(this.character_count_colors.normal) // Green by default
      this.character_count_text.setVisible(true)
      
      devLogger.ui('VisualFeedbackManager: Character count display created')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'create_character_count_display', error)
      devLogger.error('Failed to create character count display', error)
    }
  }
  
  /**
   * Create typing cursor element
   * @private
   */
  create_typing_cursor () {
    if (!this.gameScene?.inputText) {
      devLogger.warn('VisualFeedbackManager: No inputText found for cursor')
      return
    }
    
    try {
      const inputText = this.gameScene.inputText
      const x = inputText.x + 10 // Start position next to text
      const y = inputText.y
      
      this.typing_cursor = this.gameScene.add.rectangle(x, y, 2, 30, 0xffffff)
      this.typing_cursor.setVisible(false) // Hidden by default
      
      devLogger.ui('VisualFeedbackManager: Typing cursor created')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'create_typing_cursor', error)
      devLogger.error('Failed to create typing cursor', error)
    }
  }
  
  /**
   * Create feedback text element for success/error messages
   * @private
   */
  create_feedback_text () {
    if (!this.gameScene) return
    
    try {
      const { width, height } = this.gameScene.cameras.main
      
      this.feedback_text = this.gameScene.add.text(width / 2, height / 2 - 100, '', {
        fontSize: '24px',
        fill: '#10b981',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5)
      
      this.feedback_text.setVisible(false)
      
      devLogger.ui('VisualFeedbackManager: Feedback text created')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'create_feedback_text', error)
    }
  }
  
  /**
   * Detect device type for responsive sizing
   * @private
   */
  detect_device_type () {
    try {
      const { width, height } = this.gameScene.cameras.main
      
      if (width <= 480) {
        this.current_device_type = 'mobile'
      } else if (width <= 1024) {
        this.current_device_type = 'tablet'
      } else {
        this.current_device_type = 'desktop'
      }
      
      devLogger.ui(`VisualFeedbackManager: Device type detected as ${this.current_device_type}`, {
        screen_width: width,
        screen_height: height
      })
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'detect_device_type', error)
      this.current_device_type = 'desktop' // Fallback
    }
  }
  
  /**
   * Setup responsive dimensions based on device type
   * @private
   */
  setup_responsive_dimensions () {
    try {
      this.current_dimensions = this.get_responsive_input_dimensions()
      
      devLogger.ui('VisualFeedbackManager: Responsive dimensions set', this.current_dimensions)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'setup_responsive_dimensions', error)
    }
  }
  
  /**
   * Setup event listeners for responsive updates
   * @private
   */
  setup_event_listeners () {
    if (!this.gameScene?.events) return
    
    try {
      // Listen for orientation change events
      this.gameScene.events.on('orientation:change', this.handle_orientation_change.bind(this))
      this.gameScene.events.on('viewport:adjust', this.handle_viewport_adjust.bind(this))
      
      devLogger.ui('VisualFeedbackManager: Event listeners setup')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'setup_event_listeners', error)
    }
  }
  
  /**
   * Update character count and display
   * @param {string} text - Current input text
   */
  update_character_count (text = '') {
    try {
      // Cap the character count at max_length
      this.character_count = Math.min(text.length, this.max_length)
      
      if (!this.character_count_text) return
      
      // Update display text
      this.character_count_text.setText(`${this.character_count}/${this.max_length}`)
      
      // Update color based on character count
      const warning_threshold = Math.floor(this.max_length * 0.8) // 80% of max
      
      if (this.character_count >= this.max_length) {
        this.character_count_text.setTint(this.character_count_colors.error)
      } else if (this.character_count >= warning_threshold) {
        this.character_count_text.setTint(this.character_count_colors.warning)
      } else {
        this.character_count_text.setTint(this.character_count_colors.normal)
      }
      
      // Update cursor position
      this.update_cursor_position()
      
      // Track performance
      this.performance.throttled_updates++
      
      devLogger.ui(`VisualFeedbackManager: Character count updated to ${this.character_count}`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'update_character_count', error)
    }
  }
  
  /**
   * Set maximum character length
   * @param {number} max_length - Maximum allowed characters
   */
  set_max_length (max_length) {
    try {
      this.max_length = Math.max(1, max_length) // Minimum 1 character
      
      if (this.character_count_text) {
        this.character_count_text.setText(`${this.character_count}/${this.max_length}`)
      }
      
      devLogger.ui(`VisualFeedbackManager: Max length set to ${this.max_length}`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'set_max_length', error)
    }
  }
  
  /**
   * Start typing cursor animation
   */
  start_typing_animation () {
    if (!this.typing_cursor || this.cursor_animation_active) return
    
    try {
      this.cursor_animation_active = true
      this.typing_cursor.setVisible(true)
      this.performance.active_animations++
      
      // Create blinking animation
      this.cursor_tween = this.gameScene.tweens.add({
        targets: this.typing_cursor,
        alpha: 0,
        duration: this.cursor_blink_rate / 2,
        yoyo: true,
        repeat: -1, // Infinite repeat
        ease: 'Power2'
      })
      
      devLogger.ui('VisualFeedbackManager: Typing animation started')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'start_typing_animation', error)
    }
  }
  
  /**
   * Stop typing cursor animation
   */
  stop_typing_animation () {
    if (!this.cursor_animation_active) return
    
    try {
      this.cursor_animation_active = false
      
      if (this.cursor_tween) {
        this.gameScene.tweens.killTweensOf(this.typing_cursor)
        this.cursor_tween = null
      }
      
      this.typing_cursor?.setVisible(false)
      this.performance.active_animations = Math.max(0, this.performance.active_animations - 1)
      
      devLogger.ui('VisualFeedbackManager: Typing animation stopped')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'stop_typing_animation', error)
    }
  }
  
  /**
   * Update cursor position based on text width
   */
  update_cursor_position () {
    if (!this.typing_cursor || !this.gameScene?.inputText) return
    
    try {
      const inputText = this.gameScene.inputText
      const textWidth = inputText.width || 0
      
      // Position cursor at the end of text
      this.typing_cursor.x = inputText.x + (textWidth / 2) + 5
      
      devLogger.ui('VisualFeedbackManager: Cursor position updated')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'update_cursor_position', error)
    }
  }
  
  /**
   * Set cursor visual state
   * @param {'idle'|'active'|'warning'|'error'} state - Cursor state
   */
  set_cursor_state (state) {
    if (!this.typing_cursor || !this.cursor_states[state]) return
    
    try {
      this.typing_cursor.setTint(this.cursor_states[state])
      
      devLogger.ui(`VisualFeedbackManager: Cursor state set to ${state}`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'set_cursor_state', error)
    }
  }
  
  /**
   * Set input visual state
   * @param {'idle'|'focused'|'typing'|'validating'|'submitting'} state - Input state
   */
  set_input_state (state) {
    if (!this.input_bg_colors[state]) return
    
    try {
      this.input_state = state
      
      // Update input background if available
      if (this.gameScene.inputBg) {
        this.animate_background_color(this.input_bg_colors[state], 200)
      }
      
      devLogger.ui(`VisualFeedbackManager: Input state set to ${state}`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'set_input_state', error)
    }
  }
  
  /**
   * Set validation status with visual feedback
   * @param {'none'|'valid'|'invalid'|'checking'} status - Validation status
   */
  set_validation_status (status) {
    if (!this.input_bg_colors[status] && status !== 'none') return
    
    try {
      this.validation_status = status
      
      if (this.gameScene.inputBg) {
        const color = status === 'none' ? this.input_bg_colors.idle : this.input_bg_colors[status]
        this.animate_background_color(color, 150)
      }
      
      devLogger.ui(`VisualFeedbackManager: Validation status set to ${status}`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'set_validation_status', error)
    }
  }
  
  /**
   * Show submission progress with visual indicator
   * @param {number} progress - Progress from 0.0 to 1.0
   */
  show_submission_progress (progress) {
    if (!this.gameScene.inputBg) return
    
    try {
      const alpha = 0.5 + (progress * 0.5) // 0.5 to 1.0 alpha range
      
      this.gameScene.inputBg.setTint(this.input_bg_colors.checking)
      this.gameScene.inputBg.setAlpha(alpha)
      
      // Create progress animation
      this.gameScene.tweens.add({
        targets: this.gameScene.inputBg,
        scaleX: 1 + (progress * 0.02), // Slight scale animation
        scaleY: 1 + (progress * 0.02),
        duration: 100,
        ease: 'Power2'
      })
      
      devLogger.ui(`VisualFeedbackManager: Submission progress ${Math.round(progress * 100)}%`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'show_submission_progress', error)
    }
  }
  
  /**
   * Show success feedback with animation
   * @param {string} message - Success message
   */
  show_success_feedback (message) {
    this.show_feedback_message(message, this.success_feedback_color)
  }
  
  /**
   * Show error feedback with animation
   * @param {string} message - Error message
   */
  show_error_feedback (message) {
    this.show_feedback_message(message, this.error_feedback_color)
  }
  
  /**
   * Show feedback message with color and animation
   * @param {string} message - Message to display
   * @param {number} color - Message color
   * @private
   */
  show_feedback_message (message, color) {
    if (!this.feedback_text) return
    
    try {
      // Cancel any existing feedback animation
      if (this.active_feedback_tween) {
        this.gameScene.tweens.killTweensOf(this.feedback_text)
        this.active_feedback_tween = null
      }
      
      // Setup message
      this.feedback_text.setText(message)
      this.feedback_text.setTint(color)
      this.feedback_text.setVisible(true)
      this.feedback_text.setAlpha(0)
      
      // Animate in and out
      this.active_feedback_tween = this.gameScene.tweens.add({
        targets: this.feedback_text,
        alpha: 1,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          // Fade out after duration
          this.gameScene.tweens.add({
            targets: this.feedback_text,
            alpha: 0,
            duration: 500,
            delay: this.feedback_duration - 800, // Show for most of the duration
            ease: 'Power2',
            onComplete: () => {
              this.feedback_text.setVisible(false)
              this.active_feedback_tween = null
            }
          })
        }
      })
      
      this.performance.active_animations++
      
      devLogger.ui(`VisualFeedbackManager: Showing feedback "${message}"`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'show_feedback_message', error)
    }
  }
  
  /**
   * Animate background color change
   * @param {number} color - Target color
   * @param {number} duration - Animation duration in ms
   */
  animate_background_color (color, duration = 300) {
    if (!this.gameScene.inputBg) return
    
    try {
      // Cancel existing background animations
      this.gameScene.tweens.killTweensOf(this.gameScene.inputBg)
      
      // Animate color change
      this.gameScene.tweens.add({
        targets: this.gameScene.inputBg,
        duration: duration,
        ease: 'Power2',
        onUpdate: () => {
          this.gameScene.inputBg.setTint(color)
        }
      })
      
      devLogger.ui(`VisualFeedbackManager: Background color animated`)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'animate_background_color', error)
    }
  }
  
  /**
   * Get responsive input dimensions based on device type
   * @returns {Object} Dimensions object with width and height
   */
  get_responsive_input_dimensions () {
    try {
      const { width, height } = this.gameScene.cameras.main
      const deviceConfig = this.responsive_dimensions[this.current_device_type]
      
      let calculatedWidth
      let calculatedHeight = deviceConfig.height
      
      // Calculate width based on screen size and device type
      switch (this.current_device_type) {
        case 'mobile':
          calculatedWidth = Math.min(width - deviceConfig.padding, deviceConfig.max_width)
          calculatedWidth = Math.max(calculatedWidth, deviceConfig.min_width)
          // Ensure minimum touch target size
          calculatedHeight = Math.max(calculatedHeight, 44)
          break
          
        case 'tablet':
          calculatedWidth = Math.min(width * 0.6, deviceConfig.max_width)
          calculatedWidth = Math.max(calculatedWidth, deviceConfig.min_width)
          break
          
        case 'desktop':
        default:
          calculatedWidth = Math.min(width * 0.4, deviceConfig.max_width)
          calculatedWidth = Math.max(calculatedWidth, deviceConfig.min_width)
          break
      }
      
      return {
        width: Math.round(calculatedWidth),
        height: Math.round(calculatedHeight),
        padding: deviceConfig.padding
      }
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'get_responsive_input_dimensions', error)
      return { width: 400, height: 60, padding: 20 } // Fallback
    }
  }
  
  /**
   * Handle orientation change event
   */
  handle_orientation_change () {
    try {
      this.detect_device_type()
      this.setup_responsive_dimensions()
      
      devLogger.ui('VisualFeedbackManager: Orientation change handled')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'handle_orientation_change', error)
    }
  }
  
  /**
   * Handle viewport adjustment (keyboard show/hide)
   * @param {Object} data - Viewport data
   */
  handle_viewport_adjust (data) {
    try {
      // Adjust positioning for virtual keyboard
      if (data.keyboardHeight > 0 && this.character_count_text) {
        const adjustment = Math.min(data.keyboardHeight * 0.3, 50)
        this.character_count_text.y -= adjustment
      }
      
      devLogger.ui('VisualFeedbackManager: Viewport adjustment handled', data)
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'handle_viewport_adjust', error)
    }
  }
  
  /**
   * Update performance tracking (called from game loop)
   * @param {number} deltaTime - Frame delta time in ms
   */
  update (deltaTime) {
    try {
      this.performance.last_update_time = performance.now()
      this.performance.frame_count++
      
      // Track animation performance
      if (this.cursor_animation_active) {
        this.animation_performance.frame_count++
        this.animation_performance.total_frame_time += deltaTime
        this.animation_performance.average_frame_time = 
          this.animation_performance.total_frame_time / this.animation_performance.frame_count
        
        // Check for dropped frames
        if (deltaTime > this.performance.frame_time_budget * 1.5) {
          this.animation_performance.dropped_frames++
        }
      }
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'update', error)
    }
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  get_performance_metrics () {
    try {
      return {
        active_animations: this.performance.active_animations,
        frame_count: this.performance.frame_count,
        throttled_updates: this.performance.throttled_updates,
        average_frame_time: this.animation_performance.average_frame_time,
        dropped_frames: this.animation_performance.dropped_frames,
        cursor_animation_active: this.cursor_animation_active
      }
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'get_performance_metrics', error)
      return {}
    }
  }
  
  /**
   * Clean up resources and animations
   */
  destroy () {
    try {
      // Stop animations
      this.stop_typing_animation()
      
      if (this.active_feedback_tween) {
        this.gameScene.tweens.killTweensOf(this.feedback_text)
        this.active_feedback_tween = null
      }
      
      // Clean up event listeners
      if (this.gameScene?.events) {
        this.gameScene.events.off('orientation:change', this.handle_orientation_change.bind(this))
        this.gameScene.events.off('viewport:adjust', this.handle_viewport_adjust.bind(this))
      }
      
      // Destroy Phaser objects
      this.character_count_text?.destroy()
      this.typing_cursor?.destroy()
      this.feedback_text?.destroy()
      
      // Reset state
      this.isInitialized = false
      this.cursor_animation_active = false
      this.performance.active_animations = 0
      
      devLogger.ui('VisualFeedbackManager destroyed')
    } catch (error) {
      trackManagerError('VisualFeedbackManager', 'destroy', error)
    }
  }
}

export default VisualFeedbackManager