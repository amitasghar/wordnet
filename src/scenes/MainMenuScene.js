import Phaser from 'phaser'
import { devLogger } from '@/utils/devTools.js'

export class MainMenuScene extends Phaser.Scene {
  constructor () {
    super({ key: 'MainMenuScene' })
  }
  
  create () {
    devLogger.scene('MainMenuScene: Creating main menu')
    
    const { width, height } = this.cameras.main
    
    // Background
    this.createBackground()
    
    // Title
    this.createTitle()
    
    // Menu buttons
    this.createMenuButtons()
    
    // Footer info
    this.createFooter()
    
    // Setup input handlers
    this.setupInputHandlers()
    
    // Register this scene with the scene manager
    this.events.emit('scene:ready', 'MainMenuScene')
    
    devLogger.scene('MainMenuScene: Main menu created successfully')
  }
  
  createBackground () {
    const { width, height } = this.cameras.main
    
    // Gradient background effect
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)
    
    // Add some visual elements
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.Between(2, 6)
      const alpha = Phaser.Math.FloatBetween(0.1, 0.3)
      
      this.add.circle(x, y, size, 0x4f46e5, alpha)
    }
  }
  
  createTitle () {
    const { width } = this.cameras.main
    
    // Main title
    this.titleText = this.add.text(width / 2, 150, 'Category Challenge', {
      fontSize: '48px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Subtitle
    this.subtitleText = this.add.text(width / 2, 200, 'Fast-paced word game', {
      fontSize: '20px',
      fill: '#7c3aed',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Add subtle animation to title
    this.tweens.add({
      targets: this.titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }
  
  createMenuButtons () {
    const { width, height } = this.cameras.main
    const buttonY = height / 2 + 50
    const buttonSpacing = 80
    
    // Play button
    this.playButton = this.createButton(width / 2, buttonY, 'Play Game', 0x4f46e5, () => {
      this.startGame()
    })
    
    // Instructions button
    this.instructionsButton = this.createButton(width / 2, buttonY + buttonSpacing, 'How to Play', 0x7c3aed, () => {
      this.showInstructions()
    })
    
    // Settings button (placeholder)
    this.settingsButton = this.createButton(width / 2, buttonY + buttonSpacing * 2, 'Settings', 0x6b7280, () => {
      this.showSettings()
    })
  }
  
  createButton (x, y, text, color, callback) {
    // Button background
    const buttonBg = this.add.rectangle(x, y, 200, 50, color)
    buttonBg.setInteractive({ useHandCursor: true })
    
    // Button text
    const buttonText = this.add.text(x, y, text, {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Button container
    const button = this.add.container(0, 0, [buttonBg, buttonText])
    
    // Hover effects
    buttonBg.on('pointerover', () => {
      this.tweens.add({
        targets: button,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      })
    })
    
    buttonBg.on('pointerout', () => {
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100
      })
    })
    
    // Click handler
    buttonBg.on('pointerdown', callback)
    
    return button
  }
  
  createFooter () {
    const { width, height } = this.cameras.main
    
    // Version info
    this.add.text(width / 2, height - 50, `Version ${import.meta.env.VITE_APP_VERSION}`, {
      fontSize: '14px',
      fill: '#6b7280',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Development mode indicator
    if (__DEV__) {
      this.add.text(20, height - 30, 'DEV MODE', {
        fontSize: '12px',
        fill: '#ef4444',
        fontFamily: 'Arial'
      })
    }
  }
  
  setupInputHandlers () {
    // Keyboard shortcuts
    this.input.keyboard.on('keydown-ENTER', () => {
      this.startGame()
    })
    
    this.input.keyboard.on('keydown-ESC', () => {
      // ESC can be used for settings or quit
      this.showSettings()
    })
  }
  
  startGame () {
    devLogger.scene('MainMenuScene: Starting game')
    
    // Add transition effect
    this.cameras.main.fadeOut(500, 0, 0, 0)
    
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene')
    })
  }
  
  showInstructions () {
    devLogger.scene('MainMenuScene: Showing instructions')
    
    // For now, show a simple alert
    // In a full implementation, this would show an instructions overlay
    const instructions = `
      Category Challenge - How to Play:
      
      1. You'll be given a category (e.g., "Animals")
      2. Type words that match the category
      3. You have 60-90 seconds per round
      4. Longer and rarer words give more points
      5. Try to beat your high score!
      
      Press ENTER to start playing!
    `
    
    // Create instructions overlay (simplified)
    this.showModal('How to Play', instructions)
  }
  
  showSettings () {
    devLogger.scene('MainMenuScene: Showing settings')
    
    // Placeholder for settings
    this.showModal('Settings', 'Settings panel coming soon!')
  }
  
  showModal (title, content) {
    const { width, height } = this.cameras.main
    
    // Modal background
    const modalBg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    modalBg.setInteractive()
    
    // Modal panel
    const panel = this.add.rectangle(width / 2, height / 2, 400, 300, 0x2d3748)
    
    // Modal title
    const titleText = this.add.text(width / 2, height / 2 - 100, title, {
      fontSize: '24px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    // Modal content
    const contentText = this.add.text(width / 2, height / 2 - 20, content, {
      fontSize: '14px',
      fill: '#e2e8f0',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 350 }
    }).setOrigin(0.5)
    
    // Close button
    const closeButton = this.add.rectangle(width / 2, height / 2 + 80, 100, 40, 0x4f46e5)
    closeButton.setInteractive({ useHandCursor: true })
    
    const closeText = this.add.text(width / 2, height / 2 + 80, 'Close', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Modal container
    const modal = this.add.container(0, 0, [modalBg, panel, titleText, contentText, closeButton, closeText])
    
    // Close modal handler
    const closeModal = () => {
      modal.destroy()
    }
    
    closeButton.on('pointerdown', closeModal)
    modalBg.on('pointerdown', closeModal)
    
    // ESC key to close
    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    escKey.once('down', closeModal)
  }
}