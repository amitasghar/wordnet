// Debugging and diagnostic tools for production troubleshooting
import { devLogger } from '@/utils/devTools.js'

export class DiagnosticTools {
  constructor() {
    this.diagnostics = new Map()
    this.healthChecks = new Map()
    this.alerts = []
    this.thresholds = {
      memoryUsage: 100 * 1024 * 1024, // 100MB
      responseTime: 200, // 200ms
      errorRate: 0.05, // 5%
      frameRate: 30 // 30fps minimum
    }
    
    this.isRunning = false
    this.checkInterval = null
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      name,
      check: checkFunction,
      interval: options.interval || 30000, // 30 seconds default
      timeout: options.timeout || 5000, // 5 seconds timeout
      critical: options.critical || false,
      lastCheck: 0,
      lastResult: null,
      errorCount: 0,
      enabled: true
    })
    
    devLogger.info(`DiagnosticTools: Registered health check '${name}'`)
  }

  /**
   * Start diagnostic monitoring
   */
  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    this.runHealthChecks()
    
    // Schedule periodic health checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks()
    }, 10000) // Check every 10 seconds
    
    devLogger.info('DiagnosticTools: Started monitoring')
  }

  /**
   * Stop diagnostic monitoring
   */
  stop() {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    
    devLogger.info('DiagnosticTools: Stopped monitoring')
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = new Map()
    const now = Date.now()
    
    for (const [name, healthCheck] of this.healthChecks) {
      if (!healthCheck.enabled) continue
      
      // Skip if not time for next check
      if (now - healthCheck.lastCheck < healthCheck.interval) continue
      
      try {
        const startTime = performance.now()
        
        // Run check with timeout
        const result = await Promise.race([
          healthCheck.check(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
          )
        ])
        
        const duration = performance.now() - startTime
        
        const checkResult = {
          name,
          status: 'healthy',
          result,
          duration,
          timestamp: now,
          error: null
        }
        
        results.set(name, checkResult)
        healthCheck.lastResult = checkResult
        healthCheck.lastCheck = now
        healthCheck.errorCount = 0
        
      } catch (error) {
        const checkResult = {
          name,
          status: 'unhealthy',
          result: null,
          duration: performance.now() - startTime,
          timestamp: now,
          error: error.message
        }
        
        results.set(name, checkResult)
        healthCheck.lastResult = checkResult
        healthCheck.lastCheck = now
        healthCheck.errorCount++
        
        // Create alert for critical checks
        if (healthCheck.critical) {
          this.createAlert('health_check_failed', {
            checkName: name,
            error: error.message,
            errorCount: healthCheck.errorCount
          })
        }
        
        devLogger.warn(`Health check '${name}' failed:`, error)
      }
    }
    
    // Store diagnostic results
    this.diagnostics.set('health_checks', {
      timestamp: now,
      results: Array.from(results.values()),
      summary: this.getHealthSummary(results)
    })
  }

  /**
   * Get health summary
   */
  getHealthSummary(results) {
    let healthy = 0
    let unhealthy = 0
    let critical = 0
    
    for (const [name, result] of results) {
      if (result.status === 'healthy') {
        healthy++
      } else {
        unhealthy++
        
        const healthCheck = this.healthChecks.get(name)
        if (healthCheck?.critical) {
          critical++
        }
      }
    }
    
    return {
      total: results.size,
      healthy,
      unhealthy,
      critical,
      overallStatus: critical > 0 ? 'critical' : (unhealthy > 0 ? 'warning' : 'healthy')
    }
  }

  /**
   * Create an alert
   */
  createAlert(type, data = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.getAlertSeverity(type),
      message: this.getAlertMessage(type, data),
      data,
      timestamp: Date.now(),
      acknowledged: false
    }
    
    this.alerts.push(alert)
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts.shift()
    }
    
    // Emit alert event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('diagnostic:alert', { detail: alert }))
    }
    
    devLogger.warn(`Alert created: ${alert.message}`)
    return alert
  }

  /**
   * Get alert severity
   */
  getAlertSeverity(type) {
    const severityMap = {
      health_check_failed: 'high',
      memory_threshold: 'medium',
      performance_degradation: 'medium',
      error_rate_exceeded: 'high',
      system_overload: 'critical'
    }
    
    return severityMap[type] || 'low'
  }

  /**
   * Get alert message
   */
  getAlertMessage(type, data) {
    const messages = {
      health_check_failed: `Health check '${data.checkName}' failed: ${data.error}`,
      memory_threshold: `Memory usage exceeds threshold: ${data.usage}MB`,
      performance_degradation: `Performance degradation detected: ${data.metric}`,
      error_rate_exceeded: `Error rate exceeded: ${data.rate}%`,
      system_overload: 'System overload detected'
    }
    
    return messages[type] || `Alert: ${type}`
  }

  /**
   * System diagnostics
   */
  runSystemDiagnostics() {
    const diagnostics = {
      timestamp: Date.now(),
      memory: this.getMemoryDiagnostics(),
      performance: this.getPerformanceDiagnostics(),
      network: this.getNetworkDiagnostics(),
      browser: this.getBrowserDiagnostics(),
      errors: this.getErrorDiagnostics()
    }
    
    this.diagnostics.set('system', diagnostics)
    return diagnostics
  }

  /**
   * Memory diagnostics
   */
  getMemoryDiagnostics() {
    if (!performance.memory) {
      return { available: false, reason: 'Performance Memory API not available' }
    }
    
    const memory = performance.memory
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
    const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024)
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
    
    const utilization = memory.usedJSHeapSize / memory.jsHeapSizeLimit
    
    return {
      available: true,
      used: usedMB,
      total: totalMB,
      limit: limitMB,
      utilization: Math.round(utilization * 100),
      status: utilization > 0.8 ? 'critical' : (utilization > 0.6 ? 'warning' : 'good'),
      thresholdExceeded: usedMB * 1024 * 1024 > this.thresholds.memoryUsage
    }
  }

  /**
   * Performance diagnostics
   */
  getPerformanceDiagnostics() {
    return {
      timing: performance.timing ? {
        navigationStart: performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventStart - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
      } : null,
      
      navigation: performance.navigation ? {
        type: performance.navigation.type,
        redirectCount: performance.navigation.redirectCount
      } : null,
      
      now: performance.now(),
      
      // Frame rate estimation (if available)
      frameRate: this.estimateFrameRate()
    }
  }

  /**
   * Network diagnostics
   */
  getNetworkDiagnostics() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    
    return {
      available: !!connection,
      type: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    }
  }

  /**
   * Browser diagnostics
   */
  getBrowserDiagnostics() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth
      }
    }
  }

  /**
   * Error diagnostics
   */
  getErrorDiagnostics() {
    // This would integrate with error tracking system
    return {
      recentErrors: [], // Placeholder for recent error data
      errorRate: 0,
      criticalErrors: 0
    }
  }

  /**
   * Estimate frame rate
   */
  estimateFrameRate() {
    // Simple frame rate estimation
    if (!this.frameRateData) {
      this.frameRateData = {
        samples: [],
        lastTime: performance.now()
      }
    }
    
    const now = performance.now()
    const frameDuration = now - this.frameRateData.lastTime
    this.frameRateData.lastTime = now
    
    if (frameDuration > 0) {
      const fps = 1000 / frameDuration
      this.frameRateData.samples.push(fps)
      
      // Keep only recent samples
      if (this.frameRateData.samples.length > 60) {
        this.frameRateData.samples.shift()
      }
      
      // Return average FPS
      const avgFps = this.frameRateData.samples.reduce((a, b) => a + b, 0) / this.frameRateData.samples.length
      return Math.round(avgFps)
    }
    
    return null
  }

  /**
   * Get diagnostic report
   */
  getDiagnosticReport() {
    return {
      timestamp: Date.now(),
      system: this.runSystemDiagnostics(),
      healthChecks: this.diagnostics.get('health_checks'),
      alerts: this.getRecentAlerts(),
      thresholds: this.thresholds,
      status: this.getOverallStatus()
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    return this.alerts.filter(alert => alert.timestamp > cutoff)
  }

  /**
   * Get overall system status
   */
  getOverallStatus() {
    const healthChecks = this.diagnostics.get('health_checks')
    const recentAlerts = this.getRecentAlerts(1) // Last hour
    
    if (!healthChecks) return 'unknown'
    
    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical')
    if (criticalAlerts.length > 0) return 'critical'
    
    if (healthChecks.summary.critical > 0) return 'critical'
    if (healthChecks.summary.unhealthy > 0) return 'warning'
    
    const highAlerts = recentAlerts.filter(alert => alert.severity === 'high')
    if (highAlerts.length > 3) return 'warning'
    
    return 'healthy'
  }

  /**
   * Export diagnostic data
   */
  export() {
    return {
      diagnostics: Array.from(this.diagnostics.entries()),
      healthChecks: Array.from(this.healthChecks.entries()),
      alerts: this.alerts,
      thresholds: this.thresholds,
      report: this.getDiagnosticReport()
    }
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      alert.acknowledgedAt = Date.now()
    }
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(hours = 168) { // 7 days default
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff)
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stop()
    this.diagnostics.clear()
    this.healthChecks.clear()
    this.alerts = []
    this.frameRateData = null
  }
}

// Default diagnostic instance
export const diagnosticTools = new DiagnosticTools()

// Register common health checks
diagnosticTools.registerHealthCheck('memory_usage', async () => {
  if (!performance.memory) return { status: 'unavailable' }
  
  const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024
  const limitMB = performance.memory.jsHeapSizeLimit / 1024 / 1024
  const utilization = usedMB / limitMB
  
  return {
    usedMB: Math.round(usedMB),
    limitMB: Math.round(limitMB),
    utilization: Math.round(utilization * 100),
    status: utilization < 0.8 ? 'good' : 'warning'
  }
}, { critical: true, interval: 30000 })

diagnosticTools.registerHealthCheck('performance_timing', async () => {
  const startTime = performance.now()
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1))
  
  const duration = performance.now() - startTime
  
  return {
    duration: Math.round(duration * 100) / 100,
    status: duration < 10 ? 'good' : 'warning'
  }
}, { critical: false, interval: 60000 })

// Auto-start in development
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  setTimeout(() => diagnosticTools.start(), 1000)
}