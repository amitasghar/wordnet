import { devLogger } from '@/utils/devTools.js'
import { BootScene } from '@scenes/BootScene.js'
import { PreloadScene } from '@scenes/PreloadScene.js'
import { MainMenuScene } from '@scenes/MainMenuScene.js'
import { GameScene } from '@scenes/GameScene.js'

export class SceneManager {
  constructor (game) {
    this.game = game
    this.scenes = new Map()
    this.activeScenes = new Set()
    this.sceneHistory = []
    this.transitions = new Map()
    
    this.init()
  }
  
  init () {
    // Register all game scenes
    this.registerScene('BootScene', BootScene)
    this.registerScene('PreloadScene', PreloadScene)
    this.registerScene('MainMenuScene', MainMenuScene)
    this.registerScene('GameScene', GameScene)
    
    // Setup scene event listeners
    this.setupSceneEvents()
    
    devLogger.game('SceneManager: Initialized with all scenes registered')
  }
  
  registerScene (key, SceneClass) {
    if (this.scenes.has(key)) {
      console.warn(`SceneManager: Scene "${key}" is already registered`)
      return false
    }
    
    // Create scene instance
    const sceneInstance = new SceneClass()
    
    // Add to Phaser's scene manager
    this.game.scene.add(key, sceneInstance)
    
    // Store in our scene registry
    this.scenes.set(key, {
      key,
      SceneClass,
      instance: sceneInstance,
      isActive: false,
      data: {}
    })
    
    devLogger.scene(`SceneManager: Registered scene "${key}"`)
    return true
  }
  
  unregisterScene (key) {
    if (!this.scenes.has(key)) {
      console.warn(`SceneManager: Scene "${key}" is not registered`)
      return false
    }
    
    // Stop scene if it's running
    this.stopScene(key)
    
    // Remove from Phaser's scene manager
    this.game.scene.remove(key)
    
    // Remove from our registry
    this.scenes.delete(key)
    this.activeScenes.delete(key)
    
    devLogger.scene(`SceneManager: Unregistered scene "${key}"`)
    return true
  }
  
  setupSceneEvents () {
    // Listen for scene lifecycle events
    this.game.events.on('scene:start', this.onSceneStart, this)
    this.game.events.on('scene:ready', this.onSceneReady, this)
    this.game.events.on('scene:pause', this.onScenePause, this)
    this.game.events.on('scene:resume', this.onSceneResume, this)
    this.game.events.on('scene:stop', this.onSceneStop, this)
  }
  
  onSceneStart (sceneKey) {
    if (this.scenes.has(sceneKey)) {
      this.scenes.get(sceneKey).isActive = true
      this.activeScenes.add(sceneKey)
      this.sceneHistory.push({
        action: 'start',
        scene: sceneKey,
        timestamp: Date.now()
      })
    }
    
    devLogger.scene(`SceneManager: Scene "${sceneKey}" started`)
  }
  
  onSceneReady (sceneKey) {
    devLogger.scene(`SceneManager: Scene "${sceneKey}" ready`)
  }
  
  onScenePause (sceneKey) {
    devLogger.scene(`SceneManager: Scene "${sceneKey}" paused`)
  }
  
  onSceneResume (sceneKey) {
    devLogger.scene(`SceneManager: Scene "${sceneKey}" resumed`)
  }
  
  onSceneStop (sceneKey) {
    if (this.scenes.has(sceneKey)) {
      this.scenes.get(sceneKey).isActive = false
      this.activeScenes.delete(sceneKey)
      this.sceneHistory.push({
        action: 'stop',
        scene: sceneKey,
        timestamp: Date.now()
      })
    }
    
    devLogger.scene(`SceneManager: Scene "${sceneKey}" stopped`)
  }
  
  // Start a scene
  startScene (key, data = null) {
    if (!this.scenes.has(key)) {
      console.error(`SceneManager: Cannot start scene "${key}" - not registered`)
      return false
    }
    
    // Store scene data if provided
    if (data) {
      this.scenes.get(key).data = { ...this.scenes.get(key).data, ...data }
    }
    
    // Start the scene
    this.game.scene.start(key, data)
    
    devLogger.scene(`SceneManager: Starting scene "${key}"`, data)
    return true
  }
  
  // Stop a scene
  stopScene (key) {
    if (!this.scenes.has(key)) {
      console.error(`SceneManager: Cannot stop scene "${key}" - not registered`)
      return false
    }
    
    this.game.scene.stop(key)
    
    devLogger.scene(`SceneManager: Stopping scene "${key}"`)
    return true
  }
  
  // Launch a scene (run alongside other scenes)
  launchScene (key, data = null) {
    if (!this.scenes.has(key)) {
      console.error(`SceneManager: Cannot launch scene "${key}" - not registered`)
      return false
    }
    
    // Store scene data if provided
    if (data) {
      this.scenes.get(key).data = { ...this.scenes.get(key).data, ...data }
    }
    
    this.game.scene.launch(key, data)
    
    devLogger.scene(`SceneManager: Launching scene "${key}"`, data)
    return true
  }
  
  // Pause a scene
  pauseScene (key) {
    if (!this.scenes.has(key)) {
      console.error(`SceneManager: Cannot pause scene "${key}" - not registered`)
      return false
    }
    
    this.game.scene.pause(key)
    
    devLogger.scene(`SceneManager: Pausing scene "${key}"`)
    return true
  }
  
  // Resume a scene
  resumeScene (key) {
    if (!this.scenes.has(key)) {
      console.error(`SceneManager: Cannot resume scene "${key}" - not registered`)
      return false
    }
    
    this.game.scene.resume(key)
    
    devLogger.scene(`SceneManager: Resuming scene "${key}"`)
    return true
  }
  
  // Restart a scene
  restartScene (key, data = null) {
    if (!this.scenes.has(key)) {
      console.error(`SceneManager: Cannot restart scene "${key}" - not registered`)
      return false
    }
    
    // Store scene data if provided
    if (data) {
      this.scenes.get(key).data = { ...this.scenes.get(key).data, ...data }
    }
    
    this.game.scene.restart(key, data)
    
    devLogger.scene(`SceneManager: Restarting scene "${key}"`, data)
    return true
  }
  
  // Transition between scenes with effects
  transitionToScene (fromKey, toKey, transitionConfig = {}) {
    const {
      type = 'fade',
      duration = 500,
      color = 0x000000,
      data = null
    } = transitionConfig
    
    if (!this.scenes.has(toKey)) {
      console.error(`SceneManager: Cannot transition to scene "${toKey}" - not registered`)
      return false
    }
    
    const fromScene = this.game.scene.getScene(fromKey)
    
    if (!fromScene) {
      // No source scene, just start target scene
      return this.startScene(toKey, data)
    }
    
    devLogger.scene(`SceneManager: Transitioning from "${fromKey}" to "${toKey}" with "${type}" effect`)
    
    switch (type) {
      case 'fade':
        this.fadeTransition(fromScene, toKey, duration, color, data)
        break
        
      case 'slide':
        this.slideTransition(fromScene, toKey, duration, data)
        break
        
      case 'instant':
        this.game.scene.start(toKey, data)
        break
        
      default:
        console.warn(`SceneManager: Unknown transition type "${type}", using instant`)
        this.game.scene.start(toKey, data)
    }
    
    return true
  }
  
  fadeTransition (fromScene, toKey, duration, color, data) {
    if (fromScene.cameras && fromScene.cameras.main) {
      const r = (color >> 16) & 0xFF
      const g = (color >> 8) & 0xFF
      const b = color & 0xFF
      
      fromScene.cameras.main.fadeOut(duration, r, g, b)
      
      fromScene.cameras.main.once('camerafadeoutcomplete', () => {
        this.game.scene.start(toKey, data)
        
        // Fade in new scene
        const toScene = this.game.scene.getScene(toKey)
        if (toScene && toScene.cameras && toScene.cameras.main) {
          toScene.cameras.main.fadeIn(duration / 2, r, g, b)
        }
      })
    } else {
      // Fallback to instant transition
      this.game.scene.start(toKey, data)
    }
  }
  
  slideTransition (fromScene, toKey, duration, data) {
    // Simplified slide transition (move camera)
    if (fromScene.cameras && fromScene.cameras.main) {
      const camera = fromScene.cameras.main
      const startX = camera.scrollX
      
      fromScene.tweens.add({
        targets: camera,
        scrollX: startX - camera.width,
        duration,
        ease: 'Power2.easeInOut',
        onComplete: () => {
          this.game.scene.start(toKey, data)
        }
      })
    } else {
      // Fallback to instant transition
      this.game.scene.start(toKey, data)
    }
  }
  
  // Get scene information
  getScene (key) {
    return this.scenes.get(key) || null
  }
  
  // Get all registered scenes
  getAllScenes () {
    return Array.from(this.scenes.keys())
  }
  
  // Get active scenes
  getActiveScenes () {
    return Array.from(this.activeScenes)
  }
  
  // Check if scene is active
  isSceneActive (key) {
    return this.activeScenes.has(key)
  }
  
  // Get scene data
  getSceneData (key) {
    const scene = this.scenes.get(key)
    return scene ? scene.data : null
  }
  
  // Set scene data
  setSceneData (key, data) {
    const scene = this.scenes.get(key)
    if (scene) {
      scene.data = { ...scene.data, ...data }
      return true
    }
    return false
  }
  
  // Clear scene data
  clearSceneData (key) {
    const scene = this.scenes.get(key)
    if (scene) {
      scene.data = {}
      return true
    }
    return false
  }
  
  // Scene history management
  getSceneHistory () {
    return [...this.sceneHistory]
  }
  
  clearSceneHistory () {
    this.sceneHistory = []
  }
  
  // Get the last active scene
  getLastActiveScene () {
    const history = this.sceneHistory.slice().reverse()
    
    for (const entry of history) {
      if (entry.action === 'start' && this.scenes.has(entry.scene)) {
        return entry.scene
      }
    }
    
    return null
  }
  
  // Cleanup
  destroy () {
    // Remove all scenes
    this.scenes.forEach((scene, key) => {
      this.unregisterScene(key)
    })
    
    // Clear collections
    this.scenes.clear()
    this.activeScenes.clear()
    this.sceneHistory = []
    this.transitions.clear()
    
    // Remove event listeners
    this.game.events.off('scene:start', this.onSceneStart, this)
    this.game.events.off('scene:ready', this.onSceneReady, this)
    this.game.events.off('scene:pause', this.onScenePause, this)
    this.game.events.off('scene:resume', this.onSceneResume, this)
    this.game.events.off('scene:stop', this.onSceneStop, this)
    
    devLogger.game('SceneManager: Destroyed')
  }
  
  // Debug information
  getDebugInfo () {
    return {
      totalScenes: this.scenes.size,
      activeScenes: Array.from(this.activeScenes),
      registeredScenes: Array.from(this.scenes.keys()),
      historyLength: this.sceneHistory.length,
      lastActiveScene: this.getLastActiveScene()
    }
  }
}