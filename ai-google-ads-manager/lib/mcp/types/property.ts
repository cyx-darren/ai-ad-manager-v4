/**
 * GA4 Property Management Types
 * 
 * Types and interfaces for managing multiple GA4 properties,
 * property discovery, validation, and caching.
 * 
 * This file provides comprehensive TypeScript type safety for the entire
 * property management system with strict typing and validation.
 */

// Core GA4 Property Interface
export interface GA4Property {
  /** Unique property ID (e.g., "123456789") */
  id: string;
  
  /** Display name of the property */
  name: string;
  
  /** Property resource name (e.g., "properties/123456789") */
  resourceName: string;
  
  /** Website URL or app bundle ID */
  displayName: string;
  
  /** Property type */
  propertyType: PropertyType;
  
  /** Industry category */
  industryCategory: string;
  
  /** Time zone */
  timeZone: string;
  
  /** Currency code */
  currencyCode: string;
  
  /** Property create time */
  createTime: string;
  
  /** Property update time */
  updateTime: string;
  
  /** Property status */
  status: PropertyStatus;
  
  /** User's access level for this property */
  accessLevel: PropertyAccessLevel;
  
  /** Available permissions for this property */
  permissions: PropertyPermission[];
  
  /** Property metadata */
  metadata: PropertyMetadata;
}

// Property Types
export enum PropertyType {
  WEB = 'WEB',
  IOS_APP = 'IOS_APP',
  ANDROID_APP = 'ANDROID_APP'
}

// Property Status
export enum PropertyStatus {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
  SUSPENDED = 'SUSPENDED'
}

// Property Access Levels
export enum PropertyAccessLevel {
  NO_ACCESS = 'NO_ACCESS',
  READ_ONLY = 'READ_ONLY',
  STANDARD = 'STANDARD',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN'
}

// Property Permissions
export enum PropertyPermission {
  READ_DATA = 'READ_DATA',
  EDIT_DATA = 'EDIT_DATA',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
  DELETE_PROPERTY = 'DELETE_PROPERTY'
}

// Property Metadata
export interface PropertyMetadata {
  /** Data streams associated with the property */
  dataStreams: DataStream[];
  
  /** Measurement ID (for web properties) */
  measurementId?: string;
  
  /** Firebase link status */
  firebaseLinked: boolean;
  
  /** Google Ads link status */
  googleAdsLinked: boolean;
  
  /** Enhanced ecommerce enabled */
  enhancedEcommerceEnabled: boolean;
  
  /** Last data received timestamp */
  lastDataReceived?: string;
  
  /** Property health status */
  healthStatus: PropertyHealthStatus;
}

// Data Stream Interface
export interface DataStream {
  id: string;
  name: string;
  type: DataStreamType;
  webStreamData?: WebStreamData;
  iosAppStreamData?: IosAppStreamData;
  androidAppStreamData?: AndroidAppStreamData;
}

export enum DataStreamType {
  WEB_DATA_STREAM = 'WEB_DATA_STREAM',
  IOS_APP_DATA_STREAM = 'IOS_APP_DATA_STREAM',
  ANDROID_APP_DATA_STREAM = 'ANDROID_APP_DATA_STREAM'
}

export interface WebStreamData {
  measurementId: string;
  firebaseAppId?: string;
  defaultUri?: string;
}

export interface IosAppStreamData {
  firebaseAppId: string;
  bundleId: string;
}

export interface AndroidAppStreamData {
  firebaseAppId: string;
  packageName: string;
}

// Property Health Status
export enum PropertyHealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  NO_DATA = 'NO_DATA'
}

// Property Selection State
export interface PropertySelectionState {
  /** Currently selected property */
  selectedProperty: GA4Property | null;
  
  /** All available properties */
  availableProperties: GA4Property[];
  
  /** Property loading state */
  isLoading: boolean;
  
  /** Property selection error */
  error: PropertyError | null;
  
  /** Last refresh timestamp */
  lastRefresh: string | null;
  
  /** Filter applied to properties */
  filter: PropertyFilter;
  
  /** Sort configuration */
  sort: PropertySort;
}

// Property Filter Interface
export interface PropertyFilter {
  /** Filter by property type */
  propertyTypes?: PropertyType[];
  
  /** Filter by access level */
  accessLevels?: PropertyAccessLevel[];
  
  /** Filter by status */
  statuses?: PropertyStatus[];
  
  /** Search query */
  searchQuery?: string;
  
  /** Show only properties with data */
  hasDataOnly?: boolean;
  
  /** Show only recently active properties */
  recentlyActiveOnly?: boolean;
}

// Property Sort Configuration
export interface PropertySort {
  /** Sort field */
  field: PropertySortField;
  
  /** Sort direction */
  direction: 'asc' | 'desc';
}

export enum PropertySortField {
  NAME = 'name',
  CREATE_TIME = 'createTime',
  UPDATE_TIME = 'updateTime',
  LAST_DATA_RECEIVED = 'lastDataReceived',
  ACCESS_LEVEL = 'accessLevel'
}

// Property Discovery Configuration
export interface PropertyDiscoveryConfig {
  /** Enable automatic property discovery */
  autoDiscovery: boolean;
  
  /** Discovery refresh interval in milliseconds */
  refreshInterval: number;
  
  /** Maximum number of properties to cache */
  maxCacheSize: number;
  
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  
  /** Include inactive properties */
  includeInactive: boolean;
  
  /** Minimum access level required */
  minAccessLevel: PropertyAccessLevel;
  
  /** Retry configuration */
  retryConfig: PropertyRetryConfig;
}

// Property Retry Configuration
export interface PropertyRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  
  /** Base delay between retries */
  baseDelay: number;
  
  /** Maximum delay between retries */
  maxDelay: number;
  
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
}

// Property Cache Interface
export interface PropertyCache {
  /** Cached properties */
  properties: Map<string, CachedProperty>;
  
  /** Cache metadata */
  metadata: PropertyCacheMetadata;
  
  /** Cache configuration */
  config: PropertyCacheConfig;
}

// Cached Property Interface
export interface CachedProperty {
  /** Property data */
  property: GA4Property;
  
  /** Cache timestamp */
  cachedAt: string;
  
  /** Expiry timestamp */
  expiresAt: string;
  
  /** Access count */
  accessCount: number;
  
  /** Last accessed timestamp */
  lastAccessed: string;
}

// Property Cache Metadata
export interface PropertyCacheMetadata {
  /** Total cached properties */
  totalProperties: number;
  
  /** Cache hit rate */
  hitRate: number;
  
  /** Cache miss rate */
  missRate: number;
  
  /** Last cleanup timestamp */
  lastCleanup: string;
  
  /** Memory usage estimate */
  memoryUsage: number;
}

// Property Cache Configuration
export interface PropertyCacheConfig {
  /** Maximum cache size */
  maxSize: number;
  
  /** TTL in milliseconds */
  ttl: number;
  
  /** Cleanup interval */
  cleanupInterval: number;
  
  /** Enable LRU eviction */
  enableLruEviction: boolean;
  
  /** Enable persistence */
  enablePersistence: boolean;
  
  /** Storage key for persistence */
  storageKey: string;
}

// Property Validation Interface
export interface PropertyValidationResult {
  /** Validation passed */
  isValid: boolean;
  
  /** Validation errors */
  errors: PropertyValidationError[];
  
  /** Validation warnings */
  warnings: PropertyValidationWarning[];
  
  /** Validation score (0-100) */
  score: number;
}

// Property Validation Error
export interface PropertyValidationError {
  /** Error code */
  code: PropertyValidationErrorCode;
  
  /** Error message */
  message: string;
  
  /** Field causing the error */
  field?: string;
  
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

export enum PropertyValidationErrorCode {
  INVALID_PROPERTY_ID = 'INVALID_PROPERTY_ID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  PROPERTY_NOT_FOUND = 'PROPERTY_NOT_FOUND',
  PROPERTY_INACTIVE = 'PROPERTY_INACTIVE',
  INVALID_ACCESS_LEVEL = 'INVALID_ACCESS_LEVEL',
  MISSING_DATA_STREAM = 'MISSING_DATA_STREAM',
  INVALID_MEASUREMENT_ID = 'INVALID_MEASUREMENT_ID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

// Property Validation Warning
export interface PropertyValidationWarning {
  /** Warning code */
  code: PropertyValidationWarningCode;
  
  /** Warning message */
  message: string;
  
  /** Field causing the warning */
  field?: string;
}

export enum PropertyValidationWarningCode {
  NO_RECENT_DATA = 'NO_RECENT_DATA',
  LIMITED_PERMISSIONS = 'LIMITED_PERMISSIONS',
  DEPRECATED_FEATURES = 'DEPRECATED_FEATURES',
  CONFIGURATION_ISSUES = 'CONFIGURATION_ISSUES'
}

// Property Error Interface
export interface PropertyError {
  /** Error code */
  code: PropertyErrorCode;
  
  /** Error message */
  message: string;
  
  /** Error details */
  details?: any;
  
  /** Timestamp */
  timestamp: string;
  
  /** Retry information */
  retryable: boolean;
  
  /** Suggested action */
  suggestedAction?: string;
}

export enum PropertyErrorCode {
  DISCOVERY_FAILED = 'DISCOVERY_FAILED',
  FETCH_FAILED = 'FETCH_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CACHE_ERROR = 'CACHE_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Property Management Context
export interface PropertyManagementContext {
  /** Current property selection state */
  state: PropertySelectionState;
  
  /** Property discovery configuration */
  config: PropertyDiscoveryConfig;
  
  /** Property cache */
  cache: PropertyCache;
  
  /** Property management actions */
  actions: PropertyManagementActions;
}

// Property Management Actions
export interface PropertyManagementActions {
  /** Select a property */
  selectProperty: (property: GA4Property) => Promise<void>;
  
  /** Refresh available properties */
  refreshProperties: () => Promise<void>;
  
  /** Filter properties */
  filterProperties: (filter: PropertyFilter) => void;
  
  /** Sort properties */
  sortProperties: (sort: PropertySort) => void;
  
  /** Search properties */
  searchProperties: (query: string) => void;
  
  /** Clear property selection */
  clearSelection: () => void;
  
  /** Validate property */
  validateProperty: (property: GA4Property) => Promise<PropertyValidationResult>;
  
  /** Get cached property */
  getCachedProperty: (propertyId: string) => CachedProperty | null;
  
  /** Clear cache */
  clearCache: () => void;
}

// Default configurations
export const DEFAULT_PROPERTY_DISCOVERY_CONFIG: PropertyDiscoveryConfig = {
  autoDiscovery: true,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  cacheTtl: 30 * 60 * 1000, // 30 minutes
  includeInactive: false,
  minAccessLevel: PropertyAccessLevel.READ_ONLY,
  retryConfig: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }
};

export const DEFAULT_PROPERTY_CACHE_CONFIG: PropertyCacheConfig = {
  maxSize: 100,
  ttl: 30 * 60 * 1000, // 30 minutes
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  enableLruEviction: true,
  enablePersistence: true,
  storageKey: 'ga4-properties-cache'
};

export const DEFAULT_PROPERTY_FILTER: PropertyFilter = {
  propertyTypes: undefined,
  accessLevels: undefined,
  statuses: [PropertyStatus.ACTIVE],
  searchQuery: undefined,
  hasDataOnly: false,
  recentlyActiveOnly: false
};

export const DEFAULT_PROPERTY_SORT: PropertySort = {
  field: PropertySortField.NAME,
  direction: 'asc'
};