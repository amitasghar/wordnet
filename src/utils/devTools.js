// Development tools and utilities
export class DevTools {
  constructor (game) {
    this.game = game
    this.enabled = __DEV__ && import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true'
    this.fpsText = null
    this.debugInfo = {}
    
    if (this.enabled) {
      this.init()
    }
  }
  
  init () {
    // Add FPS counter if enabled
    if (import.meta.env.VITE_SHOW_FPS === 'true') {
      this.setupFPSCounter()
    }
    
    // Add keyboard shortcuts for development
    this.setupKeyboardShortcuts()
    
    // Add scene debugging
    if (import.meta.env.VITE_ENABLE_SCENE_DEBUG === 'true') {
      this.setupSceneDebug()
    }
    
    console.log('🔧 Development tools enabled')
  }
  
  setupFPSCounter () {
    // FPS counter will be added to the first active scene
    const scene = this.game.scene.getScenes(true)[0]
    if (scene) {
      this.fpsText = scene.add.text(10, 10, 'FPS: 0', {
        font: '16px Arial',
        fill: '#00ff00'
      })
      this.fpsText.setScrollFactor(0)
      this.fpsText.setDepth(9999)
    }
  }
  
  setupKeyboardShortcuts () {
    document.addEventListener('keydown', (event) => {
      // Ctrl + R: Reload current scene
      if (event.ctrlKey && event.key === 'r') {
        event.preventDefault()
        const currentScene = this.game.scene.getScenes(true)[0]
        if (currentScene) {
          currentScene.scene.restart()
          console.log('🔄 Scene reloaded')
        }
      }
      
      // Ctrl + D: Toggle debug info
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault()
        this.toggleDebugInfo()
      }
      
      // Ctrl + S: Save game state (for testing)
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault()
        this.saveGameState()
      }
    })
  }
  
  setupSceneDebug () {
    // Scene transition debugging
    this.game.events.on('step', this.updateDebugInfo.bind(this))
  }
  
  updateDebugInfo () {
    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${this.game.loop.actualFps.toFixed(1)}`)
    }
    
    // Update debug info object
    this.debugInfo = {
      fps: this.game.loop.actualFps,
      activeScenes: this.game.scene.getScenes(true).map(s => s.scene.key),
      gameObjects: this.game.scene.getScenes(true).reduce((total, scene) => {
        return total + scene.children.length
      }, 0),
      memory: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB'
      } : 'N/A'
    }
  }
  
  toggleDebugInfo () {
    console.log('🐛 Debug Info:', this.debugInfo)
  }
  
  saveGameState () {
    const gameState = {
      timestamp: Date.now(),
      scenes: this.game.scene.getScenes(true).map(s => s.scene.key),
      debugInfo: this.debugInfo
    }
    
    localStorage.setItem('wordnet_dev_gamestate', JSON.stringify(gameState))
    console.log('💾 Game state saved', gameState)
  }
  
  loadGameState () {
    const saved = localStorage.getItem('wordnet_dev_gamestate')
    if (saved) {
      const gameState = JSON.parse(saved)
      console.log('📂 Game state loaded', gameState)
      return gameState
    }
    return null
  }
}

// Hot reload utilities
export const hotReload = {
  // Store references to reloadable modules
  modules: new Map(),
  
  register (key, module) {
    if (__DEV__) {
      this.modules.set(key, module)
    }
  },
  
  update (key, newModule) {
    if (__DEV__ && this.modules.has(key)) {
      console.log(`🔥 Hot reloading module: ${key}`)
      this.modules.set(key, newModule)
      return true
    }
    return false
  }
}

// Development event logger
export const devLogger = {
  log (category, message, data = null) {
    if (__DEV__) {
      const timestamp = new Date().toLocaleTimeString()
      const prefix = `[${timestamp}] [${category.toUpperCase()}]`
      
      if (data) {
        console.log(prefix, message, data)
      } else {
        console.log(prefix, message)
      }
    }
  },
  
  scene (message, data) {
    this.log('SCENE', message, data)
  },
  
  game (message, data) {
    this.log('GAME', message, data)
  },
  
  asset (message, data) {
    this.log('ASSET', message, data)
  },
  
  storage (message, data) {
    this.log('STORAGE', message, data)
  },
  
  manager (message, data) {
    this.log('MANAGER', message, data)
  },
  
  input (message, data) {
    this.log('INPUT', message, data)
  },
  
  error (message, error) {
    if (__DEV__) {
      const timestamp = new Date().toLocaleTimeString()
      const prefix = `[${timestamp}] [ERROR]`
      console.error(prefix, message, error)
    }
  },
  
  warn (message, data) {
    if (__DEV__) {
      const timestamp = new Date().toLocaleTimeString()
      const prefix = `[${timestamp}] [WARN]`
      if (data) {
        console.warn(prefix, message, data)
      } else {
        console.warn(prefix, message)
      }
    }
  }
}