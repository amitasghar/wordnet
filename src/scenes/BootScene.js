import Phaser from 'phaser'
import { devLogger } from '@/utils/devTools.js'

export class BootScene extends Phaser.Scene {
  constructor () {
    super({ key: 'BootScene' })
  }
  
  preload () {
    devLogger.scene('BootScene: Starting preload')
    
    // Create loading bar background
    this.createLoadingScreen()
    
    // Load essential assets needed by other scenes
    this.loadEssentialAssets()
    
    // Set up preload event listeners
    this.load.on('progress', this.updateLoadingBar, this)
    this.load.on('complete', this.onLoadComplete, this)
  }
  
  createLoadingScreen () {
    const { width, height } = this.cameras.main
    
    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)
    
    // Loading text
    this.add.text(width / 2, height / 2 - 50, 'Category Challenge', {
      fontSize: '32px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
    
    // Loading bar background
    this.loadingBarBg = this.add.rectangle(width / 2, height / 2 + 20, 400, 20, 0x333333)
    this.loadingBar = this.add.rectangle(width / 2 - 200, height / 2 + 20, 0, 18, 0x4f46e5)
    this.loadingBar.setOrigin(0, 0.5)
    
    // Loading percentage text
    this.loadingText = this.add.text(width / 2, height / 2 + 60, '0%', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)
  }
  
  loadEssentialAssets () {
    // Load placeholder/minimal assets needed for basic functionality
    
    // Create simple colored rectangles as placeholder assets
    this.load.image('button-bg', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    
    // Load any essential fonts or minimal UI elements
    if (import.meta.env.VITE_FAST_LOAD_ASSETS !== 'true') {
      // In production, load actual assets
      // this.load.image('logo', 'assets/images/logo.png')
      // this.load.image('background', 'assets/images/background.png')
    }
    
    // Load audio assets (minimal for now)
    // this.load.audio('click', 'assets/audio/click.mp3')
    
    devLogger.scene('BootScene: Essential assets queued for loading')
  }
  
  updateLoadingBar (progress) {
    this.loadingBar.width = 400 * progress
    this.loadingText.setText(`${Math.round(progress * 100)}%`)
    
    devLogger.scene(`BootScene: Loading progress ${Math.round(progress * 100)}%`)
  }
  
  onLoadComplete () {
    devLogger.scene('BootScene: Loading complete, transitioning to PreloadScene')
    
    // Small delay for smooth transition
    this.time.delayedCall(500, () => {
      this.scene.start('PreloadScene')
    })
  }
  
  create () {
    devLogger.scene('BootScene: Scene created')
    
    // Add any initialization that doesn't require assets
    
    // Register this scene with the scene manager
    this.events.emit('scene:ready', 'BootScene')
  }
}