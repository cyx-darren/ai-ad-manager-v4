/**
 * MCP Real-time & Subscription Hooks
 * 
 * This file provides React hooks for real-time data subscriptions,
 * live updates, and event streaming capabilities.
 */

'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useMCPClient, useMCPStatus } from '../context';
import { useErrorRecovery } from './errorHooks';
import { useCachedData } from './advancedHooks';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  topic: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  bufferSize?: number;
  messageDeduplication?: boolean;
  heartbeatInterval?: number;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void;
}

/**
 * Subscription state
 */
export interface SubscriptionState<T = any> {
  isConnected: boolean;
  isConnecting: boolean;
  data: T[];
  lastMessage?: T;
  lastUpdate: number;
  error?: Error;
  reconnectCount: number;
  messageCount: number;
  bufferFull: boolean;
}

/**
 * Live updates configuration
 */
export interface LiveUpdatesConfig<T = any> {
  endpoint: string;
  updateFrequency?: number;
  diffingEnabled?: boolean;
  optimisticUpdates?: boolean;
  onUpdate?: (newData: T, oldData?: T) => void;
  shouldUpdate?: (newData: T, oldData?: T) => boolean;
  transformData?: (data: any) => T;
}

/**
 * Event stream configuration
 */
export interface EventStreamConfig {
  url: string;
  eventTypes?: string[];
  withCredentials?: boolean;
  headers?: Record<string, string>;
  reconnectTime?: number;
  maxReconnectAttempts?: number;
  onEvent?: (event: EventStreamEvent) => void;
}

/**
 * Event stream event
 */
export interface EventStreamEvent {
  type: string;
  data: any;
  id?: string;
  timestamp: number;
  retry?: number;
}

/**
 * Real-time metrics configuration
 */
export interface RealTimeMetricsConfig {
  metrics: string[];
  updateFrequency?: number;
  thresholdPercent?: number;
  dimensions?: string[];
  filters?: Record<string, any>;
  onMetricUpdate?: (metric: string, value: number, change: number) => void;
}

/**
 * Connection quality metrics
 */
export interface ConnectionQuality {
  latency: number;
  jitter: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  uptime: number;
  lastHeartbeat: number;
}

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  type: string;
  payload: any;
  id?: string;
  timestamp: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique message ID
 */
const generateMessageId = (): string => {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate connection quality based on metrics
 */
const calculateQuality = (latency: number, jitter: number, packetLoss: number): ConnectionQuality['quality'] => {
  if (latency < 50 && jitter < 10 && packetLoss < 0.1) return 'excellent';
  if (latency < 100 && jitter < 20 && packetLoss < 0.5) return 'good';
  if (latency < 200 && jitter < 50 && packetLoss < 2) return 'fair';
  return 'poor';
};

/**
 * Deep compare objects for diffing
 */
const deepCompare = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 === 'object') {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key) || !deepCompare(obj1[key], obj2[key])) {
        return false;
      }
    }
    return true;
  }
  
  return false;
};

/**
 * Calculate percentage change between values
 */
const calculateChange = (newValue: number, oldValue: number): number => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

// ============================================================================
// SUBSCRIPTION HOOKS
// ============================================================================

/**
 * Hook for managing real-time data subscriptions
 * 
 * @example
 * ```tsx
 * function RealtimeMetrics() {
 *   const { data, isConnected, subscribe, unsubscribe } = useSubscription('metrics-feed', {
 *     autoReconnect: true,
 *     bufferSize: 100,
 *     onMessage: (message) => console.log('New metric:', message)
 *   });
 *   
 *   useEffect(() => {
 *     subscribe();
 *     return () => unsubscribe();
 *   }, [subscribe, unsubscribe]);
 *   
 *   return (
 *     <div>
 *       <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
 *       <div>Messages: {data.length}</div>
 *       {data.slice(-10).map((message, index) => (
 *         <div key={index}>{JSON.stringify(message)}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useSubscription = <T = any>(
  topic: string,
  config: Partial<SubscriptionConfig> = {}
) => {
  const defaultConfig: SubscriptionConfig = {
    topic,
    autoReconnect: true,
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    bufferSize: 1000,
    messageDeduplication: true,
    heartbeatInterval: 30000
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [state, setState] = useState<SubscriptionState<T>>({
    isConnected: false,
    isConnecting: false,
    data: [],
    lastUpdate: Date.now(),
    reconnectCount: 0,
    messageCount: 0,
    bufferFull: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const messageBufferRef = useRef<Set<string>>(new Set());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { attemptRecovery } = useErrorRecovery();

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }, []);

  const handleMessage = useCallback((message: T) => {
    const messageId = generateMessageId();
    
    // Deduplication
    if (finalConfig.messageDeduplication && messageBufferRef.current.has(JSON.stringify(message))) {
      return;
    }

    if (finalConfig.messageDeduplication) {
      messageBufferRef.current.add(JSON.stringify(message));
      if (messageBufferRef.current.size > 1000) {
        const firstEntry = messageBufferRef.current.values().next().value;
        messageBufferRef.current.delete(firstEntry);
      }
    }

    setState(prev => {
      const newData = [...prev.data, message];
      
      // Buffer size management
      if (newData.length > finalConfig.bufferSize!) {
        newData.splice(0, newData.length - finalConfig.bufferSize!);
      }

      return {
        ...prev,
        data: newData,
        lastMessage: message,
        lastUpdate: Date.now(),
        messageCount: prev.messageCount + 1,
        bufferFull: newData.length >= finalConfig.bufferSize!
      };
    });

    if (finalConfig.onMessage) {
      finalConfig.onMessage(message);
    }
  }, [finalConfig]);

  const subscribe = useCallback(async () => {
    if (state.isConnecting || state.isConnected) return;

    setState(prev => ({ ...prev, isConnecting: true, error: undefined }));

    try {
      // TODO: Replace with actual MCP subscription implementation
      // For now, simulate WebSocket connection
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: (data: string) => console.log('Mock send:', data),
        close: () => console.log('Mock close'),
        addEventListener: (event: string, handler: Function) => {
          if (event === 'message') {
            // Simulate incoming messages
            const interval = setInterval(() => {
              handler({
                data: JSON.stringify({
                  type: 'metric-update',
                  data: {
                    metric: 'activeUsers',
                    value: Math.floor(Math.random() * 1000),
                    timestamp: Date.now()
                  }
                })
              });
            }, 2000);
            
            setTimeout(() => clearInterval(interval), 60000); // Stop after 1 minute
          }
        }
      } as any;

      wsRef.current = mockWs;

      wsRef.current.addEventListener('message', (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pong') {
            // Handle heartbeat response
            return;
          }
          handleMessage(message.data || message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      wsRef.current.addEventListener('close', () => {
        setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
        
        if (finalConfig.onDisconnect) {
          finalConfig.onDisconnect('Connection closed');
        }

        // Auto-reconnect logic
        if (finalConfig.autoReconnect && state.reconnectCount < finalConfig.reconnectAttempts!) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setState(prev => ({ ...prev, reconnectCount: prev.reconnectCount + 1 }));
            subscribe();
          }, finalConfig.reconnectDelay! * Math.pow(2, state.reconnectCount));
        }
      });

      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isConnecting: false,
        reconnectCount: 0
      }));

      if (finalConfig.onConnect) {
        finalConfig.onConnect();
      }

      // Start heartbeat
      if (finalConfig.heartbeatInterval! > 0) {
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, finalConfig.heartbeatInterval);
      }

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnecting: false,
        error: error as Error
      }));

      if (finalConfig.onError) {
        finalConfig.onError(error as Error);
      }

      // Attempt recovery
      await attemptRecovery(error as Error);
    }
  }, [state.isConnecting, state.isConnected, state.reconnectCount, finalConfig, handleMessage, sendHeartbeat, attemptRecovery]);

  const unsubscribe = useCallback(() => {
    cleanup();
    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isConnecting: false,
      reconnectCount: 0
    }));
  }, [cleanup]);

  const clearBuffer = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      data: [],
      messageCount: 0,
      bufferFull: false
    }));
    messageBufferRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    clearBuffer,
    sendMessage: useCallback((message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    }, [])
  };
};

/**
 * Hook for simplified live updates with smart diffing
 * 
 * @example
 * ```tsx
 * function LiveDashboard() {
 *   const { data, isLoading, lastUpdate, refresh, togglePause } = useLiveUpdates('/api/live/dashboard', {
 *     updateFrequency: 5000,
 *     diffingEnabled: true,
 *     optimisticUpdates: true
 *   });
 *   
 *   return (
 *     <div>
 *       <div>Last update: {new Date(lastUpdate).toLocaleTimeString()}</div>
 *       <button onClick={refresh}>Refresh Now</button>
 *       <button onClick={togglePause}>
 *         {isLoading ? 'Pause' : 'Resume'}
 *       </button>
 *       <pre>{JSON.stringify(data, null, 2)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export const useLiveUpdates = <T = any>(
  endpoint: string,
  config: Partial<LiveUpdatesConfig<T>> = {}
) => {
  const defaultConfig: LiveUpdatesConfig<T> = {
    endpoint,
    updateFrequency: 5000,
    diffingEnabled: true,
    optimisticUpdates: false
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [data, setData] = useState<T | undefined>();
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<T | undefined>();
  const cache = useCachedData<T>();

  const fetchUpdate = useCallback(async (optimistic = false) => {
    if (isPaused && !optimistic) return;

    try {
      setIsLoading(true);
      setError(undefined);

      // Check cache first
      const cacheKey = `live-update-${endpoint}`;
      const cachedData = cache.get(cacheKey);
      
      if (cachedData && !optimistic) {
        setData(cachedData);
        setLastUpdate(Date.now());
        return;
      }

      // TODO: Replace with actual MCP data fetching
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      const mockData = {
        timestamp: Date.now(),
        metrics: {
          activeUsers: Math.floor(Math.random() * 1000),
          pageViews: Math.floor(Math.random() * 5000),
          sessions: Math.floor(Math.random() * 800)
        },
        alerts: Math.random() > 0.8 ? ['High traffic detected'] : []
      } as any;

      const newData = finalConfig.transformData ? finalConfig.transformData(mockData) : mockData;

      // Apply diffing if enabled
      if (finalConfig.diffingEnabled && previousDataRef.current) {
        const hasChanges = !deepCompare(newData, previousDataRef.current);
        
        if (!hasChanges) {
          setIsLoading(false);
          return;
        }

        // Check custom update condition
        if (finalConfig.shouldUpdate && !finalConfig.shouldUpdate(newData, previousDataRef.current)) {
          setIsLoading(false);
          return;
        }
      }

      // Update data
      previousDataRef.current = data;
      setData(newData);
      setLastUpdate(Date.now());

      // Cache the result
      cache.set(cacheKey, newData, { ttl: finalConfig.updateFrequency! / 2 });

      // Trigger callback
      if (finalConfig.onUpdate) {
        finalConfig.onUpdate(newData, previousDataRef.current);
      }

    } catch (error) {
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, isPaused, data, finalConfig, cache]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const refresh = useCallback(() => {
    fetchUpdate(true);
  }, [fetchUpdate]);

  // Setup interval
  useEffect(() => {
    if (!isPaused && finalConfig.updateFrequency! > 0) {
      // Initial fetch
      fetchUpdate();
      
      // Setup interval
      intervalRef.current = setInterval(fetchUpdate, finalConfig.updateFrequency);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, finalConfig.updateFrequency, fetchUpdate]);

  return {
    data,
    lastUpdate,
    isLoading,
    isPaused,
    error,
    refresh,
    togglePause
  };
};

/**
 * Hook for Server-Sent Events (SSE) management
 * 
 * @example
 * ```tsx
 * function EventStreamComponent() {
 *   const { 
 *     events, 
 *     isConnected, 
 *     addEventListener, 
 *     removeEventListener 
 *   } = useEventStream('/api/events/dashboard', {
 *     eventTypes: ['metric-update', 'alert', 'system-message'],
 *     withCredentials: true
 *   });
 *   
 *   useEffect(() => {
 *     const unsubscribe = addEventListener('metric-update', (event) => {
 *       console.log('Metric updated:', event.data);
 *     });
 *     
 *     return unsubscribe;
 *   }, [addEventListener]);
 *   
 *   return (
 *     <div>
 *       <div>Connection: {isConnected ? 'Active' : 'Inactive'}</div>
 *       <div>Events received: {events.length}</div>
 *       {events.slice(-5).map((event, index) => (
 *         <div key={index}>
 *           [{event.type}] {JSON.stringify(event.data)}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useEventStream = (
  url: string,
  config: Partial<EventStreamConfig> = {}
) => {
  const defaultConfig: EventStreamConfig = {
    url,
    eventTypes: [],
    withCredentials: false,
    reconnectTime: 3000,
    maxReconnectAttempts: 5
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [events, setEvents] = useState<EventStreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());
  const reconnectCountRef = useRef(0);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // TODO: Replace with actual SSE implementation
      // For now, simulate EventSource
      const mockEventSource = {
        readyState: 1, // EventSource.OPEN
        close: () => console.log('Mock EventSource closed'),
        addEventListener: (type: string, handler: Function) => {
          // Simulate events
          if (type === 'message' || finalConfig.eventTypes!.includes(type)) {
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: type || 'message',
                  data: { value: Math.random(), timestamp: Date.now() },
                  id: generateMessageId()
                })
              });
            }, Math.random() * 3000);
          }
        }
      } as any;

      eventSourceRef.current = mockEventSource;

      // Add event listeners for specified types
      if (finalConfig.eventTypes!.length > 0) {
        finalConfig.eventTypes!.forEach(eventType => {
          eventSourceRef.current!.addEventListener(eventType, (event: MessageEvent) => {
            const eventData: EventStreamEvent = {
              type: eventType,
              data: JSON.parse(event.data),
              timestamp: Date.now()
            };

            setEvents(prev => [...prev.slice(-99), eventData]); // Keep last 100 events

            // Trigger custom handlers
            const handlers = eventHandlersRef.current.get(eventType) || [];
            handlers.forEach(handler => handler(eventData));

            if (finalConfig.onEvent) {
              finalConfig.onEvent(eventData);
            }
          });
        });
      }

      // Default message listener
      eventSourceRef.current.addEventListener('message', (event: MessageEvent) => {
        const eventData: EventStreamEvent = {
          type: 'message',
          data: JSON.parse(event.data),
          timestamp: Date.now()
        };

        setEvents(prev => [...prev.slice(-99), eventData]);

        if (finalConfig.onEvent) {
          finalConfig.onEvent(eventData);
        }
      });

      setIsConnected(true);
      setError(undefined);
      reconnectCountRef.current = 0;

    } catch (error) {
      setError(error as Error);
      setIsConnected(false);

      // Auto-reconnect
      if (reconnectCountRef.current < finalConfig.maxReconnectAttempts!) {
        setTimeout(() => {
          reconnectCountRef.current++;
          connect();
        }, finalConfig.reconnectTime! * Math.pow(2, reconnectCountRef.current));
      }
    }
  }, [finalConfig]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const addEventListener = useCallback((eventType: string, handler: Function) => {
    const handlers = eventHandlersRef.current.get(eventType) || [];
    handlers.push(handler);
    eventHandlersRef.current.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = eventHandlersRef.current.get(eventType) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
        eventHandlersRef.current.set(eventType, currentHandlers);
      }
    };
  }, []);

  const removeEventListener = useCallback((eventType: string, handler: Function) => {
    const handlers = eventHandlersRef.current.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      eventHandlersRef.current.set(eventType, handlers);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    events,
    isConnected,
    error,
    connect,
    disconnect,
    addEventListener,
    removeEventListener,
    clearEvents: useCallback(() => setEvents([]), [])
  };
};

// ============================================================================
// REAL-TIME DATA HOOKS
// ============================================================================

/**
 * Hook for real-time GA4 metrics streaming
 * 
 * @example
 * ```tsx
 * function RealTimeAnalytics() {
 *   const { 
 *     metrics, 
 *     lastUpdated, 
 *     isActive, 
 *     toggleUpdates 
 *   } = useRealTimeMetrics({
 *     metrics: ['activeUsers', 'sessions', 'conversions'],
 *     updateFrequency: 5000,
 *     thresholdPercent: 5,
 *     onMetricUpdate: (metric, value, change) => {
 *       if (Math.abs(change) > 10) {
 *         console.log(`Significant change in ${metric}: ${change.toFixed(1)}%`);
 *       }
 *     }
 *   });
 *   
 *   return (
 *     <div>
 *       <button onClick={toggleUpdates}>
 *         {isActive ? 'Pause' : 'Resume'} Updates
 *       </button>
 *       <div>Last updated: {new Date(lastUpdated).toLocaleTimeString()}</div>
 *       {Object.entries(metrics).map(([metric, data]) => (
 *         <div key={metric}>
 *           {metric}: {data.value} ({data.change > 0 ? '+' : ''}{data.change.toFixed(1)}%)
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const useRealTimeMetrics = (
  config: RealTimeMetricsConfig
) => {
  const defaultConfig = {
    updateFrequency: 10000,
    thresholdPercent: 1,
    dimensions: [],
    filters: {}
  };

  const finalConfig = { ...defaultConfig, ...config };
  const [metrics, setMetrics] = useState<Record<string, { value: number; change: number; trend: 'up' | 'down' | 'stable' }>>({});
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousMetricsRef = useRef<Record<string, number>>({});

  const fetchMetrics = useCallback(async () => {
    if (!isActive) return;

    try {
      // TODO: Replace with actual MCP GA4 metrics fetching
      // For now, simulate metric data
      const newMetrics: Record<string, { value: number; change: number; trend: 'up' | 'down' | 'stable' }> = {};

      for (const metric of finalConfig.metrics) {
        const baseValue = previousMetricsRef.current[metric] || Math.floor(Math.random() * 1000);
        const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
        const newValue = Math.max(0, Math.floor(baseValue * (1 + variance)));
        
        const change = calculateChange(newValue, baseValue);
        const trend = Math.abs(change) < finalConfig.thresholdPercent! ? 'stable' : 
                     change > 0 ? 'up' : 'down';

        newMetrics[metric] = { value: newValue, change, trend };

        // Trigger callback if change exceeds threshold
        if (Math.abs(change) >= finalConfig.thresholdPercent! && finalConfig.onMetricUpdate) {
          finalConfig.onMetricUpdate(metric, newValue, change);
        }

        previousMetricsRef.current[metric] = newValue;
      }

      setMetrics(newMetrics);
      setLastUpdated(Date.now());
      setError(undefined);

    } catch (error) {
      setError(error as Error);
    }
  }, [isActive, finalConfig]);

  const toggleUpdates = useCallback(() => {
    setIsActive(prev => !prev);
  }, []);

  // Setup interval
  useEffect(() => {
    if (isActive && finalConfig.updateFrequency > 0) {
      // Initial fetch
      fetchMetrics();
      
      // Setup interval
      intervalRef.current = setInterval(fetchMetrics, finalConfig.updateFrequency);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, finalConfig.updateFrequency, fetchMetrics]);

  return {
    metrics,
    lastUpdated,
    isActive,
    error,
    toggleUpdates,
    refresh: fetchMetrics
  };
};

/**
 * Hook for enhanced live connection status monitoring
 * 
 * @example
 * ```tsx
 * function ConnectionMonitor() {
 *   const { 
 *     status, 
 *     quality, 
 *     latency, 
 *     uptime 
 *   } = useLiveConnectionStatus({
 *     heartbeatInterval: 30000,
 *     qualityMetrics: true
 *   });
 *   
 *   return (
 *     <div>
 *       <div>Status: {status}</div>
 *       <div>Quality: {quality.quality} ({quality.latency}ms)</div>
 *       <div>Uptime: {Math.floor(uptime / 1000)}s</div>
 *       <div>Latency: {latency}ms</div>
 *     </div>
 *   );
 * }
 * ```
 */
export const useLiveConnectionStatus = (
  config: {
    heartbeatInterval?: number;
    qualityMetrics?: boolean;
    onQualityChange?: (quality: ConnectionQuality) => void;
  } = {}
) => {
  const defaultConfig = {
    heartbeatInterval: 30000,
    qualityMetrics: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { status } = useMCPStatus();
  const [quality, setQuality] = useState<ConnectionQuality>({
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    quality: 'excellent',
    uptime: 0,
    lastHeartbeat: Date.now()
  });

  const startTimeRef = useRef<number>(Date.now());
  const latencyHistoryRef = useRef<number[]>([]);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const measureLatency = useCallback(async (): Promise<number> => {
    const start = performance.now();
    
    try {
      // TODO: Replace with actual MCP ping
      // For now, simulate network latency
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 10));
      
      const end = performance.now();
      return end - start;
    } catch {
      return -1; // Indicate failed ping
    }
  }, []);

  const updateQualityMetrics = useCallback(async () => {
    if (!finalConfig.qualityMetrics) return;

    const latency = await measureLatency();
    
    if (latency === -1) {
      // Failed ping
      setQuality(prev => ({
        ...prev,
        packetLoss: Math.min(prev.packetLoss + 1, 100),
        lastHeartbeat: Date.now()
      }));
      return;
    }

    // Update latency history
    latencyHistoryRef.current.push(latency);
    if (latencyHistoryRef.current.length > 10) {
      latencyHistoryRef.current.shift();
    }

    // Calculate jitter (variance in latency)
    const avgLatency = latencyHistoryRef.current.reduce((sum, val) => sum + val, 0) / latencyHistoryRef.current.length;
    const jitter = latencyHistoryRef.current.reduce((sum, val) => sum + Math.abs(val - avgLatency), 0) / latencyHistoryRef.current.length;

    const uptime = Date.now() - startTimeRef.current;
    const newQuality: ConnectionQuality = {
      latency: Math.round(avgLatency),
      jitter: Math.round(jitter),
      packetLoss: Math.max(0, quality.packetLoss - 0.5), // Gradual recovery
      quality: calculateQuality(avgLatency, jitter, quality.packetLoss),
      uptime,
      lastHeartbeat: Date.now()
    };

    setQuality(newQuality);

    if (finalConfig.onQualityChange) {
      finalConfig.onQualityChange(newQuality);
    }
  }, [finalConfig, quality.packetLoss, measureLatency]);

  // Setup heartbeat interval
  useEffect(() => {
    if (finalConfig.heartbeatInterval > 0 && status === 'connected') {
      heartbeatIntervalRef.current = setInterval(updateQualityMetrics, finalConfig.heartbeatInterval);
      
      // Initial measurement
      updateQualityMetrics();
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [finalConfig.heartbeatInterval, status, updateQualityMetrics]);

  // Reset on connection status change
  useEffect(() => {
    if (status === 'connected') {
      startTimeRef.current = Date.now();
      latencyHistoryRef.current = [];
    }
  }, [status]);

  return {
    status,
    quality,
    latency: quality.latency,
    uptime: quality.uptime,
    isHealthy: quality.quality === 'excellent' || quality.quality === 'good',
    refresh: updateQualityMetrics
  };
};