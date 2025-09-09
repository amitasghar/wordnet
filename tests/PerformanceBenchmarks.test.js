// Performance benchmarks for all generation algorithms
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'
import { LetterGenerator } from '../src/managers/LetterGenerator.js'
import { CombinationGenerator } from '../src/managers/CombinationGenerator.js'

describe('Performance Benchmarks', () => {
  let categoryManager, letterGenerator, combinationGenerator
  const PERFORMANCE_THRESHOLD_MS = 100
  const BATCH_SIZE = 10

  beforeEach(() => {
    categoryManager = new CategoryDataManager()
    letterGenerator = new LetterGenerator()
    combinationGenerator = new CombinationGenerator(categoryManager, letterGenerator)
  })

  describe('Category Generation Performance', () => {
    it('should generate categories under 50ms', async () => {
      const startTime = performance.now()
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        await categoryManager.getRandomCategory()
      }
      
      const duration = performance.now() - startTime
      const averageTime = duration / BATCH_SIZE
      
      expect(averageTime).toBeLessThan(50)
      console.log(`Category generation average: ${averageTime.toFixed(2)}ms`)
    })

    it('should filter categories efficiently', async () => {
      const startTime = performance.now()
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        await categoryManager.getCategoriesByDifficulty('medium')
      }
      
      const duration = performance.now() - startTime
      const averageTime = duration / BATCH_SIZE
      
      expect(averageTime).toBeLessThan(25)
      console.log(`Category filtering average: ${averageTime.toFixed(2)}ms`)
    })

    it('should handle concurrent category requests', async () => {
      const promises = []
      const startTime = performance.now()
      
      for (let i = 0; i < 20; i++) {
        promises.push(categoryManager.getRandomCategory())
      }
      
      await Promise.all(promises)
      const duration = performance.now() - startTime
      
      expect(duration).toBeLessThan(200)
      console.log(`Concurrent category generation: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Letter Generation Performance', () => {
    it('should generate letters under 10ms', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        letterGenerator.generateLetter()
      }
      
      const duration = performance.now() - startTime
      const averageTime = duration / BATCH_SIZE
      
      expect(averageTime).toBeLessThan(10)
      console.log(`Letter generation average: ${averageTime.toFixed(2)}ms`)
    })

    it('should generate category-aware letters efficiently', async () => {
      const category = await categoryManager.getRandomCategory()
      const startTime = performance.now()
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        letterGenerator.generateCategoryAwareLetter(category)
      }
      
      const duration = performance.now() - startTime
      const averageTime = duration / BATCH_SIZE
      
      expect(averageTime).toBeLessThan(15)
      console.log(`Category-aware letter generation: ${averageTime.toFixed(2)}ms`)
    })
  })

  describe('Combination Generation Performance', () => {
    it('should generate combinations under 100ms', async () => {
      const startTime = performance.now()
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        await combinationGenerator.generateCombination()
      }
      
      const duration = performance.now() - startTime
      const averageTime = duration / BATCH_SIZE
      
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      console.log(`Combination generation average: ${averageTime.toFixed(2)}ms`)
    })

    it('should generate round batches efficiently', async () => {
      const startTime = performance.now()
      
      await combinationGenerator.generateRounds(5)
      
      const duration = performance.now() - startTime
      
      expect(duration).toBeLessThan(300)
      console.log(`Batch round generation (5 rounds): ${duration.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage Benchmarks', () => {
    it('should track memory usage during generation', async () => {
      if (!performance.memory) {
        console.log('Performance memory API not available')
        return
      }

      const initialMemory = performance.memory.usedJSHeapSize
      
      // Generate many combinations to test memory usage
      for (let i = 0; i < 50; i++) {
        await combinationGenerator.generateCombination()
      }
      
      const finalMemory = performance.memory.usedJSHeapSize
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024)
      
      expect(memoryIncreaseMB).toBeLessThan(10) // Should not increase by more than 10MB
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`)
    })

    it('should clean up memory after operations', async () => {
      if (!performance.memory) {
        console.log('Performance memory API not available')
        return
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const beforeMemory = performance.memory.usedJSHeapSize
      
      // Create many objects
      const objects = []
      for (let i = 0; i < 1000; i++) {
        objects.push(await combinationGenerator.generateCombination())
      }
      
      // Clear references
      objects.length = 0
      
      // Force cleanup
      if (global.gc) {
        global.gc()
      }
      
      const afterMemory = performance.memory.usedJSHeapSize
      const memoryDiff = (afterMemory - beforeMemory) / (1024 * 1024)
      
      expect(memoryDiff).toBeLessThan(5) // Memory should be mostly cleaned up
      console.log(`Memory after cleanup: ${memoryDiff.toFixed(2)}MB difference`)
    })
  })

  describe('Load Testing Scenarios', () => {
    it('should handle high-frequency generation requests', async () => {
      const requests = 100
      const promises = []
      const startTime = performance.now()
      
      for (let i = 0; i < requests; i++) {
        promises.push(combinationGenerator.generateCombination())
      }
      
      const results = await Promise.all(promises)
      const duration = performance.now() - startTime
      const averageTime = duration / requests
      
      expect(results).toHaveLength(requests)
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      console.log(`Load test (${requests} requests): ${duration.toFixed(2)}ms total, ${averageTime.toFixed(2)}ms average`)
    })

    it('should maintain performance under sustained load', async () => {
      const rounds = 5
      const requestsPerRound = 20
      const timings = []
      
      for (let round = 0; round < rounds; round++) {
        const startTime = performance.now()
        const promises = []
        
        for (let i = 0; i < requestsPerRound; i++) {
          promises.push(combinationGenerator.generateCombination())
        }
        
        await Promise.all(promises)
        const roundTime = performance.now() - startTime
        timings.push(roundTime)
        
        // Small delay between rounds
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const averageRoundTime = timings.reduce((a, b) => a + b, 0) / rounds
      const maxRoundTime = Math.max(...timings)
      const performanceDegradation = maxRoundTime / timings[0]
      
      expect(performanceDegradation).toBeLessThan(2.0) // Performance shouldn't degrade more than 2x
      console.log(`Sustained load test - Average: ${averageRoundTime.toFixed(2)}ms, Max: ${maxRoundTime.toFixed(2)}ms, Degradation: ${performanceDegradation.toFixed(2)}x`)
    })
  })

  describe('Performance Regression Tests', () => {
    it('should maintain baseline performance metrics', async () => {
      const baselines = {
        categoryGeneration: 50,
        letterGeneration: 10,
        combinationGeneration: 100
      }
      
      // Category generation test
      let startTime = performance.now()
      await categoryManager.getRandomCategory()
      let duration = performance.now() - startTime
      expect(duration).toBeLessThan(baselines.categoryGeneration)
      
      // Letter generation test
      startTime = performance.now()
      letterGenerator.generateLetter()
      duration = performance.now() - startTime
      expect(duration).toBeLessThan(baselines.letterGeneration)
      
      // Combination generation test
      startTime = performance.now()
      await combinationGenerator.generateCombination()
      duration = performance.now() - startTime
      expect(duration).toBeLessThan(baselines.combinationGeneration)
      
      console.log('All baseline performance metrics met')
    })

    it('should detect performance regressions in batch operations', async () => {
      const batchSize = 10
      const expectedMaxTime = batchSize * 50 // 50ms per operation maximum
      
      const startTime = performance.now()
      const promises = []
      
      for (let i = 0; i < batchSize; i++) {
        promises.push(combinationGenerator.generateCombination())
      }
      
      await Promise.all(promises)
      const duration = performance.now() - startTime
      
      expect(duration).toBeLessThan(expectedMaxTime)
      console.log(`Batch regression test (${batchSize} operations): ${duration.toFixed(2)}ms`)
    })
  })
})