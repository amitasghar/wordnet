// Automated performance regression tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'
import { LetterGenerator } from '../src/managers/LetterGenerator.js'
import { CombinationGenerator } from '../src/managers/CombinationGenerator.js'

describe('Performance Regression Tests', () => {
  let categoryManager, letterGenerator, combinationGenerator
  
  // Performance baselines (in milliseconds)
  const PERFORMANCE_BASELINES = {
    categoryGeneration: { max: 50, target: 25 },
    categoryFiltering: { max: 25, target: 10 },
    letterGeneration: { max: 10, target: 5 },
    categoryAwareLetter: { max: 15, target: 8 },
    combinationGeneration: { max: 100, target: 50 },
    batchRoundGeneration: { max: 300, target: 150 },
    concurrentOperations: { max: 200, target: 100 }
  }

  // Memory baselines (in MB)
  const MEMORY_BASELINES = {
    singleOperation: { max: 1, target: 0.5 },
    batchOperations: { max: 10, target: 5 },
    sustainedOperations: { max: 20, target: 10 }
  }

  beforeEach(async () => {
    categoryManager = new CategoryDataManager()
    letterGenerator = new LetterGenerator()
    combinationGenerator = new CombinationGenerator(categoryManager, letterGenerator)
    
    // Ensure managers are initialized
    await categoryManager.init?.()
    await letterGenerator.init?.()
    await combinationGenerator.init?.()
  })

  afterEach(() => {
    // Clean up resources
    categoryManager.cleanup?.()
    letterGenerator.cleanup?.()
    combinationGenerator.cleanup?.()
  })

  describe('Core Operation Performance Regression', () => {
    it('should not regress category generation performance', async () => {
      const iterations = 20
      const timings = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await categoryManager.getRandomCategory()
        const duration = performance.now() - startTime
        timings.push(duration)
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)
      const minTime = Math.min(...timings)

      expect(avgTime).toBeLessThan(PERFORMANCE_BASELINES.categoryGeneration.max)
      expect(maxTime).toBeLessThan(PERFORMANCE_BASELINES.categoryGeneration.max * 2)
      
      console.log(`Category generation - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
      
      // Log performance trend
      const performance95th = timings.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
      console.log(`95th percentile: ${performance95th.toFixed(2)}ms`)
    })

    it('should not regress letter generation performance', () => {
      const iterations = 100
      const timings = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        letterGenerator.generateLetter()
        const duration = performance.now() - startTime
        timings.push(duration)
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)

      expect(avgTime).toBeLessThan(PERFORMANCE_BASELINES.letterGeneration.max)
      expect(maxTime).toBeLessThan(PERFORMANCE_BASELINES.letterGeneration.max * 3) // Allow some variance
      
      console.log(`Letter generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
    })

    it('should not regress combination generation performance', async () => {
      const iterations = 15
      const timings = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await combinationGenerator.generateCombination()
        const duration = performance.now() - startTime
        timings.push(duration)
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)

      expect(avgTime).toBeLessThan(PERFORMANCE_BASELINES.combinationGeneration.max)
      expect(maxTime).toBeLessThan(PERFORMANCE_BASELINES.combinationGeneration.max * 1.5)
      
      console.log(`Combination generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
    })
  })

  describe('Batch Operation Regression Tests', () => {
    it('should maintain batch generation performance', async () => {
      const batchSize = 5
      const iterations = 5

      const timings = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await combinationGenerator.generateRounds(batchSize)
        const duration = performance.now() - startTime
        timings.push(duration)
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)

      expect(avgTime).toBeLessThan(PERFORMANCE_BASELINES.batchRoundGeneration.max)
      expect(maxTime).toBeLessThan(PERFORMANCE_BASELINES.batchRoundGeneration.max * 1.5)
      
      console.log(`Batch generation (${batchSize} rounds) - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
    })

    it('should scale batch operations linearly', async () => {
      const batchSizes = [1, 3, 5, 10]
      const timings = []

      for (const batchSize of batchSizes) {
        const startTime = performance.now()
        await combinationGenerator.generateRounds(batchSize)
        const duration = performance.now() - startTime
        const timePerItem = duration / batchSize

        timings.push({
          batchSize,
          totalTime: duration,
          timePerItem
        })
      }

      // Check that per-item time doesn't increase dramatically with batch size
      const firstPerItem = timings[0].timePerItem
      const lastPerItem = timings[timings.length - 1].timePerItem
      const scalingFactor = lastPerItem / firstPerItem

      expect(scalingFactor).toBeLessThan(2.0) // Should scale reasonably

      console.log('Batch scaling performance:')
      timings.forEach(timing => {
        console.log(`  ${timing.batchSize} items: ${timing.timePerItem.toFixed(2)}ms per item`)
      })
    })
  })

  describe('Memory Usage Regression Tests', () => {
    it('should not have memory leaks in repeated operations', async () => {
      if (!performance.memory) {
        console.log('Memory API not available, skipping memory regression test')
        return
      }

      // Force initial garbage collection if possible
      if (global.gc) global.gc()

      const initialMemory = performance.memory.usedJSHeapSize
      const iterations = 50

      // Perform operations
      for (let i = 0; i < iterations; i++) {
        await combinationGenerator.generateCombination()
        
        // Periodic cleanup
        if (i % 10 === 9) {
          if (global.gc) global.gc()
        }
      }

      // Final cleanup
      if (global.gc) global.gc()

      const finalMemory = performance.memory.usedJSHeapSize
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024)

      expect(memoryIncrease).toBeLessThan(MEMORY_BASELINES.sustainedOperations.max)
      
      console.log(`Memory regression test (${iterations} operations): ${memoryIncrease.toFixed(2)}MB increase`)
    })

    it('should maintain memory efficiency in concurrent operations', async () => {
      if (!performance.memory) {
        console.log('Memory API not available, skipping concurrent memory test')
        return
      }

      if (global.gc) global.gc()

      const initialMemory = performance.memory.usedJSHeapSize
      const concurrentOperations = 20

      // Run concurrent operations
      const promises = Array.from({ length: concurrentOperations }, () =>
        combinationGenerator.generateCombination()
      )

      await Promise.all(promises)

      if (global.gc) global.gc()

      const finalMemory = performance.memory.usedJSHeapSize
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024)

      expect(memoryIncrease).toBeLessThan(MEMORY_BASELINES.batchOperations.max)
      
      console.log(`Concurrent memory test (${concurrentOperations} ops): ${memoryIncrease.toFixed(2)}MB increase`)
    })
  })

  describe('Performance Trend Analysis', () => {
    it('should track performance trends over multiple runs', async () => {
      const runs = 10
      const operationsPerRun = 5
      const runTimings = []

      for (let run = 0; run < runs; run++) {
        const runStart = performance.now()
        
        for (let i = 0; i < operationsPerRun; i++) {
          await combinationGenerator.generateCombination()
        }
        
        const runTime = performance.now() - runStart
        const avgTimePerOp = runTime / operationsPerRun
        
        runTimings.push({
          run,
          totalTime: runTime,
          avgTimePerOp
        })
      }

      // Calculate trend metrics
      const firstHalfAvg = runTimings.slice(0, Math.floor(runs / 2))
        .reduce((sum, timing) => sum + timing.avgTimePerOp, 0) / Math.floor(runs / 2)
      
      const secondHalfAvg = runTimings.slice(Math.floor(runs / 2))
        .reduce((sum, timing) => sum + timing.avgTimePerOp, 0) / Math.ceil(runs / 2)

      const trend = secondHalfAvg / firstHalfAvg

      // Performance should not degrade over time (trend should be close to 1.0)
      expect(trend).toBeLessThan(1.5) // Allow some variance but not major degradation
      
      console.log(`Performance trend analysis over ${runs} runs:`)
      console.log(`  First half average: ${firstHalfAvg.toFixed(2)}ms`)
      console.log(`  Second half average: ${secondHalfAvg.toFixed(2)}ms`)
      console.log(`  Trend factor: ${trend.toFixed(2)}x`)
    })
  })

  describe('Performance Baseline Validation', () => {
    it('should meet all performance targets', async () => {
      const results = {}

      // Category generation
      let startTime = performance.now()
      await categoryManager.getRandomCategory()
      results.categoryGeneration = performance.now() - startTime

      // Letter generation
      startTime = performance.now()
      letterGenerator.generateLetter()
      results.letterGeneration = performance.now() - startTime

      // Combination generation
      startTime = performance.now()
      await combinationGenerator.generateCombination()
      results.combinationGeneration = performance.now() - startTime

      // Batch generation
      startTime = performance.now()
      await combinationGenerator.generateRounds(3)
      results.batchGeneration = performance.now() - startTime

      // Validate against targets
      expect(results.categoryGeneration).toBeLessThan(PERFORMANCE_BASELINES.categoryGeneration.target)
      expect(results.letterGeneration).toBeLessThan(PERFORMANCE_BASELINES.letterGeneration.target)
      expect(results.combinationGeneration).toBeLessThan(PERFORMANCE_BASELINES.combinationGeneration.target)
      expect(results.batchGeneration).toBeLessThan(PERFORMANCE_BASELINES.batchRoundGeneration.target)

      console.log('Performance baseline validation:')
      Object.entries(results).forEach(([operation, time]) => {
        const baseline = PERFORMANCE_BASELINES[operation]
        const status = time < baseline.target ? '✓' : (time < baseline.max ? '⚠' : '✗')
        console.log(`  ${status} ${operation}: ${time.toFixed(2)}ms (target: ${baseline.target}ms, max: ${baseline.max}ms)`)
      })
    })
  })
})