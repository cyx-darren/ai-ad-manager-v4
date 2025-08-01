/**
 * Retry utilities for API calls with exponential backoff and error handling
 */

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryCondition?: (error: any) => boolean
  onRetry?: (attempt: number, error: any) => void
  onSuccess?: (result: any, attempt: number) => void
  onFailure?: (error: any, attempt: number) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: any
  attempts: number
  totalTime: number
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryCondition: (error: any) => {
    // Retry on network errors, 5xx errors, and timeouts
    if (error?.code === 'NETWORK_ERROR') return true
    if (error?.response?.status >= 500) return true
    if (error?.code === 'TIMEOUT') return true
    if (error?.name === 'TimeoutError') return true
    return false
  }
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Calculate delay with exponential backoff and jitter
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay // Add 10% jitter
  const delay = Math.min(exponentialDelay + jitter, config.maxDelay)
  return Math.floor(delay)
}

// Main retry function
export async function retryAsync<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const startTime = Date.now()
  let lastError: any

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      const result = await operation()
      const totalTime = Date.now() - startTime
      
      finalConfig.onSuccess?.(result, attempt)
      
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTime
      }
    } catch (error) {
      lastError = error
      const totalTime = Date.now() - startTime
      
      // Check if we should retry
      const shouldRetry = attempt <= finalConfig.maxRetries && 
                         finalConfig.retryCondition?.(error)
      
      if (!shouldRetry) {
        finalConfig.onFailure?.(error, attempt)
        return {
          success: false,
          error,
          attempts: attempt,
          totalTime
        }
      }
      
      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, finalConfig)
      finalConfig.onRetry?.(attempt, error)
      
      await sleep(delay)
    }
  }
  
  // This shouldn't be reached, but just in case
  const totalTime = Date.now() - startTime
  finalConfig.onFailure?.(lastError, finalConfig.maxRetries + 1)
  
  return {
    success: false,
    error: lastError,
    attempts: finalConfig.maxRetries + 1,
    totalTime
  }
}

// React hook for retry functionality
import { useState, useCallback } from 'react'
import { useError } from '@/contexts/ErrorContext'

export interface UseRetryState<T> {
  data: T | null
  loading: boolean
  error: any
  attempts: number
  lastAttemptTime: string | null
}

export function useRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
) {
  const { addApiError, addNetworkError } = useError()
  const [state, setState] = useState<UseRetryState<T>>({
    data: null,
    loading: false,
    error: null,
    attempts: 0,
    lastAttemptTime: null
  })

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    const result = await retryAsync(operation, {
      ...config,
      onRetry: (attempt, error) => {
        setState(prev => ({ 
          ...prev, 
          attempts: attempt,
          lastAttemptTime: new Date().toISOString()
        }))
        config.onRetry?.(attempt, error)
      },
      onSuccess: (data, attempt) => {
        setState(prev => ({ 
          ...prev, 
          data, 
          loading: false, 
          attempts: attempt,
          lastAttemptTime: new Date().toISOString()
        }))
        config.onSuccess?.(data, attempt)
      },
      onFailure: (error, attempt) => {
        setState(prev => ({ 
          ...prev, 
          error, 
          loading: false, 
          attempts: attempt,
          lastAttemptTime: new Date().toISOString()
        }))
        
        // Add error to error context
        if (error?.code === 'NETWORK_ERROR' || error?.name === 'TypeError') {
          addNetworkError('Network request failed', error.message)
        } else {
          addApiError('API request failed', error.message)
        }
        
        config.onFailure?.(error, attempt)
      }
    })
    
    return result
  }, [operation, config, addApiError, addNetworkError])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      attempts: 0,
      lastAttemptTime: null
    })
  }, [])

  return {
    ...state,
    execute,
    reset,
    isRetrying: state.loading && state.attempts > 1
  }
}

// Enhanced fetch with retry
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const result = await retryAsync(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        ;(error as any).response = response
        ;(error as any).status = response.status
        throw error
      }
      
      return response
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout')
        timeoutError.name = 'TimeoutError'
        ;(timeoutError as any).code = 'TIMEOUT'
        throw timeoutError
      }
      
      if (error instanceof TypeError) {
        ;(error as any).code = 'NETWORK_ERROR'
      }
      
      throw error
    }
  }, retryConfig)
  
  if (!result.success) {
    throw result.error
  }
  
  return result.data!
}

// Specific retry configurations for different scenarios
export const RETRY_CONFIGS = {
  // For critical API calls that must succeed
  critical: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffFactor: 2
  },
  
  // For real-time data that should fail fast
  realtime: {
    maxRetries: 1,
    baseDelay: 500,
    maxDelay: 2000,
    backoffFactor: 1.5
  },
  
  // For background operations that can take time
  background: {
    maxRetries: 10,
    baseDelay: 2000,
    maxDelay: 120000,
    backoffFactor: 1.5
  },
  
  // For user-initiated actions
  user: {
    maxRetries: 2,
    baseDelay: 800,
    maxDelay: 5000,
    backoffFactor: 2
  }
} as const

// Circuit breaker for repeated failures
export class CircuitBreaker {
  private failures = 0
  private lastFailTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private failureThreshold = 5,
    private timeout = 60000, // 1 minute
    private monitoringPeriod = 300000 // 5 minutes
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime < this.timeout) {
        throw new Error('Circuit breaker is open')
      } else {
        this.state = 'half-open'
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure() {
    this.failures++
    this.lastFailTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
    
    // Reset failure count after monitoring period
    setTimeout(() => {
      if (this.state === 'closed') {
        this.failures = 0
      }
    }, this.monitoringPeriod)
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime
    }
  }
}

// Global circuit breaker instances for different services
export const circuitBreakers = {
  ga4Api: new CircuitBreaker(3, 30000, 120000),
  supabaseApi: new CircuitBreaker(5, 60000, 300000),
  external: new CircuitBreaker(3, 30000, 120000)
}