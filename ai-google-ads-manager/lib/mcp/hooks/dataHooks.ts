/**
 * MCP Data Fetching Hooks
 * 
 * This file provides React hooks for fetching data through the MCP client,
 * including GA4 data retrieval, resource management, and query parameters.
 */

'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useMCPClient, useMCPStatus } from '../context';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Data fetching state
 */
export interface DataFetchingState<T = any> {
  data?: T;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  lastFetched?: Date;
  fetchCount: number;
}

/**
 * Data fetching options
 */
export interface DataFetchingOptions {
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number; // milliseconds
  cacheTime?: number; // milliseconds
  retry?: number | boolean;
  retryDelay?: number; // milliseconds
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * GA4 metrics configuration
 */
export interface GA4MetricsConfig {
  metrics: string[];
  dimensions?: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  propertyId?: string;
  filters?: Record<string, any>;
  orderBy?: Array<{
    metric?: string;
    dimension?: string;
    desc?: boolean;
  }>;
  limit?: number;
  offset?: number;
}

/**
 * GA4 time series configuration
 */
export interface GA4TimeSeriesConfig extends Omit<GA4MetricsConfig, 'dimensions'> {
  granularity: 'day' | 'week' | 'month';
  dimensions?: string[];
}

/**
 * MCP resource information
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: Record<string, any>;
}

/**
 * MCP tool information
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, any>;
  annotations?: Record<string, any>;
}

/**
 * MCP capabilities information
 */
export interface MCPCapabilities {
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: Record<string, any>;
  prompts?: {
    listChanged?: boolean;
  };
  experimental?: Record<string, any>;
}

/**
 * Date range configuration
 */
export interface DateRangeConfig {
  startDate: Date;
  endDate: Date;
  preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'in' | 'notIn';
  value: string | number | string[] | number[];
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const defaultDataFetchingOptions: DataFetchingOptions = {
  enabled: true,
  refetchOnMount: true,
  refetchOnReconnect: true,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  retry: 3,
  retryDelay: 1000
};

const defaultDateRange: DateRangeConfig = {
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  endDate: new Date(),
  preset: 'last7days'
};

const defaultPagination: PaginationConfig = {
  page: 1,
  pageSize: 25
};

// ============================================================================
// GA4 DATA FETCHING HOOKS
// ============================================================================

/**
 * Hook for fetching GA4 data with caching and error handling
 * 
 * @example
 * ```tsx
 * function GADataComponent() {
 *   const { data, isLoading, error, refetch } = useGA4Data({
 *     metrics: ['sessions', 'pageviews'],
 *     dimensions: ['country', 'deviceCategory'],
 *     dateRange: {
 *       startDate: '2024-01-01',
 *       endDate: '2024-01-31'
 *     }
 *   });
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return (
 *     <div>
 *       <button onClick={refetch}>Refresh Data</button>
 *       <pre>{JSON.stringify(data, null, 2)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export const useGA4Data = (
  config: GA4MetricsConfig,
  options: DataFetchingOptions = {}
) => {
  const client = useMCPClient();
  const status = useMCPStatus();
  const finalOptions = { ...defaultDataFetchingOptions, ...options };
  const [state, setState] = useState<DataFetchingState>({
    isLoading: false,
    isRefreshing: false,
    fetchCount: 0
  });
  const configRef = useRef(config);
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Generate cache key based on config
  const cacheKey = useMemo(() => {
    return JSON.stringify(config);
  }, [config]);

  // Check if data is stale
  const isDataStale = useCallback((timestamp: number) => {
    return Date.now() - timestamp > finalOptions.staleTime!;
  }, [finalOptions.staleTime]);

  // Fetch GA4 data from MCP server
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!client || !status.isConnected) {
      throw new Error('MCP client not connected');
    }

    // Check cache first (unless refreshing)
    if (!isRefresh) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && !isDataStale(cached.timestamp)) {
        return cached.data;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Call MCP tool for GA4 data (placeholder implementation)
      // TODO: Implement actual MCP tool call when server is ready
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            metrics: configRef.current.metrics.map(metric => ({
              name: metric,
              value: Math.floor(Math.random() * 10000)
            })),
            dateRange: configRef.current.dateRange,
            timestamp: new Date().toISOString()
          });
        }, Math.random() * 1000 + 500); // Simulate network delay
      });

      // Cache the result
      cacheRef.current.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      // Clean old cache entries
      const now = Date.now();
      const entries = Array.from(cacheRef.current.entries());
      for (const [key, value] of entries) {
        if (now - value.timestamp > finalOptions.cacheTime!) {
          cacheRef.current.delete(key);
        }
      }

      return result;
    } finally {
      abortControllerRef.current = null;
    }
  }, [client, status.isConnected, cacheKey, isDataStale, finalOptions.cacheTime]);

  // Main fetch function with state management
  const performFetch = useCallback(async (isRefresh = false) => {
    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      error: undefined
    }));

    let attempt = 0;
    const maxRetries = typeof finalOptions.retry === 'number' ? finalOptions.retry : (finalOptions.retry ? 3 : 0);

    while (attempt <= maxRetries) {
      try {
        const data = await fetchData(isRefresh);
        
        setState(prev => ({
          ...prev,
          data,
          isLoading: false,
          isRefreshing: false,
          lastFetched: new Date(),
          fetchCount: prev.fetchCount + 1,
          error: undefined
        }));

        if (finalOptions.onSuccess) {
          finalOptions.onSuccess(data);
        }

        return data;
      } catch (error) {
        if (attempt === maxRetries) {
          const finalError = error as Error;
          setState(prev => ({
            ...prev,
            isLoading: false,
            isRefreshing: false,
            error: finalError,
            fetchCount: prev.fetchCount + 1
          }));

          if (finalOptions.onError) {
            finalOptions.onError(finalError);
          }

          throw finalError;
        }

        attempt++;
        if (finalOptions.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, finalOptions.retryDelay! * attempt));
        }
      }
    }
  }, [fetchData, finalOptions]);

  // Refetch function
  const refetch = useCallback(() => {
    return performFetch(true);
  }, [performFetch]);

  // Auto-fetch on mount and dependencies
  useEffect(() => {
    if (!finalOptions.enabled) return;

    if (finalOptions.refetchOnMount) {
      performFetch(false);
    }
  }, [performFetch, finalOptions.enabled, finalOptions.refetchOnMount, cacheKey]);

  // Refetch on reconnect
  useEffect(() => {
    if (finalOptions.refetchOnReconnect && status.isConnected && state.data) {
      performFetch(true);
    }
  }, [status.isConnected, finalOptions.refetchOnReconnect, performFetch, state.data]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    refetch,
    isStale: state.lastFetched ? isDataStale(state.lastFetched.getTime()) : true
  };
};

/**
 * Hook for fetching GA4 metrics with simplified configuration
 * 
 * @example
 * ```tsx
 * function MetricsDisplay() {
 *   const { data, isLoading, error } = useMetrics(['sessions', 'users', 'pageviews'], {
 *     dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
 *   });
 *   
 *   return (
 *     <div>
 *       {isLoading ? 'Loading...' : (
 *         <ul>
 *           {data?.metrics?.map((metric, index) => (
 *             <li key={index}>{metric.name}: {metric.value}</li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMetrics = (
  metrics: string[],
  config?: Partial<GA4MetricsConfig>,
  options?: DataFetchingOptions
) => {
  const fullConfig: GA4MetricsConfig = {
    metrics,
    dateRange: config?.dateRange || {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    ...config
  };

  return useGA4Data(fullConfig, options);
};

/**
 * Hook for fetching GA4 time series data
 * 
 * @example
 * ```tsx
 * function TimeSeriesChart() {
 *   const { data, isLoading, error } = useTimeSeries(['sessions'], 'day', {
 *     dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' }
 *   });
 *   
 *   return (
 *     <div>
 *       {isLoading ? 'Loading...' : (
 *         <div>
 *           {data?.timeSeries?.map((point, index) => (
 *             <div key={index}>{point.date}: {point.value}</div>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useTimeSeries = (
  metrics: string[],
  granularity: 'day' | 'week' | 'month' = 'day',
  config?: Partial<GA4TimeSeriesConfig>,
  options?: DataFetchingOptions
) => {
  const fullConfig: GA4TimeSeriesConfig = {
    metrics,
    granularity,
    dateRange: config?.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    ...config
  };

  return useGA4Data(fullConfig, options);
};

// ============================================================================
// RESOURCE MANAGEMENT HOOKS
// ============================================================================

/**
 * Hook for fetching MCP resources
 * 
 * @example
 * ```tsx
 * function ResourceList() {
 *   const { resources, isLoading, error, refresh } = useResources();
 *   
 *   return (
 *     <div>
 *       <button onClick={refresh}>Refresh Resources</button>
 *       {isLoading ? 'Loading...' : (
 *         <ul>
 *           {resources?.map((resource, index) => (
 *             <li key={index}>{resource.name}: {resource.uri}</li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useResources = (options: DataFetchingOptions = {}) => {
  const client = useMCPClient();
  const status = useMCPStatus();
  const finalOptions = { ...defaultDataFetchingOptions, ...options };
  const [state, setState] = useState<DataFetchingState<MCPResource[]>>({
    isLoading: false,
    isRefreshing: false,
    fetchCount: 0
  });

  const fetchResources = useCallback(async () => {
    if (!client || !status.isConnected) {
      throw new Error('MCP client not connected');
    }

    // TODO: Implement actual MCP listResources when server is ready
    // Placeholder implementation
    const mockResources: MCPResource[] = [
      {
        uri: 'ga4://analytics/reports',
        name: 'GA4 Analytics Reports',
        description: 'Google Analytics 4 reporting data',
        mimeType: 'application/json'
      },
      {
        uri: 'ga4://analytics/realtime',
        name: 'GA4 Real-time Data',
        description: 'Real-time analytics data from GA4',
        mimeType: 'application/json'
      }
    ];
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    return mockResources;
  }, [client, status.isConnected]);

  const performFetch = useCallback(async (isRefresh = false) => {
    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      error: undefined
    }));

    try {
      const resources = await fetchResources();
      
      setState(prev => ({
        ...prev,
        data: resources,
        isLoading: false,
        isRefreshing: false,
        lastFetched: new Date(),
        fetchCount: prev.fetchCount + 1,
        error: undefined
      }));

      if (finalOptions.onSuccess) {
        finalOptions.onSuccess(resources);
      }

      return resources;
    } catch (error) {
      const finalError = error as Error;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: finalError,
        fetchCount: prev.fetchCount + 1
      }));

      if (finalOptions.onError) {
        finalOptions.onError(finalError);
      }

      throw finalError;
    }
  }, [fetchResources, finalOptions]);

  const refresh = useCallback(() => {
    return performFetch(true);
  }, [performFetch]);

  useEffect(() => {
    if (finalOptions.enabled && finalOptions.refetchOnMount) {
      performFetch(false);
    }
  }, [performFetch, finalOptions.enabled, finalOptions.refetchOnMount]);

  useEffect(() => {
    if (finalOptions.refetchOnReconnect && status.isConnected && state.data) {
      performFetch(true);
    }
  }, [status.isConnected, finalOptions.refetchOnReconnect, performFetch, state.data]);

  return {
    resources: state.data,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    error: state.error,
    lastFetched: state.lastFetched,
    fetchCount: state.fetchCount,
    refresh
  };
};

/**
 * Hook for fetching MCP tools
 * 
 * @example
 * ```tsx
 * function ToolList() {
 *   const { tools, isLoading, error } = useTools();
 *   
 *   return (
 *     <div>
 *       {isLoading ? 'Loading...' : (
 *         <ul>
 *           {tools?.map((tool, index) => (
 *             <li key={index}>{tool.name}: {tool.description}</li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useTools = (options: DataFetchingOptions = {}) => {
  const client = useMCPClient();
  const status = useMCPStatus();
  const finalOptions = { ...defaultDataFetchingOptions, ...options };
  const [state, setState] = useState<DataFetchingState<MCPTool[]>>({
    isLoading: false,
    isRefreshing: false,
    fetchCount: 0
  });

  const fetchTools = useCallback(async () => {
    if (!client || !status.isConnected) {
      throw new Error('MCP client not connected');
    }

    // TODO: Implement actual MCP listTools when server is ready
    // Placeholder implementation
    const mockTools: MCPTool[] = [
      {
        name: 'getGA4Data',
        description: 'Fetch Google Analytics 4 data with specified metrics and dimensions',
        inputSchema: {
          type: 'object',
          properties: {
            metrics: { type: 'array', items: { type: 'string' } },
            dimensions: { type: 'array', items: { type: 'string' } },
            dateRange: { type: 'object' }
          }
        }
      },
      {
        name: 'getGA4TimeSeries',
        description: 'Fetch time series data from Google Analytics 4',
        inputSchema: {
          type: 'object',
          properties: {
            metrics: { type: 'array', items: { type: 'string' } },
            granularity: { type: 'string', enum: ['day', 'week', 'month'] }
          }
        }
      }
    ];
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    return mockTools;
  }, [client, status.isConnected]);

  const performFetch = useCallback(async (isRefresh = false) => {
    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      error: undefined
    }));

    try {
      const tools = await fetchTools();
      
      setState(prev => ({
        ...prev,
        data: tools,
        isLoading: false,
        isRefreshing: false,
        lastFetched: new Date(),
        fetchCount: prev.fetchCount + 1,
        error: undefined
      }));

      if (finalOptions.onSuccess) {
        finalOptions.onSuccess(tools);
      }

      return tools;
    } catch (error) {
      const finalError = error as Error;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: finalError,
        fetchCount: prev.fetchCount + 1
      }));

      if (finalOptions.onError) {
        finalOptions.onError(finalError);
      }

      throw finalError;
    }
  }, [fetchTools, finalOptions]);

  const refresh = useCallback(() => {
    return performFetch(true);
  }, [performFetch]);

  useEffect(() => {
    if (finalOptions.enabled && finalOptions.refetchOnMount) {
      performFetch(false);
    }
  }, [performFetch, finalOptions.enabled, finalOptions.refetchOnMount]);

  useEffect(() => {
    if (finalOptions.refetchOnReconnect && status.isConnected && state.data) {
      performFetch(true);
    }
  }, [status.isConnected, finalOptions.refetchOnReconnect, performFetch, state.data]);

  return {
    tools: state.data,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    error: state.error,
    lastFetched: state.lastFetched,
    fetchCount: state.fetchCount,
    refresh
  };
};

/**
 * Hook for fetching MCP capabilities
 * 
 * @example
 * ```tsx
 * function CapabilitiesDisplay() {
 *   const { capabilities, isLoading, error } = useCapabilities();
 *   
 *   return (
 *     <div>
 *       {isLoading ? 'Loading...' : (
 *         <pre>{JSON.stringify(capabilities, null, 2)}</pre>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useCapabilities = (options: DataFetchingOptions = {}) => {
  const client = useMCPClient();
  const status = useMCPStatus();
  const finalOptions = { ...defaultDataFetchingOptions, ...options };
  const [state, setState] = useState<DataFetchingState<MCPCapabilities>>({
    isLoading: false,
    isRefreshing: false,
    fetchCount: 0
  });

  const fetchCapabilities = useCallback(async () => {
    if (!client || !status.isConnected) {
      throw new Error('MCP client not connected');
    }

    // TODO: Implement actual MCP getCapabilities when server is ready
    // Placeholder implementation
    const mockCapabilities: MCPCapabilities = {
      resources: {
        subscribe: true,
        listChanged: true
      },
      tools: {
        getGA4Data: { description: 'Fetch GA4 analytics data' },
        getGA4TimeSeries: { description: 'Fetch GA4 time series data' }
      },
      prompts: {
        listChanged: false
      },
      experimental: {
        streaming: false,
        caching: true
      }
    };
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
    return mockCapabilities;
  }, [client, status.isConnected]);

  const performFetch = useCallback(async (isRefresh = false) => {
    setState(prev => ({
      ...prev,
      isLoading: !isRefresh,
      isRefreshing: isRefresh,
      error: undefined
    }));

    try {
      const capabilities = await fetchCapabilities();
      
      setState(prev => ({
        ...prev,
        data: capabilities,
        isLoading: false,
        isRefreshing: false,
        lastFetched: new Date(),
        fetchCount: prev.fetchCount + 1,
        error: undefined
      }));

      if (finalOptions.onSuccess) {
        finalOptions.onSuccess(capabilities);
      }

      return capabilities;
    } catch (error) {
      const finalError = error as Error;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: finalError,
        fetchCount: prev.fetchCount + 1
      }));

      if (finalOptions.onError) {
        finalOptions.onError(finalError);
      }

      throw finalError;
    }
  }, [fetchCapabilities, finalOptions]);

  const refresh = useCallback(() => {
    return performFetch(true);
  }, [performFetch]);

  useEffect(() => {
    if (finalOptions.enabled && finalOptions.refetchOnMount) {
      performFetch(false);
    }
  }, [performFetch, finalOptions.enabled, finalOptions.refetchOnMount]);

  useEffect(() => {
    if (finalOptions.refetchOnReconnect && status.isConnected && state.data) {
      performFetch(true);
    }
  }, [status.isConnected, finalOptions.refetchOnReconnect, performFetch, state.data]);

  return {
    capabilities: state.data,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    error: state.error,
    lastFetched: state.lastFetched,
    fetchCount: state.fetchCount,
    refresh
  };
};