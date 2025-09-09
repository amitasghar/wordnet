import { devLogger } from '@/utils/devTools.js'

// Game states enumeration
export const GAME_STATES = {
  BOOTING: 'BOOTING',
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  SETTINGS: 'SETTINGS'
}

// Scene mappings
export const STATE_SCENE_MAP = {
  [GAME_STATES.BOOTING]: 'BootScene',
  [GAME_STATES.LOADING]: 'PreloadScene',
  [GAME_STATES.MENU]: 'MainMenuScene',
  [GAME_STATES.PLAYING]: 'GameScene',
  [GAME_STATES.PAUSED]: 'PauseScene',
  [GAME_STATES.GAME_OVER]: 'GameOverScene',
  [GAME_STATES.SETTINGS]: 'SettingsScene'
}

export class GameStateManager {
  constructor (game = null) {
    this.game = game
    this.currentState = GAME_STATES.BOOTING
    this.previousState = null
    this.stateHistory = [GAME_STATES.BOOTING]
    this.stateData = {}
    
    // Event listeners
    this.listeners = new Map()
    
    devLogger.game('GameStateManager: Initialized')
  }
  
  // Get current game state
  getState () {
    return this.currentState
  }
  
  // Get previous game state
  getPreviousState () {
    return this.previousState
  }
  
  // Get state history
  getStateHistory () {
    return [...this.stateHistory]
  }
  
  // Set new game state
  setState (newState, data = null) {
    if (!Object.values(GAME_STATES).includes(newState)) {
      console.error(`GameStateManager: Invalid state "${newState}"`)
      return false
    }
    
    if (this.currentState === newState) {
      devLogger.game(`GameStateManager: Already in state "${newState}"`)
      return false
    }
    
    const oldState = this.currentState
    this.previousState = oldState
    this.currentState = newState
    
    // Add to history
    this.stateHistory.push(newState)
    
    // Limit history size
    if (this.stateHistory.length > 10) {
      this.stateHistory.shift()
    }
    
    // Store state data
    if (data) {
      this.stateData[newState] = data
    }
    
    devLogger.game(`GameStateManager: State changed from "${oldState}" to "${newState}"`, data)
    
    // Emit state change event
    this.emit('stateChange', {
      oldState,
      newState,
      data
    })
    
    // Handle scene transitions if game is available
    if (this.game) {
      this.handleSceneTransition(oldState, newState)
    }
    
    return true
  }
  
  // Get data associated with a state
  getStateData (state = null) {
    const targetState = state || this.currentState
    return this.stateData[targetState] || null
  }
  
  // Clear data for a specific state
  clearStateData (state) {
    delete this.stateData[state]
  }
  
  // Check if currently in a specific state
  isInState (state) {
    return this.currentState === state
  }
  
  // Check if state can transition to another state
  canTransitionTo (targetState) {
    // Define valid transitions
    const validTransitions = {
      [GAME_STATES.BOOTING]: [GAME_STATES.LOADING],
      [GAME_STATES.LOADING]: [GAME_STATES.MENU],
      [GAME_STATES.MENU]: [GAME_STATES.PLAYING, GAME_STATES.SETTINGS],
      [GAME_STATES.PLAYING]: [GAME_STATES.PAUSED, GAME_STATES.GAME_OVER, GAME_STATES.MENU],
      [GAME_STATES.PAUSED]: [GAME_STATES.PLAYING, GAME_STATES.MENU],
      [GAME_STATES.GAME_OVER]: [GAME_STATES.MENU, GAME_STATES.PLAYING],
      [GAME_STATES.SETTINGS]: [GAME_STATES.MENU]
    }
    
    const allowedTransitions = validTransitions[this.currentState] || []
    return allowedTransitions.includes(targetState)
  }
  
  // Transition to state with validation
  transitionTo (targetState, data = null) {
    if (!this.canTransitionTo(targetState)) {
      console.error(`GameStateManager: Invalid transition from "${this.currentState}" to "${targetState}"`)
      return false
    }
    
    return this.setState(targetState, data)
  }
  
  // Go back to previous state
  goBack () {
    if (this.previousState && this.canTransitionTo(this.previousState)) {
      return this.setState(this.previousState)
    }
    return false
  }
  
  // Handle scene transitions based on state changes
  handleSceneTransition (oldState, newState) {
    const targetScene = STATE_SCENE_MAP[newState]
    
    if (!targetScene) {
      devLogger.game(`GameStateManager: No scene mapped for state "${newState}"`)
      return
    }
    
    if (!this.game.scene.getScene(targetScene)) {
      devLogger.game(`GameStateManager: Scene "${targetScene}" not found`)
      return
    }
    
    devLogger.game(`GameStateManager: Transitioning to scene "${targetScene}"`)
    
    // Handle different transition types
    switch (newState) {
      case GAME_STATES.LOADING:
        this.game.scene.start(targetScene)
        break
        
      case GAME_STATES.MENU:
        if (oldState === GAME_STATES.PLAYING || oldState === GAME_STATES.GAME_OVER) {
          // Fade transition from game states
          const currentScene = this.game.scene.getScene(STATE_SCENE_MAP[oldState])
          if (currentScene && currentScene.cameras) {
            currentScene.cameras.main.fadeOut(500, 0, 0, 0)
            currentScene.cameras.main.once('camerafadeoutcomplete', () => {
              this.game.scene.start(targetScene)
            })
          } else {
            this.game.scene.start(targetScene)
          }
        } else {
          this.game.scene.start(targetScene)
        }
        break
        
      case GAME_STATES.PLAYING:
        // Start game scene
        this.game.scene.start(targetScene)
        break
        
      case GAME_STATES.PAUSED:
        // Launch pause scene over current scene
        this.game.scene.launch(targetScene)
        this.game.scene.pause(STATE_SCENE_MAP[oldState])
        break
        
      default:
        this.game.scene.start(targetScene)
    }
  }
  
  // Event system
  on (event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }
  
  off (event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
  
  emit (event, data = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`GameStateManager: Error in event listener for "${event}":`, error)
        }
      })
    }
  }
  
  // Reset state manager
  reset () {
    this.currentState = GAME_STATES.BOOTING
    this.previousState = null
    this.stateHistory = [GAME_STATES.BOOTING]
    this.stateData = {}
    
    devLogger.game('GameStateManager: Reset to initial state')
  }
  
  // Pause/Resume functionality
  pause () {
    if (this.currentState === GAME_STATES.PLAYING) {
      this.setState(GAME_STATES.PAUSED)
    }
  }
  
  resume () {
    if (this.currentState === GAME_STATES.PAUSED) {
      this.setState(GAME_STATES.PLAYING)
      
      // Resume the paused scene
      if (this.game) {
        const playingScene = this.game.scene.getScene(STATE_SCENE_MAP[GAME_STATES.PLAYING])
        if (playingScene) {
          this.game.scene.resume(playingScene)
        }
      }
    }
  }
  
  // Game over handling
  gameOver (gameData = null) {
    if (this.currentState === GAME_STATES.PLAYING) {
      this.setState(GAME_STATES.GAME_OVER, gameData)
    }
  }
  
  // Settings access
  openSettings () {
    if (this.canTransitionTo(GAME_STATES.SETTINGS)) {
      this.setState(GAME_STATES.SETTINGS)
    }
  }
  
  closeSettings () {
    if (this.currentState === GAME_STATES.SETTINGS) {
      this.goBack()
    }
  }
  
  // Debug information
  getDebugInfo () {
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      stateHistory: this.getStateHistory(),
      stateData: Object.keys(this.stateData),
      listenerCount: Array.from(this.listeners.entries()).reduce((total, [event, callbacks]) => {
        return total + callbacks.length
      }, 0)
    }
  }
}