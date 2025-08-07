/**
 * Metric Card Monitor
 * 
 * Monitoring and error tracking system for metric card migration.
 * Tracks performance, errors, and provides alerting capabilities.
 */

import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';

export interface MetricCardEvent {
  type: 'fetch_start' | 'fetch_success' | 'fetch_error' | 'fallback_used' | 'cache_hit' | 'cache_miss';
  cardId: string;
  timestamp: number;
  duration?: number;
  error?: string;
  source?: 'mcp' | 'mock' | 'cache';
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  type: 'high_error_rate' | 'slow_response' | 'cache_miss_rate' | 'fallback_rate';
  cardId?: string;
  threshold: number;
  current: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MonitoringThresholds {
  errorRateThreshold: number; // percentage
  slowResponseThreshold: number; // milliseconds
  cacheMissRateThreshold: number; // percentage
  fallbackRateThreshold: number; // percentage
}

export interface CardMetrics {
  cardId: string;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  cacheHits: number;
  cacheMisses: number;
  fallbackUsage: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  lastUpdated: number;
  errorRate: number;
  cacheHitRate: number;
  fallbackRate: number;
}

/**
 * Main monitoring class
 */
export class MetricCardMonitor {
  private events: MetricCardEvent[] = [];
  private metrics: Map<string, CardMetrics> = new Map();
  private thresholds: MonitoringThresholds;
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  private maxEvents: number;

  constructor(config: Partial<MonitoringThresholds & { maxEvents: number }> = {}) {
    this.thresholds = {
      errorRateThreshold: 5, // 5%
      slowResponseThreshold: 2000, // 2 seconds
      cacheMissRateThreshold: 80, // 80%
      fallbackRateThreshold: 10, // 10%
      ...config
    };
    this.maxEvents = config.maxEvents || 1000;
  }

  /**
   * Record an event
   */
  recordEvent(event: Omit<MetricCardEvent, 'timestamp'>): void {
    const fullEvent: MetricCardEvent = {
      ...event,
      timestamp: Date.now()
    };

    this.events.push(fullEvent);
    this.updateMetrics(fullEvent);
    this.checkThresholds(event.cardId);

    // Maintain event buffer size
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Update metrics based on event
   */
  private updateMetrics(event: MetricCardEvent): void {
    let cardMetrics = this.metrics.get(event.cardId);
    
    if (!cardMetrics) {
      cardMetrics = {
        cardId: event.cardId,
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        fallbackUsage: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        lastUpdated: 0,
        errorRate: 0,
        cacheHitRate: 0,
        fallbackRate: 0
      };
      this.metrics.set(event.cardId, cardMetrics);
    }

    // Update counters
    switch (event.type) {
      case 'fetch_start':
        cardMetrics.totalRequests++;
        break;
      case 'fetch_success':
        cardMetrics.successfulRequests++;
        if (event.duration) {
          this.updateResponseTimeMetrics(cardMetrics, event.duration);
        }
        break;
      case 'fetch_error':
        cardMetrics.errorRequests++;
        if (event.duration) {
          this.updateResponseTimeMetrics(cardMetrics, event.duration);
        }
        break;
      case 'fallback_used':
        cardMetrics.fallbackUsage++;
        break;
      case 'cache_hit':
        cardMetrics.cacheHits++;
        break;
      case 'cache_miss':
        cardMetrics.cacheMisses++;
        break;
    }

    // Calculate rates
    const totalCompleted = cardMetrics.successfulRequests + cardMetrics.errorRequests;
    if (totalCompleted > 0) {
      cardMetrics.errorRate = (cardMetrics.errorRequests / totalCompleted) * 100;
    }

    const totalCacheRequests = cardMetrics.cacheHits + cardMetrics.cacheMisses;
    if (totalCacheRequests > 0) {
      cardMetrics.cacheHitRate = (cardMetrics.cacheHits / totalCacheRequests) * 100;
    }

    if (cardMetrics.totalRequests > 0) {
      cardMetrics.fallbackRate = (cardMetrics.fallbackUsage / cardMetrics.totalRequests) * 100;
    }

    cardMetrics.lastUpdated = Date.now();
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(metrics: CardMetrics, duration: number): void {
    const completedRequests = metrics.successfulRequests + metrics.errorRequests;
    
    // Update average
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (completedRequests - 1) + duration) / completedRequests;
    
    // Simple P95 approximation (in production, use proper histogram)
    metrics.p95ResponseTime = Math.max(metrics.p95ResponseTime, duration);
  }

  /**
   * Check thresholds and generate alerts
   */
  private checkThresholds(cardId: string): void {
    const metrics = this.metrics.get(cardId);
    if (!metrics || metrics.totalRequests < 10) return; // Need minimum data

    const alerts: PerformanceAlert[] = [];

    // Error rate check
    if (metrics.errorRate > this.thresholds.errorRateThreshold) {
      alerts.push({
        type: 'high_error_rate',
        cardId,
        threshold: this.thresholds.errorRateThreshold,
        current: metrics.errorRate,
        timestamp: Date.now(),
        severity: metrics.errorRate > 20 ? 'critical' : metrics.errorRate > 10 ? 'high' : 'medium'
      });
    }

    // Response time check
    if (metrics.averageResponseTime > this.thresholds.slowResponseThreshold) {
      alerts.push({
        type: 'slow_response',
        cardId,
        threshold: this.thresholds.slowResponseThreshold,
        current: metrics.averageResponseTime,
        timestamp: Date.now(),
        severity: metrics.averageResponseTime > 5000 ? 'critical' : 'medium'
      });
    }

    // Cache miss rate check
    const cacheMissRate = 100 - metrics.cacheHitRate;
    if (cacheMissRate > this.thresholds.cacheMissRateThreshold) {
      alerts.push({
        type: 'cache_miss_rate',
        cardId,
        threshold: this.thresholds.cacheMissRateThreshold,
        current: cacheMissRate,
        timestamp: Date.now(),
        severity: 'low'
      });
    }

    // Fallback rate check
    if (metrics.fallbackRate > this.thresholds.fallbackRateThreshold) {
      alerts.push({
        type: 'fallback_rate',
        cardId,
        threshold: this.thresholds.fallbackRateThreshold,
        current: metrics.fallbackRate,
        timestamp: Date.now(),
        severity: metrics.fallbackRate > 50 ? 'critical' : metrics.fallbackRate > 25 ? 'high' : 'medium'
      });
    }

    // Notify alert callbacks
    alerts.forEach(alert => {
      this.alertCallbacks.forEach(callback => callback(alert));
    });
  }

  /**
   * Subscribe to alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get metrics for a specific card
   */
  getCardMetrics(cardId: string): CardMetrics | null {
    return this.metrics.get(cardId) || null;
  }

  /**
   * Get metrics for all cards
   */
  getAllMetrics(): Map<string, CardMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get recent events
   */
  getRecentEvents(cardId?: string, limit: number = 100): MetricCardEvent[] {
    let events = this.events;
    
    if (cardId) {
      events = events.filter(event => event.cardId === cardId);
    }
    
    return events.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    totalCards: number;
    healthyCards: number;
    warningCards: number;
    criticalCards: number;
    overallErrorRate: number;
    overallFallbackRate: number;
  } {
    const cardMetrics = Array.from(this.metrics.values());
    const totalCards = cardMetrics.length;
    
    let healthyCards = 0;
    let warningCards = 0;
    let criticalCards = 0;
    let totalErrors = 0;
    let totalRequests = 0;
    let totalFallbacks = 0;

    cardMetrics.forEach(metrics => {
      totalErrors += metrics.errorRequests;
      totalRequests += metrics.totalRequests;
      totalFallbacks += metrics.fallbackUsage;

      if (metrics.errorRate < 1 && metrics.fallbackRate < 5) {
        healthyCards++;
      } else if (metrics.errorRate < 5 && metrics.fallbackRate < 20) {
        warningCards++;
      } else {
        criticalCards++;
      }
    });

    return {
      totalCards,
      healthyCards,
      warningCards,
      criticalCards,
      overallErrorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      overallFallbackRate: totalRequests > 0 ? (totalFallbacks / totalRequests) * 100 : 0
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): {
    timestamp: number;
    metrics: Record<string, CardMetrics>;
    systemHealth: any;
  } {
    const metricsObj: Record<string, CardMetrics> = {};
    this.metrics.forEach((metrics, cardId) => {
      metricsObj[cardId] = metrics;
    });

    return {
      timestamp: Date.now(),
      metrics: metricsObj,
      systemHealth: this.getHealthSummary()
    };
  }

  /**
   * Clear all data
   */
  reset(): void {
    this.events = [];
    this.metrics.clear();
  }

  /**
   * Start automatic health reporting
   */
  startHealthReporting(intervalMs: number = 60000): () => void {
    const interval = setInterval(() => {
      const health = this.getHealthSummary();
      console.log('🔍 Metric Card Health Report:', health);
      
      // Log any critical cards
      this.metrics.forEach(metrics => {
        if (metrics.errorRate > 10 || metrics.fallbackRate > 25) {
          console.warn(`⚠️ Card ${metrics.cardId} health issue:`, {
            errorRate: `${metrics.errorRate.toFixed(1)}%`,
            fallbackRate: `${metrics.fallbackRate.toFixed(1)}%`,
            avgResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`
          });
        }
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }
}

// Singleton instance
export const metricCardMonitor = new MetricCardMonitor();