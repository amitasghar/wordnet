import Phaser from 'phaser'
import { devLogger } from '@/utils/devTools.js'
import { TimerManager } from '@/managers/TimerManager.js'
import { VisualFeedbackManager } from '@/managers/VisualFeedbackManager.js'

export class GameScene extends Phaser.Scene {
  constructor () {
    super({ key: 'GameScene' })
    
    // Game state
    this.currentCategory = null
    this.currentCategoryId = null
    this.score = 0
    this.wordsEntered = []
    this.isGameActive = false
    
    // Timer state - will be managed by TimerManager
    this.timerManager = null
    this.lastTimerUpdate = ''
    this.warningLevel = 'normal'
    
    // Visual feedback state - will be managed by VisualFeedbackManager
    this.visualFeedbackManager = null
  }
  
  create () {
    devLogger.scene('GameScene: Creating game scene')
    
    const { width, height } = this.cameras.main
    
    // Initialize TimerManager - get managers from global game instance
    if (window.gameInstance) {
      this.timerManager = new TimerManager(
        window.gameInstance.loopManager,
        window.gameInstance.stateManager
      )
    } else {
      // Fallback for testing
      this.timerManager = new TimerManager()
    }
    
    // Initialize VisualFeedbackManager
    this.visualFeedbackManager = new VisualFeedbackManager(this)
    
    // Initialize game components
    this.createBackground()
    this.createUI()
    this.createEnhancedTimerDisplay()
    this.createInputSystem()
    this.setupGameLogic()
    this.setupTimerEventListeners()
    
    // Initialize visual feedback system
    this.visualFeedbackManager.init()
    
    // Start the game
    this.startRound()
    
    // Register this scene with the scene manager
    this.events.emit('scene:ready', 'GameScene')
    
    devLogger.scene('GameScene: Game scene created successfully')
  }
  
  createBackground () {
    const { width, height } = this.cameras.main
    
    // Game background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)
    
    // Add subtle pattern
    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.Between(1, 3)
      const alpha = Phaser.Math.FloatBetween(0.05, 0.15)
      
      this.add.circle(x, y, size, 0x4f46e5, alpha)
    }
  }
  
  createUI () {
    const { width, height } = this.cameras.main
    
    // Header area
    this.createHeader()
    
    // Category display
    this.categoryText = this.add.text(width / 2, 150, 'Category: Loading...', {
      fontSize: '32px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Timer display will be created by createEnhancedTimerDisplay()
    
    // Score display
    this.scoreText = this.add.text(50, 50, '0', {
      fontSize: '48px',
      fill: '#10b981',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Score label
    this.add.text(50, 90, 'SCORE', {
      fontSize: '16px',
      fill: '#6b7280',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Words entered list
    this.createWordsPanel()
    
    // Game status text
    this.statusText = this.add.text(width / 2, height - 100, 'Type words that match the category!', {
      fontSize: '18px',
      fill: '#7c3aed',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
  }
  
  createHeader () {
    const { width } = this.cameras.main
    
    // Back button
    this.backButton = this.add.rectangle(50, 30, 80, 30, 0x6b7280)
    this.backButton.setInteractive({ useHandCursor: true })
    
    this.add.text(50, 30, 'Menu', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    this.backButton.on('pointerdown', () => {
      this.returnToMenu()
    })
    
    // Game title
    this.add.text(width / 2, 30, 'Category Challenge', {
      fontSize: '20px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
  }
  
  createWordsPanel () {
    const { width, height } = this.cameras.main
    
    // Words panel background
    this.wordsPanel = this.add.rectangle(width - 150, height / 2, 250, 300, 0x2d3748, 0.8)
    
    // Words panel title
    this.add.text(width - 150, height / 2 - 140, 'Words Found', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Words list (will be populated dynamically)
    this.wordsListText = this.add.text(width - 150, height / 2 - 100, '', {
      fontSize: '14px',
      fill: '#e2e8f0',
      fontFamily: 'Arial',
      align: 'left',
      wordWrap: { width: 220 }
    }).setOrigin(0.5, 0)
  }

  /**
   * Create enhanced timer display with progress indicator and improved visual feedback
   */
  createEnhancedTimerDisplay () {
    const { width, height } = this.cameras.main
    
    // Timer container position (top-right)
    const timerX = width - 80
    const timerY = 60
    
    // Timer text display
    this.timerText = this.add.text(timerX, timerY - 10, '01:30', {
      fontSize: '24px',
      fill: '#4ade80', // Green by default
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5)
    
    // Circular progress indicator
    this.timerProgress = this.add.graphics()
    
    // Timer background circle (static)
    this.timerBg = this.add.graphics()
    this.timerBg.lineStyle(4, 0x374151, 0.3)
    this.timerBg.strokeCircle(timerX, timerY - 10, 35)
    
    // Timer label
    this.timerLabel = this.add.text(timerX, timerY + 25, 'TIME', {
      fontSize: '12px',
      fill: '#9ca3af',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Initialize with current timer state
    this.updateTimerDisplay()
    
    devLogger.scene('Enhanced timer display created')
  }

  /**
   * Update timer display with current values and visual feedback
   */
  updateTimerDisplay () {
    if (!this.timerManager || !this.timerText || !this.timerProgress) return
    
    const formattedTime = this.timerManager.getFormattedTime()
    const progress = this.timerManager.getProgress()
    const timeRemaining = this.timerManager.timeRemaining
    
    // Only update if values have changed (performance optimization)
    if (formattedTime !== this.lastTimerUpdate) {
      this.timerText.setText(formattedTime)
      this.lastTimerUpdate = formattedTime
    }
    
    // Update progress circle
    this.updateProgressCircle(progress)
    
    // Update color based on time remaining
    this.updateTimerColors(timeRemaining, progress)
    
    // Handle critical time animations
    if (timeRemaining <= 10 && this.warningLevel !== 'critical') {
      this.triggerCriticalAnimation()
      this.warningLevel = 'critical'
    } else if (timeRemaining <= 30 && timeRemaining > 10 && this.warningLevel === 'normal') {
      this.warningLevel = 'warning'
    }
  }

  /**
   * Update the circular progress indicator
   */
  updateProgressCircle (progress) {
    const { width } = this.cameras.main
    const timerX = width - 80
    const timerY = 60 - 10
    const radius = 35
    
    this.timerProgress.clear()
    
    if (progress > 0) {
      // Calculate angle for progress (start at top, go clockwise)
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + (2 * Math.PI * (progress / 100))
      
      // Choose color based on progress
      let progressColor = 0x4ade80 // Green
      if (progress < 33) {
        progressColor = 0xef4444 // Red
      } else if (progress < 66) {
        progressColor = 0xf59e0b // Yellow
      }
      
      this.timerProgress.lineStyle(4, progressColor)
      this.timerProgress.beginPath()
      this.timerProgress.arc(timerX, timerY, radius, startAngle, endAngle)
      this.timerProgress.strokePath()
    }
  }

  /**
   * Update timer text colors based on time remaining
   */
  updateTimerColors (timeRemaining, progress) {
    let textColor = '#4ade80' // Green
    
    if (timeRemaining <= 10) {
      textColor = '#ef4444' // Red
    } else if (timeRemaining <= 30) {
      textColor = '#f59e0b' // Yellow
    }
    
    this.timerText.setColor(textColor)
  }

  /**
   * Trigger pulsing animation for critical time periods
   */
  triggerCriticalAnimation () {
    this.tweens.add({
      targets: [this.timerText, this.timerProgress],
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 300,
      ease: 'Power2',
      yoyo: true,
      repeat: 2
    })
  }

  /**
   * Setup event listeners for timer events
   */
  setupTimerEventListeners () {
    if (!this.timerManager) return
    
    // Listen for timer warnings
    this.timerManager.on = (event, callback) => {
      this.events.on(event, callback)
    }
    
    // Timer warning handler
    this.events.on('timer:warning', (data) => {
      this.showTimerWarning(data.warningLevel, data.timeRemaining)
    })
    
    // Timer critical handler
    this.events.on('timer:critical', (data) => {
      this.showTimerWarning('critical', data.timeRemaining)
    })
    
    // Timer expired handler  
    this.events.on('timer:expired', () => {
      this.endGame()
    })
    
    devLogger.scene('Timer event listeners setup complete')
  }

  /**
   * Show visual warning for timer alerts
   */
  showTimerWarning (level, timeRemaining) {
    // Flash the timer display
    this.tweens.add({
      targets: this.timerText,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: 1
    })
    
    devLogger.scene(`Timer warning: ${level} - ${timeRemaining}s remaining`)
  }
  
  createInputSystem () {
    const { width, height } = this.cameras.main
    
    // Get responsive dimensions - will be properly calculated once VisualFeedbackManager is initialized
    const inputWidth = Math.min(400, width * 0.8)
    const inputHeight = width <= 480 ? 50 : 60 // Smaller height on mobile
    
    // Input background with responsive sizing
    this.inputBg = this.add.rectangle(width / 2, height / 2 + 50, inputWidth, inputHeight, 0x374151)
    
    // Responsive font size
    const fontSize = width <= 480 ? '18px' : '20px'
    
    // Input placeholder text
    this.inputPlaceholder = this.add.text(width / 2, height / 2 + 50, 'Type your word here...', {
      fontSize: fontSize,
      fill: '#6b7280',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Current input text
    this.inputText = this.add.text(width / 2, height / 2 + 50, '', {
      fontSize: fontSize,
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Input cursor with responsive height
    const cursorHeight = width <= 480 ? 25 : 30
    this.inputCursor = this.add.rectangle(width / 2 + 10, height / 2 + 50, 2, cursorHeight, 0xffffff)
    this.inputCursor.setVisible(false)
    
    // Current word being typed
    this.currentInput = ''
  }
  
  setupGameLogic () {
    // Keyboard input handling
    this.input.keyboard.on('keydown', this.handleKeyInput, this)
    
    // Game timer for UI updates (TimerManager handles actual timing)
    this.gameTimer = this.time.addEvent({
      delay: 100, // Update UI more frequently for smooth animations
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    })
    
    // Input cursor blinking
    this.time.addEvent({
      delay: 500,
      callback: () => {
        if (this.isGameActive) {
          this.inputCursor.setVisible(!this.inputCursor.visible)
        }
      },
      loop: true
    })
  }
  
  startRound () {
    devLogger.scene('GameScene: Starting new round')
    
    // Reset game state
    this.score = 0
    this.wordsEntered = []
    this.isGameActive = true
    this.currentInput = ''
    this.warningLevel = 'normal'
    
    // Start the timer with 90 seconds
    if (this.timerManager) {
      this.timerManager.start(90)
    }
    
    // Get random category
    this.selectRandomCategory()
    
    // Update UI
    this.updateUI()
    this.inputCursor.setVisible(true)
    
    // Show start animation
    this.showStartAnimation()
  }
  
  selectRandomCategory () {
    // Get word data manager from global game instance
    const wordManager = window.gameInstance?.wordDataManager
    
    if (wordManager) {
      const category = wordManager.getRandomCategory()
      if (category) {
        this.currentCategory = category.name
        this.currentCategoryId = category.id
        devLogger.scene(`GameScene: Selected category: ${this.currentCategory} (${category.id})`)
        return
      }
    }
    
    // Fallback to hardcoded categories
    const categories = [
      'Animals', 'Foods', 'Countries', 'Colors',
      'Sports', 'Movies', 'Books', 'Science',
      'Nature', 'Technology'
    ]
    
    this.currentCategory = Phaser.Utils.Array.GetRandom(categories)
    this.currentCategoryId = this.currentCategory.toLowerCase()
    devLogger.scene(`GameScene: Selected fallback category: ${this.currentCategory}`)
  }
  
  showStartAnimation () {
    const { width, height } = this.cameras.main
    
    // Countdown animation
    const countdownText = this.add.text(width / 2, height / 2 - 50, '3', {
      fontSize: '72px',
      fill: '#f59e0b',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    let count = 3
    const countdownTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        count--
        if (count > 0) {
          countdownText.setText(count.toString())
        } else if (count === 0) {
          countdownText.setText('GO!')
        } else {
          countdownText.destroy()
          countdownTimer.remove()
        }
      },
      repeat: 3
    })
  }
  
  handleKeyInput (event) {
    if (!this.isGameActive) return
    
    const key = event.key
    
    if (key === 'Enter') {
      this.submitWord()
    } else if (key === 'Backspace') {
      this.currentInput = this.currentInput.slice(0, -1)
      this.updateInputDisplay()
    } else if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      // Check character limit before adding
      if (this.currentInput.length < (this.visualFeedbackManager?.max_length || 20)) {
        this.currentInput += key.toLowerCase()
        this.updateInputDisplay()
      }
    }
  }
  
  updateInputDisplay () {
    if (this.currentInput.length === 0) {
      this.inputText.setVisible(false)
      this.inputPlaceholder.setVisible(true)
      // Stop typing animation when no input
      this.visualFeedbackManager?.stop_typing_animation()
    } else {
      this.inputText.setText(this.currentInput)
      this.inputText.setVisible(true)
      this.inputPlaceholder.setVisible(false)
      // Start typing animation when input begins
      if (!this.visualFeedbackManager?.cursor_animation_active) {
        this.visualFeedbackManager?.start_typing_animation()
      }
    }
    
    // Update visual feedback manager with character count
    this.visualFeedbackManager?.update_character_count(this.currentInput)
    
    // Update cursor position
    const textWidth = this.inputText.width
    this.inputCursor.x = this.inputText.x + textWidth / 2 + 5
  }
  
  submitWord () {
    if (this.currentInput.length < 2) return
    
    const word = this.currentInput.toLowerCase().trim()
    
    // Check if word was already entered
    if (this.wordsEntered.includes(word)) {
      this.showFeedback('Already entered!', 0xef4444)
      this.currentInput = ''
      this.updateInputDisplay()
      return
    }
    
    // Validate word (simplified validation for now)
    if (this.validateWord(word)) {
      this.addWord(word)
      this.showFeedback('Good!', 0x10b981)
    } else {
      this.showFeedback('Try again!', 0xef4444)
    }
    
    this.currentInput = ''
    this.updateInputDisplay()
  }
  
  validateWord (word) {
    // Use word data manager if available
    const wordManager = window.gameInstance?.wordDataManager
    
    if (wordManager && this.currentCategoryId) {
      return wordManager.validateWord(word, this.currentCategoryId)
    }
    
    // Fallback validation - simplified word validation
    return word.length >= 2 && /^[a-z]+$/.test(word)
  }
  
  addWord (word) {
    this.wordsEntered.push(word)
    
    // Calculate score using word data manager if available
    const wordManager = window.gameInstance?.wordDataManager
    let points = 0
    
    if (wordManager && this.currentCategoryId) {
      points = wordManager.calculateWordScore(word, this.currentCategoryId)
    }
    
    // Fallback scoring based on word length
    if (points === 0) {
      points = Math.max(1, word.length - 2) * 10
    }
    
    this.score += points
    
    this.updateUI()
    
    devLogger.scene(`GameScene: Added word "${word}" for ${points} points`)
  }
  
  showFeedback (text, color) {
    // Use VisualFeedbackManager for enhanced feedback
    if (this.visualFeedbackManager) {
      if (color === 0x10b981) { // Green success color
        this.visualFeedbackManager.show_success_feedback(text)
      } else if (color === 0xef4444) { // Red error color  
        this.visualFeedbackManager.show_error_feedback(text)
      } else {
        // Fallback to old system for other colors
        const { width, height } = this.cameras.main
        
        const feedback = this.add.text(width / 2, height / 2 + 120, text, {
          fontSize: '18px',
          fill: Phaser.Display.Color.IntegerToColor(color).rgba,
          fontFamily: 'Arial'
        }).setOrigin(0.5)
        
        // Fade out animation
        this.tweens.add({
          targets: feedback,
          alpha: 0,
          y: feedback.y - 30,
          duration: 1500,
          onComplete: () => {
            feedback.destroy()
          }
        })
      }
    } else {
      // Fallback to original implementation
      const { width, height } = this.cameras.main
      
      const feedback = this.add.text(width / 2, height / 2 + 120, text, {
        fontSize: '18px',
        fill: Phaser.Display.Color.IntegerToColor(color).rgba,
        fontFamily: 'Arial'
      }).setOrigin(0.5)
      
      // Fade out animation
      this.tweens.add({
        targets: feedback,
        alpha: 0,
        y: feedback.y - 30,
        duration: 1500,
        onComplete: () => {
          feedback.destroy()
        }
      })
    }
  }
  
  updateTimer () {
    if (!this.isGameActive) return
    
    // Update the enhanced timer display
    this.updateTimerDisplay()
    
    // Update other UI elements
    this.updateUI()
  }
  
  updateUI () {
    // Update displays
    this.categoryText.setText(`Category: ${this.currentCategory}`)
    this.scoreText.setText(this.score.toString())
    
    // Update HTML HUD elements if available
    const scoreElement = document.getElementById('score-value')
    const timerElement = document.getElementById('timer-value')
    
    if (scoreElement) {
      scoreElement.textContent = this.score.toString()
    }
    
    if (timerElement && this.timerManager) {
      timerElement.textContent = this.timerManager.getFormattedTime()
    }
    
    // Update words list
    if (this.wordsEntered.length > 0) {
      const wordsDisplay = this.wordsEntered
        .slice(-10) // Show last 10 words
        .map(word => `• ${word}`)
        .join('\n')
      this.wordsListText.setText(wordsDisplay)
    } else {
      this.wordsListText.setText('No words yet...')
    }
  }
  
  endGame () {
    devLogger.scene('GameScene: Game ended')
    
    this.isGameActive = false
    this.inputCursor.setVisible(false)
    
    // Stop the timer
    if (this.timerManager) {
      this.timerManager.stop()
    }
    
    // Pause the old game timer if it exists
    if (this.gameTimer) {
      this.gameTimer.paused = true
    }
    
    // Show game over screen
    this.showGameOverScreen()
  }
  
  showGameOverScreen () {
    const { width, height } = this.cameras.main
    
    // Game over overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    
    // Game over text
    this.add.text(width / 2, height / 2 - 100, 'Time\'s Up!', {
      fontSize: '48px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Final score
    this.add.text(width / 2, height / 2 - 40, `Final Score: ${this.score}`, {
      fontSize: '32px',
      fill: '#10b981',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Words found
    this.add.text(width / 2, height / 2, `Words Found: ${this.wordsEntered.length}`, {
      fontSize: '24px',
      fill: '#7c3aed',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Play again button
    const playAgainButton = this.add.rectangle(width / 2 - 100, height / 2 + 80, 150, 50, 0x4f46e5)
    playAgainButton.setInteractive({ useHandCursor: true })
    
    this.add.text(width / 2 - 100, height / 2 + 80, 'Play Again', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Menu button
    const menuButton = this.add.rectangle(width / 2 + 100, height / 2 + 80, 150, 50, 0x6b7280)
    menuButton.setInteractive({ useHandCursor: true })
    
    this.add.text(width / 2 + 100, height / 2 + 80, 'Main Menu', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Button handlers
    playAgainButton.on('pointerdown', () => {
      this.scene.restart()
    })
    
    menuButton.on('pointerdown', () => {
      this.returnToMenu()
    })
  }
  
  returnToMenu () {
    devLogger.scene('GameScene: Returning to main menu')
    
    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MainMenuScene')
    })
  }
  
  update (time, deltaTime) {
    // Game loop update - integrate with VisualFeedbackManager for 60 FPS performance
    if (this.visualFeedbackManager) {
      this.visualFeedbackManager.update(deltaTime)
    }
    
    // Most other game logic is handled by events, but this is used for continuous updates
  }
  
  /**
   * Clean up scene resources
   */
  destroy () {
    // Cleanup visual feedback manager
    if (this.visualFeedbackManager) {
      this.visualFeedbackManager.destroy()
      this.visualFeedbackManager = null
    }
    
    // Cleanup timer manager
    if (this.timerManager) {
      this.timerManager.destroy?.()
      this.timerManager = null
    }
    
    devLogger.scene('GameScene destroyed')
  }
}