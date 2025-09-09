import { describe, it, expect } from 'vitest'

describe('Development Environment Setup', () => {
  it('should have Vite available', () => {
    // Test that we're in a proper ES6 module environment
    expect(typeof import.meta).toBe('object')
    expect(import.meta.env).toBeDefined()
  })

  it('should support ES6 imports', async () => {
    // Test dynamic import capability
    const module = await import('../src/config/gameConfig.js')
    expect(module).toBeDefined()
  })

  it('should have proper development environment variables', () => {
    // Test environment setup
    expect(import.meta.env).toBeDefined()
    expect(typeof import.meta.env.MODE).toBe('string')
  })
})

describe('Phaser.js Integration', () => {
  it('should import Phaser successfully', async () => {
    const Phaser = await import('phaser')
    expect(Phaser.default).toBeDefined()
    expect(Phaser.default.VERSION).toMatch(/^3\.80/)
  })

  it('should support Phaser game configuration', async () => {
    const { gameConfig } = await import('../src/config/gameConfig.js')
    expect(gameConfig).toBeDefined()
    expect(gameConfig.type).toBeDefined()
    expect(gameConfig.width).toBeGreaterThan(0)
    expect(gameConfig.height).toBeGreaterThan(0)
  })
})