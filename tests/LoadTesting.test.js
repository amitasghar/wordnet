// Load testing scenarios for concurrent usage
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CategoryDataManager } from '../src/managers/CategoryDataManager.js'
import { CombinationGenerator } from '../src/managers/CombinationGenerator.js'
import { LetterGenerator } from '../src/managers/LetterGenerator.js'
import { UnifiedDataManager } from '../src/managers/UnifiedDataManager.js'

describe('Load Testing Scenarios', () => {
  let categoryManager, letterGenerator, combinationGenerator, unifiedManager
  const CONCURRENT_USERS = 10
  const REQUESTS_PER_USER = 5

  beforeEach(() => {
    categoryManager = new CategoryDataManager()
    letterGenerator = new LetterGenerator()
    combinationGenerator = new CombinationGenerator(categoryManager, letterGenerator)
    unifiedManager = new UnifiedDataManager()
  })

  afterEach(() => {
    // Clean up resources
    if (unifiedManager) {
      unifiedManager.cleanup?.()
    }
  })

  describe('Concurrent User Simulation', () => {
    it('should handle multiple users generating combinations simultaneously', async () => {
      const users = Array.from({ length: CONCURRENT_USERS }, (_, i) => ({
        id: i,
        requests: []
      }))

      const startTime = performance.now()
      
      // Simulate each user making multiple requests
      const allPromises = users.flatMap(user => 
        Array.from({ length: REQUESTS_PER_USER }, () =>
          combinationGenerator.generateCombination().then(result => ({
            userId: user.id,
            result,
            timestamp: performance.now()
          }))
        )
      )

      const results = await Promise.all(allPromises)
      const totalDuration = performance.now() - startTime
      
      expect(results).toHaveLength(CONCURRENT_USERS * REQUESTS_PER_USER)
      expect(totalDuration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify all users got valid results
      const userResults = results.reduce((acc, result) => {
        if (!acc[result.userId]) acc[result.userId] = []
        acc[result.userId].push(result)
        return acc
      }, {})
      
      expect(Object.keys(userResults)).toHaveLength(CONCURRENT_USERS)
      
      console.log(`Concurrent load test: ${CONCURRENT_USERS} users × ${REQUESTS_PER_USER} requests = ${results.length} total`)
      console.log(`Total time: ${totalDuration.toFixed(2)}ms`)
      console.log(`Average per request: ${(totalDuration / results.length).toFixed(2)}ms`)
    })

    it('should maintain data consistency under concurrent load', async () => {
      const promises = []
      const startTime = performance.now()
      
      // Create multiple managers to simulate different sessions
      for (let i = 0; i < CONCURRENT_USERS; i++) {
        const sessionManager = new CombinationGenerator(categoryManager, letterGenerator)
        
        for (let j = 0; j < REQUESTS_PER_USER; j++) {
          promises.push(
            sessionManager.generateCombination().then(combo => ({
              session: i,
              request: j,
              category: combo.category,
              letter: combo.letter,
              timestamp: performance.now()
            }))
          )
        }
      }
      
      const results = await Promise.all(promises)
      const duration = performance.now() - startTime
      
      // Verify data integrity
      results.forEach(result => {
        expect(result.category).toHaveProperty('name')
        expect(result.category).toHaveProperty('difficulty')
        expect(typeof result.letter).toBe('string')
        expect(result.letter).toHaveLength(1)
      })
      
      // Check for reasonable distribution
      const categories = new Set(results.map(r => r.category.name))
      const letters = new Set(results.map(r => r.letter))
      
      expect(categories.size).toBeGreaterThan(1) // Should have variety
      expect(letters.size).toBeGreaterThan(1) // Should have variety
      
      console.log(`Data consistency test: ${results.length} results in ${duration.toFixed(2)}ms`)
      console.log(`Categories used: ${categories.size}, Letters used: ${letters.size}`)
    })
  })

  describe('Resource Exhaustion Testing', () => {
    it('should handle memory pressure gracefully', async () => {
      if (!performance.memory) {
        console.log('Memory API not available, skipping memory pressure test')
        return
      }

      const initialMemory = performance.memory.usedJSHeapSize
      const results = []
      let memoryPeak = initialMemory

      try {
        // Generate many objects to create memory pressure
        for (let batch = 0; batch < 10; batch++) {
          const batchResults = await Promise.all(
            Array.from({ length: 100 }, () => combinationGenerator.generateCombination())
          )
          
          results.push(...batchResults)
          
          const currentMemory = performance.memory.usedJSHeapSize
          memoryPeak = Math.max(memoryPeak, currentMemory)
          
          // Check if system is still responsive
          const testStart = performance.now()
          await combinationGenerator.generateCombination()
          const testDuration = performance.now() - testStart
          
          expect(testDuration).toBeLessThan(500) // Should still be responsive
        }
        
        const memoryIncrease = (memoryPeak - initialMemory) / (1024 * 1024)
        console.log(`Memory pressure test: Peak increase ${memoryIncrease.toFixed(2)}MB`)
        console.log(`Generated ${results.length} combinations`)
        
      } catch (error) {
        console.log(`Memory pressure handling: ${error.message}`)
        expect(error.message).toContain('memory') // Should be a graceful memory-related error
      }
    })

    it('should handle rapid successive requests without degradation', async () => {
      const batchSizes = [10, 25, 50, 100]
      const timings = []

      for (const batchSize of batchSizes) {
        const startTime = performance.now()
        
        const promises = Array.from({ length: batchSize }, () => 
          combinationGenerator.generateCombination()
        )
        
        await Promise.all(promises)
        const batchTime = performance.now() - startTime
        const avgTime = batchTime / batchSize
        
        timings.push({
          batchSize,
          totalTime: batchTime,
          avgTime
        })
        
        expect(avgTime).toBeLessThan(150) // Performance shouldn't degrade significantly
      }

      // Check that performance doesn't degrade dramatically with size
      const firstAvg = timings[0].avgTime
      const lastAvg = timings[timings.length - 1].avgTime
      const degradationRatio = lastAvg / firstAvg

      expect(degradationRatio).toBeLessThan(3.0) // Less than 3x degradation

      console.log('Batch size performance:')
      timings.forEach(timing => {
        console.log(`  ${timing.batchSize}: ${timing.avgTime.toFixed(2)}ms avg`)
      })
    })
  })

  describe('System Integration Load Testing', () => {
    it('should handle full system load with UnifiedDataManager', async () => {
      await unifiedManager.initialize()
      
      const operations = [
        'generateRound',
        'validateWord',
        'getCategoryData',
        'updateGameState'
      ]
      
      const promises = []
      const results = []
      const startTime = performance.now()

      // Simulate mixed operations
      for (let i = 0; i < 50; i++) {
        const operation = operations[i % operations.length]
        
        switch (operation) {
          case 'generateRound':
            promises.push(
              unifiedManager.generateUnifiedRound().then(result => 
                results.push({ operation, success: !!result, timestamp: performance.now() })
              )
            )
            break
            
          case 'validateWord':
            promises.push(
              Promise.resolve().then(() => {
                const isValid = unifiedManager.validateWordUnified?.('test', 'A', { name: 'Animals' })
                results.push({ operation, success: isValid !== undefined, timestamp: performance.now() })
              })
            )
            break
            
          case 'getCategoryData':
            promises.push(
              Promise.resolve().then(() => {
                const data = unifiedManager.getUnifiedCategoryData?.()
                results.push({ operation, success: !!data, timestamp: performance.now() })
              })
            )
            break
            
          case 'updateGameState':
            promises.push(
              Promise.resolve().then(() => {
                const updated = unifiedManager.updateSystemStatus?.('active')
                results.push({ operation, success: updated !== false, timestamp: performance.now() })
              })
            )
            break
        }
      }

      await Promise.allSettled(promises)
      const totalTime = performance.now() - startTime

      expect(results.length).toBeGreaterThan(0)
      
      const successRate = results.filter(r => r.success).length / results.length
      expect(successRate).toBeGreaterThan(0.8) // At least 80% success rate under load
      
      console.log(`System integration load test: ${totalTime.toFixed(2)}ms`)
      console.log(`Operations completed: ${results.length}`)
      console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`)
    })

    it('should maintain performance during sustained operations', async () => {
      const testDuration = 2000 // 2 seconds
      const operations = []
      const startTime = performance.now()
      let currentTime = startTime

      // Run operations for the test duration
      while (currentTime - startTime < testDuration) {
        const operationStart = performance.now()
        
        try {
          await combinationGenerator.generateCombination()
          const operationTime = performance.now() - operationStart
          
          operations.push({
            duration: operationTime,
            timestamp: operationStart,
            success: true
          })
        } catch (error) {
          operations.push({
            duration: performance.now() - operationStart,
            timestamp: operationStart,
            success: false,
            error: error.message
          })
        }
        
        currentTime = performance.now()
        
        // Small delay to prevent overwhelming
        if (operations.length % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }

      const totalOperations = operations.length
      const successfulOperations = operations.filter(op => op.success).length
      const avgDuration = operations.reduce((sum, op) => sum + op.duration, 0) / totalOperations
      const successRate = successfulOperations / totalOperations

      expect(successRate).toBeGreaterThan(0.9) // 90% success rate
      expect(avgDuration).toBeLessThan(200) // Average under 200ms
      
      console.log(`Sustained operations test (${testDuration}ms):`)
      console.log(`  Total operations: ${totalOperations}`)
      console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`)
      console.log(`  Average duration: ${avgDuration.toFixed(2)}ms`)
      console.log(`  Operations per second: ${(totalOperations / (testDuration / 1000)).toFixed(1)}`)
    })
  })

  describe('Error Recovery Under Load', () => {
    it('should recover from transient failures', async () => {
      let failureCount = 0
      const maxFailures = 5
      
      // Mock a method to occasionally fail
      const originalGenerate = combinationGenerator.generateCombination
      combinationGenerator.generateCombination = async () => {
        if (failureCount < maxFailures && Math.random() < 0.1) { // 10% failure rate
          failureCount++
          throw new Error('Simulated transient failure')
        }
        return originalGenerate.call(combinationGenerator)
      }

      const attempts = 100
      const results = []
      const errors = []

      const promises = Array.from({ length: attempts }, async () => {
        try {
          const result = await combinationGenerator.generateCombination()
          results.push(result)
        } catch (error) {
          errors.push(error)
        }
      })

      await Promise.allSettled(promises)

      // Restore original method
      combinationGenerator.generateCombination = originalGenerate

      const successRate = results.length / attempts
      expect(successRate).toBeGreaterThan(0.85) // Should handle failures gracefully
      expect(errors.length).toBeLessThanOrEqual(maxFailures)

      console.log(`Error recovery test: ${results.length}/${attempts} successful (${(successRate * 100).toFixed(1)}%)`)
      console.log(`Simulated failures: ${errors.length}`)
    })
  })
})