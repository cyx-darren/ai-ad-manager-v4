/**
 * MCP Hooks Module Exports
 * 
 * This file exports all MCP React hooks for easy importing
 * throughout the application.
 */

// Connection Management Hooks
export {
  useConnect,
  useDisconnect,
  useReconnect,
  useConnectionManagement,
  type UseConnectReturn,
  type UseDisconnectReturn,
  type UseReconnectReturn,
  type UseConnectionManagementReturn,
  type ConnectionResult,
  type ConnectionHookState
} from './connectionHooks';

// Status Monitoring Hooks
export {
  useConnectionStatus,
  useHealthCheck,
  type UseConnectionStatusReturn,
  type UseHealthCheckReturn,
  type ExtendedConnectionStatus,
  type HealthCheckResult,
  type HealthMonitoringConfig
} from './statusHooks';

// Error Handling Hooks
export {
  useErrorRecovery,
  useMCPErrors,
  type UseErrorRecoveryReturn,
  type UseMCPErrorsReturn,
  type MCPError,
  type ErrorRecoveryStrategy,
  type ErrorRecoveryResult,
  type ErrorStatistics,
  type ErrorSeverity,
  type ErrorCategory
} from './errorHooks';

// Data Fetching Hooks (Phase 2)
export {
  useGA4Data,
  useMetrics,
  useTimeSeries,
  useResources,
  useTools,
  useCapabilities,
  type DataFetchingState,
  type DataFetchingOptions,
  type GA4MetricsConfig,
  type GA4TimeSeriesConfig,
  type MCPResource,
  type MCPTool,
  type MCPCapabilities
} from './dataHooks';

// Query Parameter Hooks (Phase 2)
export {
  useDateRange,
  useFilters,
  usePagination,
  useQueryParams,
  type DateRangeConfig,
  type UseDateRangeReturn,
  type FilterConfig,
  type FilterOperator,
  type FilterValue,
  type UseFiltersReturn,
  type PaginationConfig,
  type UsePaginationReturn,
  type QueryParams,
  type UseQueryParamsReturn
} from './queryHooks';

// Advanced Operation Hooks (Phase 3)
export {
  useBatchRequests,
  useParallelOperations,
  useCachedData,
  useInvalidateCache,
  useStaleWhileRevalidate,
  useRetryableOperation,
  useTimeoutHandler,
  type BatchRequestConfig,
  type BatchRequestResult,
  type BatchOperationState,
  type ParallelOperationConfig,
  type CacheEntry,
  type CacheConfig,
  type CacheMetrics,
  type RetryConfig,
  type TimeoutConfig,
  type OperationContext
} from './advancedHooks';

// Real-time & Subscription Hooks (Phase 4)
export {
  useSubscription,
  useLiveUpdates,
  useEventStream,
  useRealTimeMetrics,
  useLiveConnectionStatus,
  type SubscriptionConfig,
  type SubscriptionState,
  type LiveUpdatesConfig,
  type EventStreamConfig,
  type EventStreamEvent,
  type RealTimeMetricsConfig,
  type ConnectionQuality,
  type WebSocketMessage
} from './realtimeHooks';

// Notification & Alert Hooks (Phase 4)
export {
  useConnectionNotifications,
  useDataChangeAlerts,
  useNotificationManager,
  type NotificationConfig,
  type Notification,
  type NotificationAction,
  type DataChangeAlertConfig,
  type MetricThreshold,
  type DataAlert,
  type NotificationState,
  type AlertState
} from './notificationHooks';

// Integration & Optimization Hooks (Phase 5)
export {
  useDebounced,
  useThrottled,
  useMemoizedQuery,
  useDashboardIntegration,
  useWidgetData,
  useAutoRefresh,
  usePerformanceMetrics,
  useHookDebugger,
  useOperationHistory,
  type PerformanceMetrics,
  type HookDebugInfo,
  type OperationHistoryEntry,
  type DashboardIntegrationConfig,
  type WidgetDataConfig,
  type AutoRefreshConfig,
  type DebounceConfig,
  type ThrottleConfig
} from './integrationHooks';

// Specialized Tool Hooks (Subtask 27.4)
export {
  useMCPAnalytics,
  useMCPRealtime,
  useMCPTrafficSources,
  useMCPPagePerformance,
  useMCPConversions,
  type AnalyticsQueryConfig,
  type RealtimeConfig,
  type TrafficSourcesConfig,
  type PagePerformanceConfig,
  type ConversionsConfig,
  type AnalyticsResult,
  type RealtimeResult,
  type TrafficSourcesResult,
  type PagePerformanceResult,
  type ConversionsResult
} from './toolHooks';

// Re-export context hooks for convenience
export {
  useMCPContext,
  useMCPClient,
  useMCPStatus
} from '../context';