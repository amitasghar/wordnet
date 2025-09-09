import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Phaser Game Initialization', () => {
  let mockGame

  beforeEach(() => {
    // Mock Phaser.Game
    mockGame = {
      config: {
        width: 800,
        height: 600,
        type: 'AUTO'
      },
      scene: {
        add: vi.fn(),
        remove: vi.fn(),
        getScenes: vi.fn(() => []),
        start: vi.fn()
      },
      events: {
        on: vi.fn(),
        emit: vi.fn()
      },
      destroy: vi.fn()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with correct game configuration', async () => {
    const { gameConfig } = await import('../src/config/gameConfig.js')
    
    expect(gameConfig.type).toBeDefined()
    expect(gameConfig.width).toBe(800)
    expect(gameConfig.height).toBe(600)
    expect(gameConfig.parent).toBe('game-container')
    expect(gameConfig.scale.mode).toBeDefined()
  })

  it('should have responsive scale configuration', async () => {
    const { gameConfig } = await import('../src/config/gameConfig.js')
    
    expect(gameConfig.scale.autoCenter).toBeDefined()
    expect(gameConfig.scale.min.width).toBeGreaterThan(0)
    expect(gameConfig.scale.max.width).toBeGreaterThan(gameConfig.scale.min.width)
  })

  it('should disable physics for word game optimization', async () => {
    const { gameConfig } = await import('../src/config/gameConfig.js')
    
    expect(gameConfig.physics.default).toBe(false)
  })
})

describe('Scene Management System', () => {
  it('should create BootScene correctly', async () => {
    const { BootScene } = await import('../src/scenes/BootScene.js')
    const scene = new BootScene()
    
    expect(scene.key).toBe('BootScene')
    expect(typeof scene.preload).toBe('function')
    expect(typeof scene.create).toBe('function')
  })

  it('should create PreloadScene correctly', async () => {
    const { PreloadScene } = await import('../src/scenes/PreloadScene.js')
    const scene = new PreloadScene()
    
    expect(scene.key).toBe('PreloadScene')
    expect(typeof scene.preload).toBe('function')
    expect(typeof scene.create).toBe('function')
  })

  it('should create MainMenuScene correctly', async () => {
    const { MainMenuScene } = await import('../src/scenes/MainMenuScene.js')
    const scene = new MainMenuScene()
    
    expect(scene.key).toBe('MainMenuScene')
    expect(typeof scene.create).toBe('function')
  })

  it('should create GameScene correctly', async () => {
    const { GameScene } = await import('../src/scenes/GameScene.js')
    const scene = new GameScene()
    
    expect(scene.key).toBe('GameScene')
    expect(typeof scene.create).toBe('function')
    expect(typeof scene.update).toBe('function')
  })
})

describe('Game State Management', () => {
  it('should initialize GameStateManager', async () => {
    const { GameStateManager } = await import('../src/managers/GameStateManager.js')
    
    const stateManager = new GameStateManager()
    expect(stateManager).toBeDefined()
    expect(typeof stateManager.setState).toBe('function')
    expect(typeof stateManager.getState).toBe('function')
  })

  it('should handle state transitions', async () => {
    const { GameStateManager } = await import('../src/managers/GameStateManager.js')
    
    const stateManager = new GameStateManager()
    stateManager.setState('MENU')
    expect(stateManager.getState()).toBe('MENU')
    
    stateManager.setState('PLAYING')
    expect(stateManager.getState()).toBe('PLAYING')
  })
})