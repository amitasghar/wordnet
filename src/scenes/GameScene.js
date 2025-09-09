import Phaser from 'phaser'
import { devLogger } from '@/utils/devTools.js'

export class GameScene extends Phaser.Scene {
  constructor () {
    super({ key: 'GameScene' })
    
    // Game state
    this.currentCategory = null
    this.currentCategoryId = null
    this.timeRemaining = 90
    this.score = 0
    this.wordsEntered = []
    this.isGameActive = false
  }
  
  create () {
    devLogger.scene('GameScene: Creating game scene')
    
    const { width, height } = this.cameras.main
    
    // Initialize game components
    this.createBackground()
    this.createUI()
    this.createInputSystem()
    this.setupGameLogic()
    
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
    
    // Timer display
    this.timerText = this.add.text(width - 50, 50, '90', {
      fontSize: '48px',
      fill: '#f59e0b',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Timer label
    this.add.text(width - 50, 90, 'TIME', {
      fontSize: '16px',
      fill: '#6b7280',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
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
  
  createInputSystem () {
    const { width, height } = this.cameras.main
    
    // Input background
    this.inputBg = this.add.rectangle(width / 2, height / 2 + 50, 400, 60, 0x374151)
    
    // Input placeholder text
    this.inputPlaceholder = this.add.text(width / 2, height / 2 + 50, 'Type your word here...', {
      fontSize: '20px',
      fill: '#6b7280',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Current input text
    this.inputText = this.add.text(width / 2, height / 2 + 50, '', {
      fontSize: '20px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Input cursor
    this.inputCursor = this.add.rectangle(width / 2 + 10, height / 2 + 50, 2, 30, 0xffffff)
    this.inputCursor.setVisible(false)
    
    // Current word being typed
    this.currentInput = ''
  }
  
  setupGameLogic () {
    // Keyboard input handling
    this.input.keyboard.on('keydown', this.handleKeyInput, this)
    
    // Game timer
    this.gameTimer = this.time.addEvent({
      delay: 1000,
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
    this.timeRemaining = 90
    this.score = 0
    this.wordsEntered = []
    this.isGameActive = true
    this.currentInput = ''
    
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
      this.currentInput += key.toLowerCase()
      this.updateInputDisplay()
    }
  }
  
  updateInputDisplay () {
    if (this.currentInput.length === 0) {
      this.inputText.setVisible(false)
      this.inputPlaceholder.setVisible(true)
    } else {
      this.inputText.setText(this.currentInput)
      this.inputText.setVisible(true)
      this.inputPlaceholder.setVisible(false)
    }
    
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
  
  updateTimer () {
    if (!this.isGameActive) return
    
    this.timeRemaining--
    
    if (this.timeRemaining <= 0) {
      this.endGame()
    } else {
      this.updateUI()
      
      // Warning color when time is low
      if (this.timeRemaining <= 10) {
        this.timerText.setColor('#ef4444')
        
        // Pulse animation
        this.tweens.add({
          targets: this.timerText,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 200,
          yoyo: true
        })
      }
    }
  }
  
  updateUI () {
    // Update displays
    this.categoryText.setText(`Category: ${this.currentCategory}`)
    this.timerText.setText(this.timeRemaining.toString())
    this.scoreText.setText(this.score.toString())
    
    // Update HTML HUD elements if available
    const scoreElement = document.getElementById('score-value')
    const timerElement = document.getElementById('timer-value')
    
    if (scoreElement) {
      scoreElement.textContent = this.score.toString()
    }
    
    if (timerElement) {
      timerElement.textContent = this.timeRemaining.toString()
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
    this.gameTimer.paused = true
    
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
  
  update () {
    // Game loop update
    // Most game logic is handled by events, but this can be used for continuous updates
  }
}