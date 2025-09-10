import { devLogger } from '@/utils/devTools.js'
import { trackManagerError } from '@/utils/ErrorTracker.js'
import { gracefulDegradation } from '@/utils/GracefulDegradation.js'

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
  constructor (game = null, wordDataManager = null, storageManager = null) {
    this.game = game
    this.wordDataManager = wordDataManager
    this.storageManager = storageManager
    
    // Scene state management
    this.currentState = GAME_STATES.BOOTING
    this.previousState = null
    this.stateHistory = [GAME_STATES.BOOTING]
    this.stateData = {}
    
    // Game session management
    this.currentGameSession = null
    this.currentRound = null
    this.gameHistory = []
    this.playerStats = {
      totalGames: 0,
      totalWords: 0,
      totalScore: 0,
      averageScore: 0,
      bestScore: 0,
      categoriesPlayed: new Set(),
      lettersPlayed: new Set(),
      favoriteCategories: {},
      difficultyPreference: 'medium'
    }
    
    // Category-letter combination tracking
    this.recentCombinations = []
    this.combinationStats = {
      generated: 0,
      successful: 0,
      failed: 0,
      averageDifficulty: 0,
      averagePlayability: 0,
      categoryDistribution: {},
      letterDistribution: {}
    }
    
    // Configuration
    this.gameConfig = {
      maxRecentCombinations: 20,
      adaptiveDifficulty: true,
      preventRepetition: true,
      trackPerformance: true,
      persistState: true,
      maxHistorySize: 50
    }
    
    // Event listeners
    this.listeners = new Map()
    
    devLogger.game('GameStateManager: Initialized with category-letter integration')
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

  // Get current round configuration
  get roundConfig () {
    return this.currentRound || { timeLimit: 90 }
  }

  // Get current round information
  getCurrentRound () {
    return this.currentRound
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
      }, 0),
      gameSession: this.currentGameSession ? {
        id: this.currentGameSession.id,
        status: this.currentGameSession.status,
        roundsCompleted: this.currentGameSession.roundsCompleted
      } : null,
      currentRound: this.currentRound ? {
        id: this.currentRound.id,
        category: this.currentRound.category.name,
        letter: this.currentRound.letter,
        wordsFound: this.currentRound.wordsFound.length
      } : null
    }
  }

  // ==========================================
  // GAME SESSION MANAGEMENT
  // ==========================================

  /**
   * Initialize game session management
   */
  async initializeGameSession () {
    try {
      // Load saved session state if available
      if (this.storageManager && this.gameConfig.persistState) {
        await this.loadGameSessionState()
      }
      
      devLogger.game('GameStateManager: Game session management initialized')
      return true
    } catch (error) {
      trackManagerError('GameStateManager', 'initializeGameSession', error, {
        context: 'Initializing game session management'
      })
      return false
    }
  }

  /**
   * Start a new game session
   */
  async startGameSession (sessionConfig = {}) {
    try {
      // Save current session to history if it exists
      if (this.currentGameSession && this.currentGameSession.status !== 'ready') {
        this.gameHistory.unshift(this.currentGameSession)
        if (this.gameHistory.length > this.gameConfig.maxHistorySize) {
          this.gameHistory = this.gameHistory.slice(0, this.gameConfig.maxHistorySize)
        }
      }
      
      // Create new game session
      const defaultConfig = {
        difficulty: this.getAdaptiveDifficulty(),
        mode: 'default',
        targetRounds: 5,
        timeLimit: 90
      }
      
      const config = { ...defaultConfig, ...sessionConfig }
      
      this.currentGameSession = {
        id: this.generateGameId(),
        startedAt: Date.now(),
        rounds: [],
        status: 'ready',
        totalScore: 0,
        roundsCompleted: 0,
        config,
        metadata: {
          adaptiveDifficulty: this.gameConfig.adaptiveDifficulty,
          systemStatus: this.wordDataManager?.getSystemStatus() || null
        }
      }
      
      // Update player stats
      this.playerStats.totalGames++
      
      // Emit event
      this.emit('gameSessionStarted', this.currentGameSession)
      
      devLogger.game(`GameStateManager: Started new game session ${this.currentGameSession.id}`)
      
      // Save state
      if (this.gameConfig.persistState) {
        await this.saveGameSessionState()
      }
      
      return this.currentGameSession
    } catch (error) {
      trackManagerError('GameStateManager', 'startGameSession', error, {
        context: 'Starting new game session'
      })
      return null
    }
  }

  /**
   * Start a new round within the current game session
   */
  async startRound (roundConfig = {}) {
    try {
      if (!this.currentGameSession) {
        throw new Error('No active game session to start round')
      }
      
      // Generate category-letter combination
      const combination = await this.generateRoundCombination(roundConfig)
      if (!combination) {
        throw new Error('Failed to generate round combination')
      }
      
      // Create round data
      this.currentRound = {
        id: this.generateRoundId(),
        gameSessionId: this.currentGameSession.id,
        roundNumber: this.currentGameSession.rounds.length + 1,
        startedAt: Date.now(),
        status: 'active',
        
        // Category-letter data
        category: combination.category,
        letter: combination.letter,
        difficulty: combination.difficulty,
        playability: combination.playability,
        
        // Round configuration
        timeLimit: roundConfig.timeLimit || this.currentGameSession.config.timeLimit || 90,
        targetWordCount: combination.roundConfig?.targetWordCount || 10,
        
        // Player progress
        wordsFound: [],
        score: 0,
        timeElapsed: 0,
        hintsUsed: 0,
        
        // Metadata
        metadata: {
          generationType: combination.metadata?.generationType || 'unknown',
          combinationAttempts: combination.attempts || 1,
          systemDegradationLevel: gracefulDegradation.getStatus().level
        }
      }
      
      // Update game session status
      this.currentGameSession.status = 'playing'
      
      // Track combination usage
      this.trackCombinationUsage(combination)
      
      // Emit event
      this.emit('roundStarted', this.currentRound)
      
      devLogger.game(`GameStateManager: Started round ${this.currentRound.id} with ${combination.category.name}/${combination.letter}`)
      
      // Update game state to PLAYING if not already
      if (this.currentState !== GAME_STATES.PLAYING) {
        this.setState(GAME_STATES.PLAYING, {
          gameSession: this.currentGameSession,
          round: this.currentRound
        })
      }
      
      // Save state
      if (this.gameConfig.persistState) {
        await this.saveGameSessionState()
      }
      
      return this.currentRound
    } catch (error) {
      trackManagerError('GameStateManager', 'startRound', error, {
        context: 'Starting new round'
      })
      return null
    }
  }

  /**
   * Generate category-letter combination for round
   */
  async generateRoundCombination (roundConfig = {}) {
    try {
      if (!this.wordDataManager) {
        throw new Error('WordDataManager not available')
      }
      
      // Determine round type based on game progress
      const roundType = this.determineRoundType(roundConfig)
      
      // Generate options with repetition prevention
      const options = {
        ...roundConfig,
        excludeLetters: this.getRecentLetters(),
        excludeCategories: this.getRecentCategories(),
        targetDifficulty: this.getTargetDifficulty()
      }
      
      // Generate combination using unified system
      const combination = this.wordDataManager.generateUnifiedRound(roundType, options)
      
      if (!combination) {
        throw new Error('Failed to generate combination')
      }
      
      return combination
    } catch (error) {
      trackManagerError('GameStateManager', 'generateRoundCombination', error, {
        fallback: true,
        context: 'Generating round combination'
      })
      
      // Fallback to basic combination
      return this.generateFallbackCombination()
    }
  }

  /**
   * Add word to current round
   */
  async addWordToRound (word) {
    try {
      if (!this.currentRound || this.currentRound.status !== 'active') {
        throw new Error('No active round to add word to')
      }
      
      // Validate word
      const validation = this.wordDataManager?.validateWordUnified(
        word,
        this.currentRound.category.id,
        this.currentRound.letter,
        { roundId: this.currentRound.id }
      )
      
      if (!validation || !validation.valid) {
        return {
          success: false,
          reason: validation?.reason || 'Invalid word',
          score: 0
        }
      }
      
      // Check for duplicates
      if (this.currentRound.wordsFound.some(w => w.word.toLowerCase() === word.toLowerCase())) {
        return {
          success: false,
          reason: 'Word already found',
          score: 0
        }
      }
      
      // Add word to round
      const wordData = {
        word: word.toLowerCase(),
        score: validation.score,
        foundAt: Date.now() - this.currentRound.startedAt,
        validation: validation.metadata
      }
      
      this.currentRound.wordsFound.push(wordData)
      this.currentRound.score += validation.score
      this.currentGameSession.totalScore += validation.score
      
      // Update player stats
      this.playerStats.totalWords++
      this.playerStats.totalScore += validation.score
      
      // Emit event
      this.emit('wordAdded', {
        word: wordData,
        round: this.currentRound,
        gameSession: this.currentGameSession
      })
      
      devLogger.game(`GameStateManager: Added word "${word}" (${validation.score} points)`)
      
      // Save state
      if (this.gameConfig.persistState) {
        await this.saveGameSessionState()
      }
      
      return {
        success: true,
        score: validation.score,
        totalRoundScore: this.currentRound.score,
        wordsFound: this.currentRound.wordsFound.length
      }
    } catch (error) {
      trackManagerError('GameStateManager', 'addWordToRound', error, {
        context: `Adding word "${word}" to round`
      })
      
      return {
        success: false,
        reason: 'Error processing word',
        score: 0
      }
    }
  }

  /**
   * Complete current round
   */
  async completeRound (reason = 'completed') {
    try {
      if (!this.currentRound) {
        throw new Error('No active round to complete')
      }
      
      // Update round status
      this.currentRound.status = reason
      this.currentRound.completedAt = Date.now()
      this.currentRound.timeElapsed = this.currentRound.completedAt - this.currentRound.startedAt
      
      // Calculate performance metrics
      const performance = this.calculateRoundPerformance(this.currentRound)
      this.currentRound.performance = performance
      
      // Add to game session rounds
      this.currentGameSession.rounds.push(this.currentRound)
      this.currentGameSession.roundsCompleted++
      
      // Update player stats
      this.updatePlayerStatsFromRound(this.currentRound)
      
      // Emit event
      this.emit('roundCompleted', {
        round: this.currentRound,
        gameSession: this.currentGameSession
      })
      
      devLogger.game(`GameStateManager: Completed round ${this.currentRound.id} (${reason})`)
      
      const completedRound = this.currentRound
      this.currentRound = null
      
      // Check if game session is complete
      if (this.currentGameSession.roundsCompleted >= this.currentGameSession.config.targetRounds) {
        await this.completeGameSession()
      } else {
        // Update state data with completed round
        this.stateData[GAME_STATES.PLAYING] = {
          gameSession: this.currentGameSession,
          completedRound
        }
      }
      
      // Save state
      if (this.gameConfig.persistState) {
        await this.saveGameSessionState()
      }
      
      return completedRound
    } catch (error) {
      trackManagerError('GameStateManager', 'completeRound', error, {
        context: 'Completing round'
      })
      return null
    }
  }

  /**
   * Complete current game session
   */
  async completeGameSession () {
    try {
      if (!this.currentGameSession) {
        return null
      }
      
      this.currentGameSession.status = 'completed'
      this.currentGameSession.completedAt = Date.now()
      this.currentGameSession.duration = this.currentGameSession.completedAt - this.currentGameSession.startedAt
      
      // Calculate game performance
      const performance = this.calculateGamePerformance(this.currentGameSession)
      this.currentGameSession.performance = performance
      
      // Update player stats
      this.updatePlayerStatsFromGame(this.currentGameSession)
      
      // Emit event
      this.emit('gameSessionCompleted', this.currentGameSession)
      
      // Transition to game over state
      this.setState(GAME_STATES.GAME_OVER, {
        gameSession: this.currentGameSession,
        performance
      })
      
      devLogger.game(`GameStateManager: Completed game session ${this.currentGameSession.id}`)
      
      return this.currentGameSession
    } catch (error) {
      trackManagerError('GameStateManager', 'completeGameSession', error, {
        context: 'Completing game session'
      })
      return null
    }
  }

  // Helper methods for game session management
  generateGameId () {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  generateRoundId () {
    return `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  determineRoundType (roundConfig) {
    if (roundConfig.roundType) {
      return roundConfig.roundType
    }
    
    const roundNumber = this.currentGameSession?.rounds.length + 1 || 1
    const playerLevel = this.getPlayerLevel()
    
    if (roundNumber === 1) return 'quick'
    if (roundNumber <= 3) return 'default'
    if (playerLevel >= 3) return 'challenge'
    return 'default'
  }

  getRecentLetters () {
    if (!this.gameConfig.preventRepetition) return []
    
    const recentCount = Math.min(5, this.recentCombinations.length)
    return this.recentCombinations
      .slice(0, recentCount)
      .map(combo => combo.letter)
  }

  getRecentCategories () {
    if (!this.gameConfig.preventRepetition) return []
    
    const recentCount = Math.min(3, this.recentCombinations.length)
    return this.recentCombinations
      .slice(0, recentCount)
      .map(combo => combo.category.id)
  }

  getTargetDifficulty () {
    if (!this.gameConfig.adaptiveDifficulty) {
      return this.currentGameSession?.config.difficulty || 'medium'
    }
    
    const playerLevel = this.getPlayerLevel()
    const recentPerformance = this.getRecentPerformance()
    
    let targetDifficulty = playerLevel
    
    if (recentPerformance > 0.8) {
      targetDifficulty = Math.min(5, targetDifficulty + 1)
    } else if (recentPerformance < 0.4) {
      targetDifficulty = Math.max(1, targetDifficulty - 1)
    }
    
    return targetDifficulty
  }

  getPlayerLevel () {
    const gamesPlayed = this.playerStats.totalGames
    const avgScore = this.playerStats.averageScore
    
    if (gamesPlayed < 5) return 1
    if (gamesPlayed < 15 && avgScore < 100) return 2
    if (gamesPlayed < 30 && avgScore < 200) return 3
    if (avgScore < 300) return 4
    return 5
  }

  getRecentPerformance () {
    const recentGames = this.gameHistory.slice(0, 5)
    if (recentGames.length === 0) return 0.5
    
    const avgPerformance = recentGames.reduce((sum, game) => {
      return sum + (game.performance?.overall || 0.5)
    }, 0) / recentGames.length
    
    return avgPerformance
  }

  getAdaptiveDifficulty () {
    const playerLevel = this.getPlayerLevel()
    const difficultyMap = {
      1: 'easy',
      2: 'easy', 
      3: 'medium',
      4: 'medium',
      5: 'hard'
    }
    
    return difficultyMap[playerLevel] || 'medium'
  }

  trackCombinationUsage (combination) {
    try {
      // Add to recent combinations
      this.recentCombinations.unshift({
        category: combination.category,
        letter: combination.letter,
        difficulty: combination.difficulty,
        playability: combination.playability,
        usedAt: Date.now()
      })
      
      // Limit size
      if (this.recentCombinations.length > this.gameConfig.maxRecentCombinations) {
        this.recentCombinations = this.recentCombinations.slice(0, this.gameConfig.maxRecentCombinations)
      }
      
      // Update combination stats
      this.combinationStats.generated++
      this.combinationStats.averageDifficulty = 
        ((this.combinationStats.averageDifficulty * (this.combinationStats.generated - 1)) + combination.difficulty) / this.combinationStats.generated
      
      if (combination.playability) {
        this.combinationStats.averagePlayability =
          ((this.combinationStats.averagePlayability * (this.combinationStats.generated - 1)) + combination.playability.score) / this.combinationStats.generated
      }
      
      // Track distributions
      this.combinationStats.categoryDistribution[combination.category.id] = 
        (this.combinationStats.categoryDistribution[combination.category.id] || 0) + 1
      
      this.combinationStats.letterDistribution[combination.letter] = 
        (this.combinationStats.letterDistribution[combination.letter] || 0) + 1
    } catch (error) {
      devLogger.warn('GameStateManager: Failed to track combination usage', error)
    }
  }

  generateFallbackCombination () {
    const fallbackData = gracefulDegradation.getFallbackData()
    const categories = fallbackData.categories
    const letters = fallbackData.letters
    
    if (!categories.length || !letters.length) return null
    
    const category = categories[Math.floor(Math.random() * categories.length)]
    const letter = letters[Math.floor(Math.random() * letters.length)]
    
    return {
      category,
      letter,
      difficulty: 1,
      playability: { score: 5, feasible: true, reason: 'Fallback combination' },
      roundConfig: fallbackData.roundConfigs.emergency,
      metadata: { generationType: 'fallback' }
    }
  }

  calculateRoundPerformance (round) {
    const timeBonus = Math.max(0, (round.timeLimit * 1000 - round.timeElapsed) / (round.timeLimit * 1000))
    const wordCountRatio = round.wordsFound.length / round.targetWordCount
    const scorePerWord = round.wordsFound.length > 0 ? round.score / round.wordsFound.length : 0
    
    const overall = (timeBonus * 0.3 + Math.min(1, wordCountRatio) * 0.5 + Math.min(1, scorePerWord / 50) * 0.2)
    
    return {
      overall,
      timeBonus,
      wordCountRatio,
      scorePerWord,
      efficiency: round.wordsFound.length / (round.timeElapsed / 1000)
    }
  }

  calculateGamePerformance (game) {
    if (!game.rounds.length) return { overall: 0 }
    
    const avgRoundPerformance = game.rounds.reduce((sum, round) => {
      return sum + (round.performance?.overall || 0)
    }, 0) / game.rounds.length
    
    const totalWordsFound = game.rounds.reduce((sum, round) => sum + round.wordsFound.length, 0)
    const avgWordsPerRound = totalWordsFound / game.rounds.length
    
    return {
      overall: avgRoundPerformance,
      avgWordsPerRound,
      totalScore: game.totalScore,
      consistency: this.calculateConsistency(game.rounds)
    }
  }

  calculateConsistency (rounds) {
    if (rounds.length < 2) return 1
    
    const performances = rounds.map(r => r.performance?.overall || 0)
    const avg = performances.reduce((sum, p) => sum + p, 0) / performances.length
    const variance = performances.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / performances.length
    
    return Math.max(0, 1 - Math.sqrt(variance))
  }

  updatePlayerStatsFromRound (round) {
    this.playerStats.categoriesPlayed.add(round.category.id)
    this.playerStats.lettersPlayed.add(round.letter)
    
    const categoryId = round.category.id
    this.playerStats.favoriteCategories[categoryId] = 
      (this.playerStats.favoriteCategories[categoryId] || 0) + 1
  }

  updatePlayerStatsFromGame (game) {
    this.playerStats.averageScore = this.playerStats.totalScore / this.playerStats.totalGames
    
    if (game.totalScore > this.playerStats.bestScore) {
      this.playerStats.bestScore = game.totalScore
    }
  }

  /**
   * Get comprehensive game state including session data
   */
  getGameState () {
    return {
      // Scene state
      sceneState: this.currentState,
      previousState: this.previousState,
      stateHistory: this.stateHistory,
      stateData: this.stateData,
      
      // Game session state
      currentGameSession: this.currentGameSession,
      currentRound: this.currentRound,
      playerStats: {
        ...this.playerStats,
        categoriesPlayed: Array.from(this.playerStats.categoriesPlayed),
        lettersPlayed: Array.from(this.playerStats.lettersPlayed)
      },
      combinationStats: this.combinationStats,
      systemStatus: this.wordDataManager?.getSystemStatus() || null
    }
  }

  /**
   * Save game session state to storage
   */
  async saveGameSessionState () {
    try {
      if (!this.storageManager) return false
      
      const sessionData = {
        currentGameSession: this.currentGameSession,
        currentRound: this.currentRound,
        playerStats: {
          ...this.playerStats,
          categoriesPlayed: Array.from(this.playerStats.categoriesPlayed),
          lettersPlayed: Array.from(this.playerStats.lettersPlayed)
        },
        combinationStats: this.combinationStats,
        gameHistory: this.gameHistory.slice(0, 10),
        recentCombinations: this.recentCombinations.slice(0, 10),
        savedAt: Date.now()
      }
      
      await this.storageManager.set('gameSessionState', sessionData)
      return true
    } catch (error) {
      trackManagerError('GameStateManager', 'saveGameSessionState', error, {
        context: 'Saving game session state'
      })
      return false
    }
  }

  /**
   * Load game session state from storage
   */
  async loadGameSessionState () {
    try {
      if (!this.storageManager) return false
      
      const sessionData = await this.storageManager.get('gameSessionState')
      if (!sessionData) return false
      
      // Restore state
      this.currentGameSession = sessionData.currentGameSession
      this.currentRound = sessionData.currentRound
      this.gameHistory = sessionData.gameHistory || []
      this.recentCombinations = sessionData.recentCombinations || []
      this.combinationStats = sessionData.combinationStats || this.combinationStats
      
      // Restore player stats
      if (sessionData.playerStats) {
        this.playerStats = {
          ...sessionData.playerStats,
          categoriesPlayed: new Set(sessionData.playerStats.categoriesPlayed || []),
          lettersPlayed: new Set(sessionData.playerStats.lettersPlayed || [])
        }
      }
      
      devLogger.game('GameStateManager: Loaded saved game session state')
      return true
    } catch (error) {
      trackManagerError('GameStateManager', 'loadGameSessionState', error, {
        context: 'Loading game session state'
      })
      return false
    }
  }
}