// Performance monitoring and analytics system
export class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false
    this.sampleRate = options.sampleRate || 1.0 // Sample 100% by default
    this.maxMetrics = options.maxMetrics || 1000
    this.flushInterval = options.flushInterval || 60000 // 1 minute
    
    this.metrics = new Map()
    this.timings = new Map()
    this.counters = new Map()
    this.gauges = new Map()
    this.histograms = new Map()
    
    this.sessionId = this.generateSessionId()
    this.startTime = performance.now()
    
    // Auto-flush metrics
    if (this.enabled && this.flushInterval > 0) {
      this.flushIntervalId = setInterval(() => this.flush(), this.flushInterval)
    }
    
    // System performance tracking
    this.systemMetrics = {
      memoryUsage: [],
      frameRate: [],
      systemLoad: []
    }
    
    this.startSystemMonitoring()
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Record a timing metric
   */
  timing(name, duration, tags = {}) {
    if (!this.enabled || Math.random() > this.sampleRate) return

    if (!this.timings.has(name)) {
      this.timings.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        samples: [],
        tags: new Set()
      })
    }

    const metric = this.timings.get(name)
    metric.count++
    metric.total += duration
    metric.min = Math.min(metric.min, duration)
    metric.max = Math.max(metric.max, duration)
    
    // Keep recent samples for percentile calculations
    metric.samples.push({ duration, timestamp: Date.now(), tags })
    if (metric.samples.length > 100) {
      metric.samples.shift()
    }
    
    // Track unique tags
    Object.keys(tags).forEach(tag => metric.tags.add(`${tag}:${tags[tag]}`))
  }

  /**
   * Start timing an operation
   */
  startTimer(name) {
    if (!this.enabled) return null
    
    const startTime = performance.now()
    return {
      end: (tags = {}) => {
        const duration = performance.now() - startTime
        this.timing(name, duration, tags)
        return duration
      }
    }
  }

  /**
   * Increment a counter
   */
  increment(name, value = 1, tags = {}) {
    if (!this.enabled) return

    if (!this.counters.has(name)) {
      this.counters.set(name, {
        value: 0,
        incrementCount: 0,
        tags: new Set()
      })
    }

    const counter = this.counters.get(name)
    counter.value += value
    counter.incrementCount++
    
    Object.keys(tags).forEach(tag => counter.tags.add(`${tag}:${tags[tag]}`))
  }

  /**
   * Set a gauge value
   */
  gauge(name, value, tags = {}) {
    if (!this.enabled) return

    this.gauges.set(name, {
      value,
      timestamp: Date.now(),
      tags
    })
  }

  /**
   * Record a histogram value
   */
  histogram(name, value, tags = {}) {
    if (!this.enabled) return

    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        values: [],
        count: 0,
        sum: 0,
        tags: new Set()
      })
    }

    const hist = this.histograms.get(name)
    hist.values.push({ value, timestamp: Date.now() })
    hist.count++
    hist.sum += value
    
    // Keep only recent values
    if (hist.values.length > 200) {
      hist.values.shift()
    }
    
    Object.keys(tags).forEach(tag => hist.tags.add(`${tag}:${tags[tag]}`))
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const summary = {
      sessionId: this.sessionId,
      sessionDuration: performance.now() - this.startTime,
      timestamp: Date.now(),
      timings: {},
      counters: {},
      gauges: {},
      histograms: {},
      system: this.getSystemSummary()
    }

    // Summarize timings
    for (const [name, metric] of this.timings) {
      const samples = metric.samples.map(s => s.duration).sort((a, b) => a - b)
      summary.timings[name] = {
        count: metric.count,
        average: metric.total / metric.count,
        min: metric.min,
        max: metric.max,
        p50: this.percentile(samples, 0.5),
        p95: this.percentile(samples, 0.95),
        p99: this.percentile(samples, 0.99),
        tags: Array.from(metric.tags)
      }
    }

    // Summarize counters
    for (const [name, counter] of this.counters) {
      summary.counters[name] = {
        value: counter.value,
        incrementCount: counter.incrementCount,
        tags: Array.from(counter.tags)
      }
    }

    // Copy gauges
    for (const [name, gauge] of this.gauges) {
      summary.gauges[name] = { ...gauge }
    }

    // Summarize histograms
    for (const [name, hist] of this.histograms) {
      const values = hist.values.map(v => v.value).sort((a, b) => a - b)
      summary.histograms[name] = {
        count: hist.count,
        sum: hist.sum,
        average: hist.sum / hist.count,
        min: Math.min(...values),
        max: Math.max(...values),
        p50: this.percentile(values, 0.5),
        p95: this.percentile(values, 0.95),
        tags: Array.from(hist.tags)
      }
    }

    return summary
  }

  /**
   * Calculate percentile
   */
  percentile(values, p) {
    if (values.length === 0) return 0
    const index = Math.ceil(values.length * p) - 1
    return values[Math.max(0, index)]
  }

  /**
   * Start system performance monitoring
   */
  startSystemMonitoring() {
    if (!this.enabled) return

    // Memory monitoring
    this.memoryMonitor = setInterval(() => {
      if (performance.memory) {
        const memory = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now()
        }
        
        this.systemMetrics.memoryUsage.push(memory)
        if (this.systemMetrics.memoryUsage.length > 100) {
          this.systemMetrics.memoryUsage.shift()
        }
        
        this.gauge('memory.used', memory.used / (1024 * 1024)) // MB
        this.gauge('memory.total', memory.total / (1024 * 1024)) // MB
      }
    }, 5000) // Every 5 seconds

    // Frame rate monitoring (if requestAnimationFrame is available)
    if (typeof requestAnimationFrame !== 'undefined') {
      this.frameCount = 0
      this.lastFrameTime = performance.now()
      
      const frameCallback = () => {
        this.frameCount++
        const now = performance.now()
        
        if (now - this.lastFrameTime >= 1000) { // Every second
          const fps = this.frameCount
          this.frameCount = 0
          this.lastFrameTime = now
          
          this.systemMetrics.frameRate.push({
            fps,
            timestamp: Date.now()
          })
          
          if (this.systemMetrics.frameRate.length > 60) {
            this.systemMetrics.frameRate.shift()
          }
          
          this.gauge('system.fps', fps)
        }
        
        requestAnimationFrame(frameCallback)
      }
      
      requestAnimationFrame(frameCallback)
    }
  }

  /**
   * Get system performance summary
   */
  getSystemSummary() {
    const summary = {}
    
    // Memory summary
    if (this.systemMetrics.memoryUsage.length > 0) {
      const recent = this.systemMetrics.memoryUsage.slice(-10) // Last 10 samples
      summary.memory = {
        currentUsed: recent[recent.length - 1]?.used || 0,
        averageUsed: recent.reduce((sum, m) => sum + m.used, 0) / recent.length,
        peakUsed: Math.max(...recent.map(m => m.used)),
        utilizationRatio: recent[recent.length - 1]?.used / recent[recent.length - 1]?.limit || 0
      }
    }
    
    // Frame rate summary
    if (this.systemMetrics.frameRate.length > 0) {
      const recent = this.systemMetrics.frameRate.slice(-30) // Last 30 seconds
      summary.frameRate = {
        current: recent[recent.length - 1]?.fps || 0,
        average: recent.reduce((sum, f) => sum + f.fps, 0) / recent.length,
        min: Math.min(...recent.map(f => f.fps)),
        max: Math.max(...recent.map(f => f.fps))
      }
    }
    
    return summary
  }

  /**
   * Flush metrics (can be extended to send to external service)
   */
  flush() {
    if (!this.enabled) return

    const summary = this.getSummary()
    
    // Log to console in development
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('Performance Summary:', summary)
    }
    
    // Emit event for external listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance:flush', { detail: summary }))
    }
    
    return summary
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear()
    this.timings.clear()
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this.systemMetrics = {
      memoryUsage: [],
      frameRate: [],
      systemLoad: []
    }
    this.startTime = performance.now()
  }

  /**
   * Destroy monitor and clean up
   */
  destroy() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId)
    }
    
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor)
    }
    
    this.reset()
    this.enabled = false
  }
}

// Usage analytics for tracking category and letter selection patterns
export class UsageAnalytics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false
    this.maxEvents = options.maxEvents || 2000
    this.sessionId = `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.events = []
    this.patterns = new Map()
    this.categories = new Map()
    this.letters = new Map()
    this.combinations = new Map()
    
    this.startTime = Date.now()
  }

  /**
   * Track an event
   */
  track(eventName, properties = {}) {
    if (!this.enabled) return

    const event = {
      name: eventName,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId
    }
    
    this.events.push(event)
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }
    
    // Update pattern tracking
    this.updatePatterns(eventName, properties)
  }

  /**
   * Track category selection
   */
  trackCategorySelection(category, context = {}) {
    this.track('category_selected', {
      categoryId: category.id,
      categoryName: category.name,
      difficulty: category.difficulty,
      ...context
    })
    
    // Update category usage stats
    if (!this.categories.has(category.id)) {
      this.categories.set(category.id, {
        id: category.id,
        name: category.name,
        difficulty: category.difficulty,
        count: 0,
        lastUsed: 0
      })
    }
    
    const categoryStats = this.categories.get(category.id)
    categoryStats.count++
    categoryStats.lastUsed = Date.now()
  }

  /**
   * Track letter generation
   */
  trackLetterGeneration(letter, strategy, context = {}) {
    this.track('letter_generated', {
      letter,
      strategy,
      ...context
    })
    
    // Update letter usage stats
    if (!this.letters.has(letter)) {
      this.letters.set(letter, {
        letter,
        count: 0,
        strategies: new Set(),
        lastUsed: 0
      })
    }
    
    const letterStats = this.letters.get(letter)
    letterStats.count++
    letterStats.strategies.add(strategy)
    letterStats.lastUsed = Date.now()
  }

  /**
   * Track combination usage
   */
  trackCombination(category, letter, context = {}) {
    const combinationKey = `${category.id}_${letter}`
    
    this.track('combination_used', {
      categoryId: category.id,
      categoryName: category.name,
      letter,
      difficulty: category.difficulty,
      ...context
    })
    
    // Update combination stats
    if (!this.combinations.has(combinationKey)) {
      this.combinations.set(combinationKey, {
        categoryId: category.id,
        categoryName: category.name,
        letter,
        difficulty: category.difficulty,
        count: 0,
        lastUsed: 0,
        success: 0,
        attempts: 0
      })
    }
    
    const comboStats = this.combinations.get(combinationKey)
    comboStats.count++
    comboStats.lastUsed = Date.now()
    
    if (context.success !== undefined) {
      comboStats.attempts++
      if (context.success) {
        comboStats.success++
      }
    }
  }

  /**
   * Update pattern tracking
   */
  updatePatterns(eventName, properties) {
    if (!this.patterns.has(eventName)) {
      this.patterns.set(eventName, {
        count: 0,
        properties: new Map(),
        sequences: []
      })
    }
    
    const pattern = this.patterns.get(eventName)
    pattern.count++
    
    // Track property distributions
    Object.entries(properties).forEach(([key, value]) => {
      if (!pattern.properties.has(key)) {
        pattern.properties.set(key, new Map())
      }
      
      const propMap = pattern.properties.get(key)
      propMap.set(value, (propMap.get(value) || 0) + 1)
    })
  }

  /**
   * Get usage insights
   */
  getInsights() {
    return {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.startTime,
      totalEvents: this.events.length,
      
      categories: {
        total: this.categories.size,
        mostUsed: this.getMostUsedCategories(5),
        byDifficulty: this.getCategoriesByDifficulty()
      },
      
      letters: {
        total: this.letters.size,
        mostUsed: this.getMostUsedLetters(10),
        byStrategy: this.getLettersByStrategy()
      },
      
      combinations: {
        total: this.combinations.size,
        mostSuccessful: this.getMostSuccessfulCombinations(10),
        leastSuccessful: this.getLeastSuccessfulCombinations(5)
      },
      
      patterns: this.getEventPatterns()
    }
  }

  /**
   * Get most used categories
   */
  getMostUsedCategories(limit = 5) {
    return Array.from(this.categories.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Get most used letters
   */
  getMostUsedLetters(limit = 10) {
    return Array.from(this.letters.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(letter => ({
        ...letter,
        strategies: Array.from(letter.strategies)
      }))
  }

  /**
   * Get categories by difficulty
   */
  getCategoriesByDifficulty() {
    const byDifficulty = {}
    
    for (const category of this.categories.values()) {
      if (!byDifficulty[category.difficulty]) {
        byDifficulty[category.difficulty] = []
      }
      byDifficulty[category.difficulty].push(category)
    }
    
    return byDifficulty
  }

  /**
   * Get letters by strategy
   */
  getLettersByStrategy() {
    const byStrategy = {}
    
    for (const letter of this.letters.values()) {
      for (const strategy of letter.strategies) {
        if (!byStrategy[strategy]) {
          byStrategy[strategy] = []
        }
        byStrategy[strategy].push(letter)
      }
    }
    
    return byStrategy
  }

  /**
   * Get most successful combinations
   */
  getMostSuccessfulCombinations(limit = 10) {
    return Array.from(this.combinations.values())
      .filter(combo => combo.attempts > 0)
      .sort((a, b) => (b.success / b.attempts) - (a.success / a.attempts))
      .slice(0, limit)
  }

  /**
   * Get least successful combinations
   */
  getLeastSuccessfulCombinations(limit = 5) {
    return Array.from(this.combinations.values())
      .filter(combo => combo.attempts > 2) // Minimum attempts for significance
      .sort((a, b) => (a.success / a.attempts) - (b.success / b.attempts))
      .slice(0, limit)
  }

  /**
   * Get event patterns
   */
  getEventPatterns() {
    const patterns = {}
    
    for (const [eventName, pattern] of this.patterns) {
      patterns[eventName] = {
        count: pattern.count,
        properties: {}
      }
      
      for (const [propName, propValues] of pattern.properties) {
        patterns[eventName].properties[propName] = Array.from(propValues.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Top 10 values
      }
    }
    
    return patterns
  }

  /**
   * Export analytics data
   */
  export() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      events: this.events,
      insights: this.getInsights()
    }
  }

  /**
   * Reset analytics data
   */
  reset() {
    this.events = []
    this.patterns.clear()
    this.categories.clear()
    this.letters.clear()
    this.combinations.clear()
    this.startTime = Date.now()
  }

  /**
   * Destroy analytics and clean up
   */
  destroy() {
    this.reset()
    this.enabled = false
  }
}

// Global instances
export const performanceMonitor = new PerformanceMonitor()
export const usageAnalytics = new UsageAnalytics()