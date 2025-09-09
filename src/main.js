// Main application entry point
import Phaser from 'phaser'
import { gameConfig } from '@config/gameConfig.js'
import { DevTools, devLogger } from '@/utils/devTools.js'
import { GameStateManager } from '@/managers/GameStateManager.js'
import { GameLoopManager } from '@/managers/GameLoopManager.js'
import { SceneManager } from '@/managers/SceneManager.js'
import { AssetManager } from '@/managers/AssetManager.js'
import { StorageManager } from '@/managers/StorageManager.js'
import { WordDataManager } from '@/managers/WordDataManager.js'
import { UIManager } from '@/managers/UIManager.js'
import { ResponsiveCanvas } from '@/utils/ResponsiveCanvas.js'
import { EventBridge } from '@/utils/EventBridge.js'

// Development logging
devLogger.game('Initializing Category Challenge', {
  version: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.MODE,
  debug: __DEV__
})

// Game class
class CategoryChallengeGame {
  constructor () {
    this.game = null
    this.devTools = null
    this.stateManager = null
    this.loopManager = null
    this.sceneManager = null
    this.assetManager = null
    this.storageManager = null
    this.wordDataManager = null
    this.uiManager = null
    this.responsiveCanvas = null
    this.eventBridge = null
    this.initialized = false
  }
  
  async init () {
    try {
      // Initialize event bridge first (other systems may use it)
      this.eventBridge = new EventBridge()
      
      // Initialize Phaser game
      this.game = new Phaser.Game(gameConfig)
      
      // Initialize storage first (other managers may depend on it)
      this.storageManager = new StorageManager()
      await this.storageManager.init()
      
      // Initialize core managers
      this.stateManager = new GameStateManager(this.game)
      this.loopManager = new GameLoopManager(this.game)
      this.sceneManager = new SceneManager(this.game)
      
      // Initialize asset and data managers
      this.assetManager = new AssetManager(this.game)
      this.wordDataManager = new WordDataManager(this.storageManager)
      await this.wordDataManager.init()
      
      // Initialize UI and responsive systems
      this.uiManager = new UIManager(this.game)
      this.responsiveCanvas = new ResponsiveCanvas(this.game)
      
      // Initialize development tools
      if (__DEV__) {
        this.devTools = new DevTools(this.game)
      }
      
      // Start the first scene
      this.sceneManager.startScene('BootScene')
      
      // Game event listeners
      this.game.events.on('ready', this.onGameReady.bind(this))
      this.game.events.on('destroy', this.onGameDestroy.bind(this))
      
      this.initialized = true
      devLogger.game('Game initialization complete')
      
      return this.game
    } catch (error) {
      console.error('Failed to initialize game:', error)
      throw error
    }
  }
  
  onGameReady () {
    devLogger.game('Game ready', {
      renderer: this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas',
      resolution: `${this.game.config.width}x${this.game.config.height}`,
      pixelRatio: window.devicePixelRatio
    })
    
    // Dispatch custom event for UI integration
    window.dispatchEvent(new CustomEvent('game:ready', {
      detail: { game: this.game }
    }))
  }
  
  onGameDestroy () {
    devLogger.game('Game destroyed')
    this.initialized = false
  }
  
  destroy () {
    // Clean up managers in reverse order
    if (this.responsiveCanvas) {
      this.responsiveCanvas.destroy()
      this.responsiveCanvas = null
    }
    
    if (this.uiManager) {
      this.uiManager.destroy()
      this.uiManager = null
    }
    
    if (this.assetManager) {
      this.assetManager.clear()
      this.assetManager = null
    }
    
    if (this.wordDataManager) {
      this.wordDataManager.clearCache()
      this.wordDataManager = null
    }
    
    if (this.sceneManager) {
      this.sceneManager.destroy()
      this.sceneManager = null
    }
    
    if (this.loopManager) {
      this.loopManager.stop()
      this.loopManager = null
    }
    
    if (this.stateManager) {
      this.stateManager.reset()
      this.stateManager = null
    }
    
    // Storage manager cleanup is automatic
    this.storageManager = null
    
    if (this.eventBridge) {
      this.eventBridge.destroy()
      this.eventBridge = null
    }
    
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
  }
  
  // Hot reload support
  reload () {
    if (__DEV__ && this.initialized) {
      devLogger.game('Hot reloading game')
      const scenes = this.game.scene.getScenes(true)
      scenes.forEach(scene => {
        scene.scene.restart()
      })
    }
  }
}

// Global game instance
let gameInstance = null

// Initialize game
async function initGame () {
  if (gameInstance) {
    gameInstance.destroy()
  }
  
  gameInstance = new CategoryChallengeGame()
  
  try {
    await gameInstance.init()
    
    // Make game accessible globally for debugging
    if (__DEV__) {
      window.game = gameInstance.game
      window.devTools = gameInstance.devTools
      window.stateManager = gameInstance.stateManager
      window.loopManager = gameInstance.loopManager
      window.sceneManager = gameInstance.sceneManager
      window.assetManager = gameInstance.assetManager
      window.storageManager = gameInstance.storageManager
      window.wordDataManager = gameInstance.wordDataManager
      window.uiManager = gameInstance.uiManager
      window.responsiveCanvas = gameInstance.responsiveCanvas
      window.eventBridge = gameInstance.eventBridge
      window.gameInstance = gameInstance
    }
    
    return gameInstance
  } catch (error) {
    console.error('Game initialization failed:', error)
    
    // Show error in UI
    const gameContainer = document.getElementById('game-container')
    gameContainer.innerHTML = `
      <div class="text-center text-red-500 p-8">
        <h2 class="text-2xl font-bold mb-4">Game Failed to Load</h2>
        <p class="mb-4">There was an error initializing the game engine.</p>
        <button onclick="location.reload()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">
          Reload Page
        </button>
      </div>
    `
    
    throw error
  }
}

// Hot module replacement support
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    if (gameInstance) {
      gameInstance.reload()
    }
  })
  
  import.meta.hot.dispose(() => {
    if (gameInstance) {
      gameInstance.destroy()
    }
  })
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame)
} else {
  initGame()
}

export { initGame, gameInstance }