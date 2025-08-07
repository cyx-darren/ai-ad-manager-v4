/**
 * MCP Client Library - Main Entry Point
 * 
 * This file exports all the main MCP client functionality for easy importing
 * throughout the application.
 */

// Core client imports for internal use
import {
  MCPClient,
  createMCPClient,
  createProductionMCPClient,
  MCPConnectionState,
  type MCPClientConfig,
  type MCPConnectionEvents,
  type MCPClientStatus,
  type MCPConnectionPoolConfig,
  type MCPRetryConfig,
  type MCPConnectionMetrics,
  type MCPPersistedState,
  type MCPLoggingConfig,
  type MCPEnvironmentConfig,
  type MCPValidationConfig,
  type MCPDebugConfig
} from './client';

// Core client exports
export {
  MCPClient,
  createMCPClient,
  createProductionMCPClient,
  MCPConnectionState,
  type MCPClientConfig,
  type MCPConnectionEvents,
  type MCPClientStatus,
  type MCPConnectionPoolConfig,
  type MCPRetryConfig,
  type MCPConnectionMetrics,
  type MCPPersistedState,
  type MCPLoggingConfig,
  type MCPEnvironmentConfig,
  type MCPValidationConfig,
  type MCPDebugConfig
} from './client';

// Context and provider (Subtask 27.2 - Phase 1)
export * from './context';

// Type definitions (to be implemented in Phase 4)
// export * from './types';

// Hooks (Subtask 27.3 - Phase 1: Basic MCP Operation Hooks)
export * from './hooks';

// Authentication (Subtask 28.1 - Phase 1: Foundation Setup)
export * from './auth';

// Data adapters (Subtask 27.5 - Complete)
export * from './adapters';

// Utilities - Offline Detection (Subtask 28.5 - Phase 1)
export * from './utils/offlineDetection';
export * from './hooks/offlineHooks';
// Critical exports for verification
export { OfflineDetectionManager } from './utils/offlineDetection';
export { useOfflineDetection } from './hooks/offlineHooks';

// Utilities - Fallback Management (Subtask 28.5 - Phase 2)
export * from './utils/fallbackManager';
export * from './hooks/fallbackHooks';
// Critical exports for verification
export { FallbackManager } from './utils/fallbackManager';
export { useFallbackManager } from './hooks/fallbackHooks';

// UI Components - Offline Experience (Subtask 28.5 - Phase 3)
// Note: Specific exports below to avoid conflicts
// Critical exports for verification
export { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
export { OfflineNotification } from './components/OfflineNotification';
export { default as OfflineDashboard } from './components/OfflineDashboard';

// Utilities - Data Caching & Persistence (Subtask 28.5 - Phase 4)
// Note: Specific exports below to avoid conflicts
// Critical exports for verification
export { CacheManager } from './utils/cacheManager';
export { useCache } from './hooks/cacheHooks';

// Utilities - Recovery & Synchronization (Subtask 28.5 - Phase 5)
export * from './utils/recoveryManager';
export * from './hooks/recoveryHooks';
// Critical exports for verification
export { RecoveryManager } from './utils/recoveryManager';

// Testing & Edge Cases (Subtask 28.5 - Phase 6)
export * from './testing/offlineScenarios';
export * from './testing/edgeCaseHandler';
export * from './testing/userExperienceValidator';

// Real-time Connection Monitoring (Subtask 28.6 - Phase 1)
export * from './utils/connectionMonitor';
export * from './hooks/connectionHooks';
export * from './types/connection';
// Critical exports for verification
export { ConnectionMonitor, createConnectionMonitor, getGlobalConnectionMonitor } from './utils/connectionMonitor';
export { useConnectionMonitor, useNetworkQuality, useConnectionHealth, useLatencyMonitor, useBandwidthMonitor } from './hooks/connectionHooks';
export type { ConnectionState, NetworkQuality, ConnectionQualityMetrics, ConnectionHealth } from './types/connection';

// MCP Server Health Monitoring (Subtask 28.6 - Phase 2)
export * from './utils/serverHealthMonitor';
export * from './hooks/serverHealthHooks';
export * from './types/serverHealth';
// Critical exports for verification
export { ServerHealthMonitor, createServerHealthMonitor, getGlobalServerHealthMonitor } from './utils/serverHealthMonitor';
export { useServerHealth, useHeartbeatMonitor, useServiceAvailability, useEndpointHealth, useServerResponseTime } from './hooks/serverHealthHooks';
export type { ServerHealthState, ServiceStatus, ServerHealthMetrics, ServiceHealth, EndpointHealth } from './types/serverHealth';

// Visual Status Indicators & Alerts (Subtask 28.6 - Phase 3)
export * from './components/StatusIndicator';
export * from './components/ConnectionQualityChart';
export * from './components/ConnectionAlert';
export * from './components/StatusDashboard';
// Critical exports for verification
export { StatusIndicator, ConnectionStatusIndicator, ServerHealthStatusIndicator } from './components/StatusIndicator';
export { ConnectionQualityChart } from './components/ConnectionQualityChart';
export { ConnectionAlert } from './components/ConnectionAlert';
export { StatusDashboard } from './components/StatusDashboard';

// Historical Connection Analytics (Subtask 28.6 - Phase 4)
// Note: Specific exports below to avoid conflicts
// Critical exports for verification
export { AnalyticsManager, createAnalyticsManager, getGlobalAnalyticsManager } from './utils/analyticsManager';
export { useAnalytics, useUptimeAnalytics, useQualityTrends, usePerformanceMetrics as usePerformanceMetricsHook, useConnectionEvents, useHistoricalComparison, useAnalyticsIntegration } from './hooks/analyticsHooks';
export { AnalyticsDashboard, AnalyticsSummary as AnalyticsSummaryComponent } from './components/AnalyticsDashboard';
export { PerformanceChart, LatencyChart, BandwidthChart, QualityChart, CombinedChart } from './components/PerformanceChart';
export type { ConnectionEvent, UptimeAnalytics, QualityTrends, PerformanceMetrics, AnalyticsSummary, AnalyticsConfig, Outage } from './types/analytics';

// Predictive Connection Intelligence (Subtask 28.6 - Phase 5)
export * from './types/predictive';
export * from './utils/predictiveEngine';
export * from './hooks/predictiveHooks';
export * from './components/PredictiveIndicators';
// Critical exports for verification
export { PredictiveEngine, createPredictiveEngine, getGlobalPredictiveEngine } from './utils/predictiveEngine';
export { usePredictiveEngine, useDisconnectPrediction, useReconnectionStrategy, useConnectionPatterns, useProactiveNotifications, useMLModelMonitoring, usePredictiveIntegration } from './hooks/predictiveHooks';
export { DisconnectWarning, ConnectionForecast, ReconnectionAssistant, NetworkInsights, PredictiveNotificationToast, PredictiveDashboard } from './components/PredictiveIndicators';
export type { ConnectionPattern, DisconnectPrediction, ReconnectionStrategy, ProactiveNotification, PredictiveEngineConfig, PredictiveIntelligenceState, PatternType, StrategyType, NotificationType, NotificationPriority } from './types/predictive';

// Integration & Performance Optimization (Subtask 28.6 - Phase 6)
// Note: Specific exports below to avoid duplicates
// Critical exports for verification
export type { MonitoringConfig } from './config/monitoringConfig';
export { createMonitoringConfig } from './config/monitoringConfig';
export { StorageManager, createStorageManager } from './utils/storageManager';
export { PerformanceOptimizer, createPerformanceOptimizer } from './utils/performanceOptimizer';
export { OfflineIntegration, createOfflineIntegration } from './integration/offlineIntegration';
export type { StorageLayer, StorageEntry, StorageStats } from './utils/storageManager';
export type { PerformanceMetrics as OptimizerPerformanceMetrics, OptimizationSettings, BatchOperation, ResourceMonitor } from './utils/performanceOptimizer';
export type { OfflineState, OfflineOperation, UnifiedStatus, ReconnectionStrategy as OfflineReconnectionStrategy } from './integration/offlineIntegration';

// Multi-Property Support (Subtask 28.7 - Phase 1 & 2)
// Note: Specific exports below to avoid duplicates

// Critical exports for verification
export { PropertyDiscoveryService, createPropertyDiscoveryService, discoverGA4Properties, fetchGA4Property, validateGA4Properties } from './utils/propertyDiscovery';
export { PropertyValidationService, createPropertyValidationService, validateGA4Property, processProperties, checkPropertiesForOperation, getPropertyRecommendations } from './utils/propertyValidation';
export { PropertyCacheService, PropertyCacheManager, getPropertyCache, createPropertyCache, PropertyCacheUtils } from './utils/propertyCache';
export { PropertyPersistenceService, getPropertyPersistenceService, createPropertyPersistenceService, saveSelectedProperty, loadSelectedProperty, savePropertyState, loadPropertyState, clearAllPropertyData } from './utils/propertyPersistence';
export { usePropertySelection, usePropertyDiscovery, usePropertyCache, usePropertyValidation, usePropertyPermissions, usePropertyManager } from './hooks/propertyHooks';
export { PropertyProvider, usePropertyContext, useSelectedProperty, useAvailableProperties, usePropertyFilter, withPropertyContext } from './context/PropertyContext';

// Property types
export type { 
  GA4Property, 
  PropertyType, 
  PropertyStatus, 
  PropertyAccessLevel, 
  PropertyPermission,
  PropertySelectionState,
  PropertyFilter,
  PropertySort,
  PropertyDiscoveryConfig,
  PropertyValidationResult,
  PropertyError,
  PropertyCache,
  CachedProperty,
  PropertyManagementContext,
  PropertyManagementActions
} from './types/property';

// Property persistence types
export type {
  PropertyPersistenceConfig,
  PersistedPropertyState
} from './utils/propertyPersistence';

// Property context types
export type {
  PropertyContextState,
  PropertyContextValue
} from './context/PropertyContext';

// MCP Integration & API Updates (Subtask 28.7 - Phase 4)
// Note: Specific exports below to avoid duplicates

// Critical exports for verification
export { PropertyAwareGA4Service, propertyAwareGA4Service, usePropertyAwareGA4Service } from './services/propertyAwareGA4Service';
export { PropertyValidationMiddleware, defaultPropertyValidation, validatePropertyOperation, withPropertyValidation } from './middleware/propertyValidation';
export { PropertyAwareMCPClient, createPropertyAwareMCPClient, createProductionPropertyAwareMCPClient, propertyAwareMCPClient } from './client/propertyAwareMCPClient';
export { PropertyAuthManager, defaultPropertyAuth, authenticateWithProperties, switchPropertyContext, validatePropertyAccess, getPropertyAuthStatus } from './auth/propertyAuth';

// Property-aware service types
export type {
  PropertyAwareRequest,
  PropertyRequestContext,
  PropertyValidationResult as PropertyServiceValidationResult,
  PropertyAwareResponse
} from './services/propertyAwareGA4Service';

// Property validation types
export type {
  PropertyValidationConfig,
  PropertyValidationContext,
  PropertyValidationResult as MiddlewarePropertyValidationResult,
  PropertyOperation,
  PropertyOperationType
} from './middleware/propertyValidation';

// Property-aware MCP types
export type {
  PropertyAwareMCPRequest,
  PropertyAwareMCPResponse,
  PropertyMCPClientConfig
} from './client/propertyAwareMCPClient';

// Property authentication types
export type {
  PropertyAuthScope,
  PropertyAuthCredentials,
  PropertyAuthConfig,
  PropertyAuthStatus,
  PropertyAuthenticationResult
} from './auth/propertyAuth';

// Persistence & User Experience (Subtask 28.7 - Phase 5)
// Note: Specific exports below to avoid duplicates

// Testing & Edge Cases (Subtask 28.7 - Phase 6)
// Note: Specific exports below to avoid duplicates

// State Synchronization (Subtask 28.8 - Phase 1)
// Note: Specific exports below to avoid duplicates

// State Synchronization (Subtask 28.8 - Phase 2) 
// Note: Specific exports below to avoid duplicates

// State Synchronization (Subtask 28.8 - Phase 3)
// Note: Specific exports below to avoid duplicates with Phase 5

// State Synchronization (Subtask 28.8 - Phase 4)
// Note: Specific exports below to avoid duplicates

// Critical exports for verification
export { EnhancedSessionPersistence, enhancedSessionPersistence } from './ux/sessionPersistence';
export { PropertyLoadingManager, propertyLoadingManager, usePropertyLoading } from './ux/loadingStates';
export { PropertyErrorHandler, propertyErrorHandler, usePropertyErrorHandler } from './ux/errorHandling';
export { PropertyNotificationService, propertyNotificationService, usePropertyNotifications } from './ux/notifications';

// Phase 6 exports
export { EdgeCaseHandler, edgeCaseHandler } from './testing/edgeCaseHandler';
export { OfflineScenariosHandler, offlineScenariosHandler } from './testing/offlineScenarios';
export { UserExperienceValidator, userExperienceValidator } from './testing/userExperienceValidator';

// Phase 1 exports (Subtask 28.8)
export { DateRangeSyncManager, dateRangeSyncManager } from './utils/dateRangeSync';
export { useSyncedDateRange, useDateRangeSync, useDateRangeValidation } from './hooks/dateRangeHooks';

// Phase 2 exports (Subtask 28.8)
export { FilterSyncManager, filterSyncManager } from './utils/filterSync';
export { useSyncedFilters, useFilterPresets, useFilterSync, useFilterValidation } from './hooks/filterHooks';

// Phase 3 exports (Subtask 28.8)
export { StateUpdateQueue, stateUpdateQueue } from './utils/stateQueue';
export { ConcurrentUpdateHandler, concurrentUpdateHandler } from './utils/concurrentUpdates';
export { ConflictResolutionManager, conflictResolutionManager } from './utils/conflictResolution';
export { useRaceConditionHandler, useQueueStats, useConflictMonitor, useSafeStateUpdate } from './hooks/raceConditionHooks';

// Phase 4 exports (Subtask 28.8)
export { ComponentStateRegistry, componentStateRegistry } from './utils/componentRegistry';
export { StateChangeEventManager, stateChangeEventManager } from './utils/stateEvents';
export { ComponentStateValidator, componentStateValidator } from './utils/stateValidator';
export { useCrossComponentState, useComponentEvents, useRegistryMonitor, useValidationMonitor } from './hooks/crossComponentHooks';

// UX and session types
export type {
  SessionPersistenceConfig,
  PropertySession,
  PropertyUserPreferences,
  SessionRecoveryData,
  SessionAnalytics
} from './ux/sessionPersistence';

// Loading state types
export type {
  LoadingState,
  LoadingOperation,
  LoadingConfig,
  PropertyLoadingState,
  LoadingProgress,
  SkeletonConfig,
  UsePropertyLoadingResult
} from './ux/loadingStates';

// Error handling types
export type {
  PropertyErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  PropertyErrorContext,
  EnhancedPropertyError,
  RecoveryResult,
  ErrorBoundaryState
} from './ux/errorHandling';

// Notification types
export type {
  NotificationType as UXNotificationType,
  NotificationPosition,
  NotificationConfig,
  PropertyNotification,
  NotificationAction,
  ConfirmationDialog,
  FeedbackConfig
} from './ux/notifications';

// Testing & Edge Case types
export type {
  EdgeCaseScenario,
  EdgeCaseConfig,
  EdgeCaseResult
} from './testing/edgeCaseHandler';

export type {
  OfflineScenario,
  OfflineConfig,
  OfflineState as TestingOfflineState,
  OfflineAction,
  OfflineResult
} from './testing/offlineScenarios';

export type {
  UXValidationCategory,
  UXValidationRule,
  UXValidationResult,
  UXIssue,
  UXValidationReport
} from './testing/userExperienceValidator';

// State Synchronization types (Subtask 28.8 - Phase 1)
export type {
  DateRangeLimits,
  DateRangeValidationResult,
  DateRangeSyncConfig,
  DateRangeEventData
} from './utils/dateRangeSync';

export type {
  DateRangeHookOptions,
  SyncedDateRangeResult
} from './hooks/dateRangeHooks';

// Filter Synchronization types (Subtask 28.8 - Phase 2)
export type {
  FilterDependency,
  FilterValidationResult,
  FilterConflict,
  FilterSyncConfig,
  FilterEventData,
  FilterPreset
} from './utils/filterSync';

export type {
  FilterHookOptions,
  SyncedFilterResult
} from './hooks/filterHooks';

// Race Condition Handling types (Subtask 28.8 - Phase 3)
export type {
  StateUpdate,
  UpdatePriority,
  QueueConfig,
  QueueStats
} from './utils/stateQueue';

export type {
  VersionedState,
  UpdateContext,
  ConflictInfo,
  MergeResult
} from './utils/concurrentUpdates';

export type {
  ResolutionStrategy,
  ResolutionConfig,
  ResolutionContext,
  ResolutionResult
} from './utils/conflictResolution';

export type {
  RaceConditionOptions,
  SafeUpdateResult,
  RaceConditionState
} from './hooks/raceConditionHooks';

// Cross-Component State Consistency types (Subtask 28.8 - Phase 4)
export type {
  ComponentRegistration,
  ComponentSnapshot,
  ComponentDependency,
  RegistryStats
} from './utils/componentRegistry';

export type {
  StateChangeEvent,
  EventSubscription,
  EventBatch,
  EventReplay,
  EventStats
} from './utils/stateEvents';

export type {
  ValidationRule,
  ValidationSchema,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CrossComponentValidation,
  StateIntegrityCheck
} from './utils/stateValidator';

export type {
  CrossComponentOptions,
  ComponentState,
  CrossComponentResult
} from './hooks/crossComponentHooks';

// State Synchronization (Subtask 28.8 - Phase 5)
// Note: Specific exports below to avoid duplicates

// Phase 5 exports (Subtask 28.8)
export { RenderOptimizer, renderOptimizer } from './utils/renderOptimizer';
export { UpdateBatcher, updateBatcher } from './utils/updateBatcher';
export { ChangeDetector, changeDetector } from './utils/changeDetection';
export { 
  useOptimizedRender, 
  useBatchedUpdates, 
  useChangeDetection, 
  useRenderMetrics,
  useDependencyTracking,
  usePerformanceDebug,
  useMemoryOptimization,
  performanceUtils
} from './hooks/performanceHooks';

// Performance Optimization types (Subtask 28.8 - Phase 5)
export type {
  RenderMetrics,
  RenderOptimizationConfig,
  ComponentRenderData,
  RenderStats
} from './utils/renderOptimizer';

export type {
  UpdateBatch,
  StateUpdate as BatcherStateUpdate,
  UpdateBatchConfig,
  BatchStats,
  UpdateResult
} from './utils/updateBatcher';

export type {
  ChangeDetectionOptions,
  ChangeDetectionConfig,
  ComparisonResult,
  ChangeDetectionStats,
  CustomComparator,
  CacheEntry
} from './utils/changeDetection';

export type {
  PerformanceConfig,
  RenderHookOptions,
  BatchedUpdateOptions,
  ChangeDetectionHookOptions,
  PerformanceMetrics as HookPerformanceMetrics
} from './hooks/performanceHooks';

// State Synchronization (Subtask 28.8 - Phase 6)
// Note: Specific exports below to avoid duplicates

// Phase 6 exports (Subtask 28.8)
export { SyncTestSuite, syncTestSuite } from './testing/syncTestSuite';
export { SyncMonitor, syncMonitor } from './monitoring/syncMonitor';
export { StateConsistencyValidator, stateConsistencyValidator } from './validation/stateConsistencyValidator';

// Phase 6 utility exports for enhanced integration
// Note: Only specific available exports from syncTestSuite

// Note: Only core exports available from monitoring and validation modules

// Testing & Validation types (Subtask 28.8 - Phase 6)
export type {
  TestResult,
  TestSuite,
  SyncTestConfig
} from './testing/syncTestSuite';

export type {
  SyncStatus,
  SyncEvent,
  SyncMetrics,
  DebugConfig
} from './monitoring/syncMonitor';

export type {
  ValidationSuggestion,
  ValidationSummary,
  ConsistencyCheck
} from './validation/stateConsistencyValidator';

/**
 * Version information
 */
export const MCP_CLIENT_VERSION = '1.0.0-alpha';

/**
 * Default MCP client instance (singleton pattern)
 * This can be used throughout the app for a shared connection
 */
let defaultMCPClient: MCPClient | null = null;

/**
 * Get or create the default MCP client instance
 */
export function getDefaultMCPClient(): MCPClient {
  if (!defaultMCPClient) {
    defaultMCPClient = createProductionMCPClient();
  }
  return defaultMCPClient;
}

/**
 * Reset the default MCP client (useful for testing)
 */
export function resetDefaultMCPClient(): void {
  if (defaultMCPClient) {
    defaultMCPClient.disconnect();
    defaultMCPClient = null;
  }
}