import Phaser from 'phaser'
import { devLogger } from '@/utils/devTools.js'

export class PreloadScene extends Phaser.Scene {
  constructor () {
    super({ key: 'PreloadScene' })
  }
  
  preload () {
    devLogger.scene('PreloadScene: Starting asset preload')
    
    // Create more detailed loading screen
    this.createLoadingInterface()
    
    // Load game assets
    this.loadGameAssets()
    
    // Set up preload event listeners
    this.load.on('progress', this.updateProgress, this)
    this.load.on('fileprogress', this.updateFileProgress, this)
    this.load.on('complete', this.onLoadComplete, this)
  }
  
  createLoadingInterface () {
    const { width, height } = this.cameras.main
    
    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)
    
    // Title
    this.add.text(width / 2, height / 2 - 100, 'Loading Game Assets', {
      fontSize: '24px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Progress bar background
    this.progressBg = this.add.rectangle(width / 2, height / 2, 500, 30, 0x333333)
    this.progressBar = this.add.rectangle(width / 2 - 250, height / 2, 0, 26, 0x4f46e5)
    this.progressBar.setOrigin(0, 0.5)
    
    // Progress text
    this.progressText = this.add.text(width / 2, height / 2 + 50, '0% - Initializing...', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // File loading text
    this.fileText = this.add.text(width / 2, height / 2 + 80, '', {
      fontSize: '14px',
      fill: '#cccccc',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Tips text
    this.tipsText = this.add.text(width / 2, height - 100, 'Tip: Create words that match the given category!', {
      fontSize: '14px',
      fill: '#7c3aed',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
  }
  
  loadGameAssets () {
    // UI Assets
    this.loadUIAssets()
    
    // Audio Assets
    this.loadAudioAssets()
    
    // Game Data
    this.loadGameData()
    
    // Fonts and Styles
    this.loadFonts()
    
    devLogger.scene('PreloadScene: All assets queued for loading')
  }
  
  loadUIAssets () {
    // Create simple colored rectangles as placeholders
    // In production, these would be actual image files
    
    // Button assets
    this.load.image('button-normal', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    this.load.image('button-hover', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    this.load.image('button-pressed', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    
    // Game UI elements
    this.load.image('panel-bg', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    this.load.image('input-bg', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    
    devLogger.scene('PreloadScene: UI assets queued')
  }
  
  loadAudioAssets () {
    // Audio will be loaded when actual files are available
    // For now, just log the intention
    
    if (!import.meta.env.VITE_MOCK_WORD_API) {
      // this.load.audio('click', 'assets/audio/click.mp3')
      // this.load.audio('success', 'assets/audio/success.mp3')
      // this.load.audio('error', 'assets/audio/error.mp3')
      // this.load.audio('timer', 'assets/audio/timer.mp3')
      // this.load.audio('background', 'assets/audio/background.mp3')
    }
    
    devLogger.scene('PreloadScene: Audio assets queued')
  }
  
  loadGameData () {
    // Load initial word categories and data
    if (import.meta.env.VITE_MOCK_WORD_API === 'true') {
      // Create mock data inline
      const mockCategories = [
        { id: 1, name: 'Animals', difficulty: 'easy' },
        { id: 2, name: 'Foods', difficulty: 'easy' },
        { id: 3, name: 'Countries', difficulty: 'medium' },
        { id: 4, name: 'Science', difficulty: 'hard' }
      ]
      
      // Store mock data
      this.cache.json.add('categories', mockCategories)
    } else {
      // Load from actual API or local files
      // this.load.json('categories', 'data/categories.json')
      // this.load.json('words', 'data/words.json')
    }
    
    devLogger.scene('PreloadScene: Game data queued')
  }
  
  loadFonts () {
    // Web fonts will be loaded via CSS
    // This is just for logging
    devLogger.scene('PreloadScene: Font loading handled by CSS')
  }
  
  updateProgress (progress) {
    this.progressBar.width = 500 * progress
    this.progressText.setText(`${Math.round(progress * 100)}% - Loading assets...`)
  }
  
  updateFileProgress (file) {
    this.fileText.setText(`Loading: ${file.key}`)
    devLogger.scene(`PreloadScene: Loading file ${file.key}`)
  }
  
  onLoadComplete () {
    devLogger.scene('PreloadScene: All assets loaded, transitioning to MainMenuScene')
    
    // Update UI
    this.progressText.setText('100% - Complete!')
    this.fileText.setText('Ready to play!')
    
    // Transition with delay for smooth UX
    this.time.delayedCall(1000, () => {
      this.scene.start('MainMenuScene')
    })
  }
  
  create () {
    devLogger.scene('PreloadScene: Scene created')
    
    // Register this scene with the scene manager
    this.events.emit('scene:ready', 'PreloadScene')
  }
}