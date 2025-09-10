// Production performance verification tests
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'
import { LetterGenerator } from '../src/managers/LetterGenerator.js'
import { CombinationGenerator } from '../src/managers/CombinationGenerator.js'
import { UnifiedDataManager } from '../src/managers/UnifiedDataManager.js'
import { performanceMonitor, usageAnalytics } from '../src/utils/PerformanceMonitor.js'
import { productionHealthCheck } from '../src/utils/ProductionHealthCheck.js'
import { configManager } from '../src/utils/ConfigurationManager.js'

describe('Production Performance Verification', () => {
  let categoryManager, letterGenerator, combinationGenerator, unifiedManager
  
  // Production performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    // Core operations - must be under 100ms
    categoryGeneration: 100,
    letterGeneration: 100,
    combinationGeneration: 100,
    
    // Batch operations - scaled thresholds
    batchCategoryGeneration: 500, // 5 operations
    batchLetterGeneration: 200, // 10 operations  
    batchCombinationGeneration: 800, // 8 operations
    
    // System operations
    systemInitialization: 2000,
    healthCheck: 1000,
    configurationLoad: 500
  }
  
  // Memory thresholds (in MB)
  const MEMORY_THRESHOLDS = {
    singleOperation: 1,
    batchOperations: 5,
    sustainedOperations: 10,
    systemOverhead: 50
  }

  beforeAll(async () => {
    // Initialize performance monitoring
    performanceMonitor.reset()
    usageAnalytics.reset()
    
    // Initialize managers
    categoryManager = new CategoryDataManager()
    letterGenerator = new LetterGenerator()
    combinationGenerator = new CombinationGenerator(categoryManager, letterGenerator)
    unifiedManager = new UnifiedDataManager()
    
    await categoryManager.init()
    await letterGenerator.init()
    await combinationGenerator.init()
    await unifiedManager.initialize()
  })

  afterAll(() => {
    // Cleanup
    categoryManager?.cleanup?.()
    letterGenerator?.cleanup?.()
    combinationGenerator?.cleanup?.()
    unifiedManager?.cleanup?.()
    
    performanceMonitor.destroy()
    usageAnalytics.destroy()
  })

  beforeEach(() => {
    // Clear any cached data to ensure consistent test conditions
    if (global.gc) {
      global.gc()
    }
  })

  describe('Core Operation Performance Requirements', () => {
    it('should generate categories under 100ms consistently', async () => {
      const iterations = 20
      const timings = []
      
      for (let i = 0; i < iterations; i++) {
        const timer = performanceMonitor.startTimer('category_generation_test')
        
        const category = await categoryManager.getRandomCategory()
        const duration = timer.end()
        
        expect(category).toBeDefined()
        expect(category.name).toBeDefined()
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.categoryGeneration)
        
        timings.push(duration)
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)
      const p95Time = timings.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
      
      // All metrics should meet production requirements
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.categoryGeneration * 0.5)
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.categoryGeneration)
      expect(p95Time).toBeLessThan(PERFORMANCE_THRESHOLDS.categoryGeneration * 0.8)
      
      console.log(`Category Generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`)
    })

    it('should generate letters under 100ms consistently', () => {
      const iterations = 50
      const timings = []
      
      for (let i = 0; i < iterations; i++) {
        const timer = performanceMonitor.startTimer('letter_generation_test')
        
        const letter = letterGenerator.generateLetter()
        const duration = timer.end()
        
        expect(letter).toBeDefined()
        expect(typeof letter).toBe('string')
        expect(letter).toHaveLength(1)
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.letterGeneration)
        
        timings.push(duration)
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.letterGeneration * 0.2)
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.letterGeneration)
      
      console.log(`Letter Generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
    })

    it('should generate combinations under 100ms consistently', async () => {
      const iterations = 15
      const timings = []
      
      for (let i = 0; i < iterations; i++) {
        const timer = performanceMonitor.startTimer('combination_generation_test')
        
        const combination = await combinationGenerator.generateCombination()
        const duration = timer.end()
        
        expect(combination).toBeDefined()
        expect(combination.category).toBeDefined()
        expect(combination.letter).toBeDefined()
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration)
        
        timings.push(duration)
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
      const maxTime = Math.max(...timings)
      const p95Time = timings.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration * 0.7)
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration)
      expect(p95Time).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration * 0.9)
      
      console.log(`Combination Generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`)
    })
  })

  describe('Batch Operation Performance Requirements', () => {
    it('should handle batch category operations efficiently', async () => {
      const batchSize = 5
      
      const timer = performanceMonitor.startTimer('batch_category_operations')
      
      const promises = Array.from({ length: batchSize }, () => 
        categoryManager.getRandomCategory()
      )
      
      const results = await Promise.all(promises)
      const duration = timer.end()
      
      expect(results).toHaveLength(batchSize)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.batchCategoryGeneration)
      
      const avgTimePerOperation = duration / batchSize
      expect(avgTimePerOperation).toBeLessThan(PERFORMANCE_THRESHOLDS.categoryGeneration)
      
      console.log(`Batch Categories (${batchSize}) - Total: ${duration.toFixed(2)}ms, Avg: ${avgTimePerOperation.toFixed(2)}ms`)
    })

    it('should handle batch letter generation efficiently', () => {
      const batchSize = 10
      
      const timer = performanceMonitor.startTimer('batch_letter_operations')
      
      const letters = []
      for (let i = 0; i < batchSize; i++) {
        letters.push(letterGenerator.generateLetter())
      }
      
      const duration = timer.end()
      
      expect(letters).toHaveLength(batchSize)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.batchLetterGeneration)
      
      const avgTimePerOperation = duration / batchSize
      expect(avgTimePerOperation).toBeLessThan(PERFORMANCE_THRESHOLDS.letterGeneration)
      
      console.log(`Batch Letters (${batchSize}) - Total: ${duration.toFixed(2)}ms, Avg: ${avgTimePerOperation.toFixed(2)}ms`)
    })

    it('should handle batch combination generation efficiently', async () => {
      const batchSize = 8
      
      const timer = performanceMonitor.startTimer('batch_combination_operations')
      
      const promises = Array.from({ length: batchSize }, () => 
        combinationGenerator.generateCombination()
      )
      
      const results = await Promise.all(promises)
      const duration = timer.end()
      
      expect(results).toHaveLength(batchSize)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.batchCombinationGeneration)
      
      const avgTimePerOperation = duration / batchSize
      expect(avgTimePerOperation).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration)
      
      console.log(`Batch Combinations (${batchSize}) - Total: ${duration.toFixed(2)}ms, Avg: ${avgTimePerOperation.toFixed(2)}ms`)
    })
  })

  describe('System Performance Requirements', () => {
    it('should initialize system components within acceptable time', async () => {
      const timer = performanceMonitor.startTimer('system_initialization')
      
      // Test full system initialization
      const testManager = new UnifiedDataManager()
      await testManager.initialize()
      
      const duration = timer.end()
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.systemInitialization)
      expect(testManager.isInitialized()).toBe(true)
      
      console.log(`System Initialization: ${duration.toFixed(2)}ms`)
      
      // Cleanup
      testManager.cleanup?.()
    })

    it('should perform health checks within acceptable time', async () => {
      const timer = performanceMonitor.startTimer('health_check_performance')
      
      await productionHealthCheck.initialize()
      const healthStatus = await productionHealthCheck.runHealthChecks()
      
      const duration = timer.end()
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.healthCheck)
      expect(healthStatus).toBeDefined()
      
      console.log(`Health Check: ${duration.toFixed(2)}ms`)
    })

    it('should load configuration within acceptable time', () => {
      const timer = performanceMonitor.startTimer('configuration_load')
      
      const config = configManager.getAll()
      const validation = configManager.validate()
      
      const duration = timer.end()
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.configurationLoad)
      expect(config).toBeDefined()
      expect(validation.valid).toBe(true)
      
      console.log(`Configuration Load: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage Verification', () => {
    it('should maintain acceptable memory usage for single operations', async () => {
      if (!performance.memory) {
        console.log('Memory API not available, skipping memory test')
        return
      }
      
      if (global.gc) global.gc()
      
      const initialMemory = performance.memory.usedJSHeapSize
      
      // Perform single operations
      await categoryManager.getRandomCategory()
      letterGenerator.generateLetter()
      await combinationGenerator.generateCombination()
      
      if (global.gc) global.gc()
      
      const finalMemory = performance.memory.usedJSHeapSize
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024) // MB
      
      expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.singleOperation)
      
      console.log(`Single Operations Memory Usage: ${memoryIncrease.toFixed(2)}MB`)
    })

    it('should maintain acceptable memory usage for batch operations', async () => {
      if (!performance.memory) {
        console.log('Memory API not available, skipping memory test')
        return
      }
      
      if (global.gc) global.gc()
      
      const initialMemory = performance.memory.usedJSHeapSize
      
      // Perform batch operations
      const batchSize = 20
      const promises = []
      
      for (let i = 0; i < batchSize; i++) {
        promises.push(combinationGenerator.generateCombination())
      }
      
      await Promise.all(promises)
      
      if (global.gc) global.gc()
      
      const finalMemory = performance.memory.usedJSHeapSize
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024) // MB
      
      expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.batchOperations)
      
      console.log(`Batch Operations Memory Usage: ${memoryIncrease.toFixed(2)}MB`)
    })
  })

  describe('Sustained Performance Verification', () => {
    it('should maintain performance under sustained load', async () => {
      const testDuration = 3000 // 3 seconds
      const operations = []
      const memorySnapshots = []
      
      const startTime = performance.now()
      let operationCount = 0
      
      // Record initial memory
      if (performance.memory) {
        memorySnapshots.push(performance.memory.usedJSHeapSize)
      }
      
      while (performance.now() - startTime < testDuration) {
        const operationStart = performance.now()
        
        try {
          await combinationGenerator.generateCombination()
          const operationTime = performance.now() - operationStart
          
          operations.push({
            duration: operationTime,
            timestamp: operationStart,
            success: true
          })
          
          operationCount++
          
          // Memory snapshot every 50 operations
          if (operationCount % 50 === 0 && performance.memory) {
            memorySnapshots.push(performance.memory.usedJSHeapSize)
          }
          
        } catch (error) {
          operations.push({
            duration: performance.now() - operationStart,
            timestamp: operationStart,
            success: false,
            error: error.message
          })
        }
        
        // Small delay to prevent overwhelming
        if (operationCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }
      
      const totalTime = performance.now() - startTime
      const successfulOperations = operations.filter(op => op.success)
      const avgDuration = successfulOperations.reduce((sum, op) => sum + op.duration, 0) / successfulOperations.length
      const maxDuration = Math.max(...successfulOperations.map(op => op.duration))
      const successRate = successfulOperations.length / operations.length
      
      // Performance requirements
      expect(successRate).toBeGreaterThan(0.95) // 95% success rate
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration)
      expect(maxDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration * 2) // Allow some variance
      
      // Memory requirements
      if (memorySnapshots.length > 1) {
        const initialMemory = memorySnapshots[0]
        const finalMemory = memorySnapshots[memorySnapshots.length - 1]
        const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024) // MB
        
        expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLDS.sustainedOperations)
        
        console.log(`Sustained Load Memory Increase: ${memoryIncrease.toFixed(2)}MB`)
      }
      
      const operationsPerSecond = operationCount / (totalTime / 1000)
      
      console.log(`Sustained Load Test (${totalTime.toFixed(0)}ms):`)
      console.log(`  Operations: ${operationCount}`)
      console.log(`  Success Rate: ${(successRate * 100).toFixed(1)}%`)
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`)
      console.log(`  Max Duration: ${maxDuration.toFixed(2)}ms`)
      console.log(`  Ops/sec: ${operationsPerSecond.toFixed(1)}`)
    })

    it('should maintain stable performance over time', async () => {
      const testBatches = 10
      const operationsPerBatch = 5
      const batchTimings = []
      
      for (let batch = 0; batch < testBatches; batch++) {
        const batchStart = performance.now()
        
        const promises = Array.from({ length: operationsPerBatch }, () =>
          combinationGenerator.generateCombination()
        )
        
        await Promise.all(promises)
        const batchTime = performance.now() - batchStart
        
        batchTimings.push({
          batch,
          totalTime: batchTime,
          avgTime: batchTime / operationsPerBatch
        })
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const firstHalfAvg = batchTimings.slice(0, 5)
        .reduce((sum, timing) => sum + timing.avgTime, 0) / 5
      
      const secondHalfAvg = batchTimings.slice(5)
        .reduce((sum, timing) => sum + timing.avgTime, 0) / 5
      
      const performanceDrift = secondHalfAvg / firstHalfAvg
      
      // Performance should not degrade more than 50% over time
      expect(performanceDrift).toBeLessThan(1.5)
      
      // All batch averages should meet requirements
      batchTimings.forEach(timing => {
        expect(timing.avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration)
      })
      
      console.log('Performance Stability Analysis:')
      console.log(`  First Half Average: ${firstHalfAvg.toFixed(2)}ms`)
      console.log(`  Second Half Average: ${secondHalfAvg.toFixed(2)}ms`)
      console.log(`  Performance Drift: ${performanceDrift.toFixed(2)}x`)
    })
  })

  describe('Production Environment Validation', () => {
    it('should meet all production performance baselines', async () => {
      const performanceReport = {
        timestamp: Date.now(),
        thresholds: PERFORMANCE_THRESHOLDS,
        results: {}
      }
      
      // Test all critical operations
      const tests = [
        { name: 'categoryGeneration', fn: () => categoryManager.getRandomCategory(), threshold: PERFORMANCE_THRESHOLDS.categoryGeneration },
        { name: 'letterGeneration', fn: () => letterGenerator.generateLetter(), threshold: PERFORMANCE_THRESHOLDS.letterGeneration },
        { name: 'combinationGeneration', fn: () => combinationGenerator.generateCombination(), threshold: PERFORMANCE_THRESHOLDS.combinationGeneration }
      ]
      
      for (const test of tests) {
        const iterations = 10
        const timings = []
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now()
          await test.fn()
          const duration = performance.now() - startTime
          timings.push(duration)
        }
        
        const avgTime = timings.reduce((a, b) => a + b, 0) / iterations
        const maxTime = Math.max(...timings)
        const p95Time = timings.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
        
        performanceReport.results[test.name] = {
          avgTime,
          maxTime,
          p95Time,
          threshold: test.threshold,
          passed: p95Time < test.threshold
        }
        
        expect(p95Time).toBeLessThan(test.threshold)
      }
      
      // System integration test
      const systemTimer = performanceMonitor.startTimer('full_system_integration')
      
      // Simulate a full game round
      const combination = await combinationGenerator.generateCombination()
      const category = await categoryManager.getCategoriesByDifficulty(3)
      const letters = Array.from({ length: 5 }, () => letterGenerator.generateLetter())
      
      const systemDuration = systemTimer.end()
      
      performanceReport.results.systemIntegration = {
        duration: systemDuration,
        threshold: 500,
        passed: systemDuration < 500
      }
      
      expect(systemDuration).toBeLessThan(500)
      
      // Log comprehensive performance report
      console.log('Production Performance Baseline Report:')
      Object.entries(performanceReport.results).forEach(([test, result]) => {
        const status = result.passed ? '✓' : '✗'
        console.log(`  ${status} ${test}: ${result.avgTime?.toFixed(2) || result.duration?.toFixed(2)}ms (threshold: ${result.threshold}ms)`)
      })
      
      // All tests must pass for production readiness
      const allPassed = Object.values(performanceReport.results).every(result => result.passed)
      expect(allPassed).toBe(true)
    })

    it('should verify system resilience under various conditions', async () => {
      const conditions = [
        { name: 'normal', memoryPressure: false, concurrentOperations: 1 },
        { name: 'concurrent', memoryPressure: false, concurrentOperations: 10 },
        { name: 'memory_pressure', memoryPressure: true, concurrentOperations: 1 },
        { name: 'stress', memoryPressure: true, concurrentOperations: 5 }
      ]
      
      const results = {}
      
      for (const condition of conditions) {
        let operations = []
        
        if (condition.memoryPressure) {
          // Create some memory pressure
          const memoryPressure = Array.from({ length: 10000 }, () => ({
            data: new Array(100).fill(Math.random())
          }))
        }
        
        const startTime = performance.now()
        
        const promises = Array.from({ length: condition.concurrentOperations }, () =>
          combinationGenerator.generateCombination()
        )
        
        const operationResults = await Promise.all(promises)
        const duration = performance.now() - startTime
        
        const avgTime = duration / condition.concurrentOperations
        
        results[condition.name] = {
          totalTime: duration,
          avgTime,
          concurrentOperations: condition.concurrentOperations,
          success: operationResults.every(result => result && result.category && result.letter)
        }
        
        // Cleanup memory pressure
        if (condition.memoryPressure && global.gc) {
          global.gc()
        }
        
        // All conditions should maintain acceptable performance
        expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.combinationGeneration * 1.5)
        expect(results[condition.name].success).toBe(true)
      }
      
      console.log('System Resilience Test Results:')
      Object.entries(results).forEach(([condition, result]) => {
        console.log(`  ${condition}: ${result.avgTime.toFixed(2)}ms avg (${result.concurrentOperations} ops)`)
      })
    })
  })
})