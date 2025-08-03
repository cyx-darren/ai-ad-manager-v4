/**
 * Adapter Factory Implementation
 * 
 * This file implements the factory pattern for creating adapter instances.
 * It provides a centralized way to register and create adapters with proper error handling.
 */

import { 
  AdapterFactory as IAdapterFactory,
  AdapterType, 
  AdapterConfig, 
  BaseAdapter as IBaseAdapter,
  AdapterRegistration,
  AdapterRegistry as IAdapterRegistry,
  AdapterError,
  AdapterMetadata
} from './types';
import { BaseAdapter } from './BaseAdapter';

/**
 * Registry for storing adapter registrations
 */
class AdapterRegistry implements IAdapterRegistry {
  private adapters = new Map<AdapterType, AdapterRegistration>();

  /**
   * Register a new adapter type
   */
  register<TInput, TOutput>(registration: AdapterRegistration<TInput, TOutput>): void {
    if (this.adapters.has(registration.type)) {
      console.warn(`Adapter type '${registration.type}' is already registered. Overwriting.`);
    }
    
    this.adapters.set(registration.type, registration);
  }

  /**
   * Get adapter registration by type
   */
  get<TInput, TOutput>(type: AdapterType): AdapterRegistration<TInput, TOutput> | undefined {
    return this.adapters.get(type) as AdapterRegistration<TInput, TOutput> | undefined;
  }

  /**
   * Get all adapter registrations
   */
  getAll(): AdapterRegistration[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Check if adapter type is registered
   */
  has(type: AdapterType): boolean {
    return this.adapters.has(type);
  }

  /**
   * Get available adapter types
   */
  getTypes(): AdapterType[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Main adapter factory implementation
 */
export class AdapterFactory implements IAdapterFactory {
  private registry: AdapterRegistry;
  private instances = new Map<string, IBaseAdapter<any, any>>();

  constructor() {
    this.registry = new AdapterRegistry();
  }

  /**
   * Create an adapter instance
   */
  createAdapter<TInput, TOutput>(
    type: AdapterType,
    config?: AdapterConfig
  ): IBaseAdapter<TInput, TOutput> {
    const registration = this.registry.get<TInput, TOutput>(type);
    
    if (!registration) {
      throw new AdapterError(
        `Adapter type '${type}' is not registered`,
        'AdapterFactory'
      );
    }

    try {
      const adapter = new registration.adapterClass(config);
      
      // Validate that the adapter implements required interface
      this.validateAdapterInstance(adapter, type);
      
      return adapter;
    } catch (error) {
      throw new AdapterError(
        `Failed to create adapter of type '${type}': ${error.message}`,
        'AdapterFactory',
        { type, config },
        error as Error
      );
    }
  }

  /**
   * Create and cache a singleton adapter instance
   */
  getSingletonAdapter<TInput, TOutput>(
    type: AdapterType,
    config?: AdapterConfig
  ): IBaseAdapter<TInput, TOutput> {
    const key = `${type}-${JSON.stringify(config || {})}`;
    
    if (!this.instances.has(key)) {
      const adapter = this.createAdapter<TInput, TOutput>(type, config);
      this.instances.set(key, adapter);
    }
    
    return this.instances.get(key) as IBaseAdapter<TInput, TOutput>;
  }

  /**
   * Register a new adapter type
   */
  registerAdapter<TInput, TOutput>(
    type: AdapterType,
    adapterClass: new (config?: AdapterConfig) => IBaseAdapter<TInput, TOutput>,
    metadata?: Partial<AdapterMetadata>
  ): void {
    // Create a temporary instance to get metadata
    let adapterMetadata: AdapterMetadata;
    
    try {
      const tempInstance = new adapterClass();
      adapterMetadata = tempInstance.getMetadata();
      
      // Override with provided metadata
      if (metadata) {
        adapterMetadata = { ...adapterMetadata, ...metadata };
      }
    } catch (error) {
      // Fallback metadata if instantiation fails
      adapterMetadata = {
        name: type,
        version: '1.0.0',
        inputType: 'any',
        outputType: 'any',
        description: `Adapter for ${type}`,
        ...metadata
      };
    }

    const registration: AdapterRegistration<TInput, TOutput> = {
      type,
      adapterClass,
      metadata: adapterMetadata
    };

    this.registry.register(registration);
  }

  /**
   * Get list of available adapter types
   */
  getAvailableTypes(): AdapterType[] {
    return this.registry.getTypes();
  }

  /**
   * Get adapter metadata
   */
  getAdapterMetadata(type: AdapterType): AdapterMetadata | undefined {
    const registration = this.registry.get(type);
    return registration?.metadata;
  }

  /**
   * Check if adapter type is available
   */
  hasAdapter(type: AdapterType): boolean {
    return this.registry.has(type);
  }

  /**
   * Clear all cached singleton instances
   */
  clearCache(): void {
    this.instances.clear();
  }

  /**
   * Clear specific cached instance
   */
  clearCacheFor(type: AdapterType, config?: AdapterConfig): void {
    const key = `${type}-${JSON.stringify(config || {})}`;
    this.instances.delete(key);
  }

  /**
   * Get all adapter registrations
   */
  getAllRegistrations(): AdapterRegistration[] {
    return this.registry.getAll();
  }

  /**
   * Unregister an adapter type
   */
  unregisterAdapter(type: AdapterType): boolean {
    const registration = this.registry.get(type);
    if (registration) {
      // Clear any cached instances for this type
      const keysToDelete: string[] = [];
      for (const key of this.instances.keys()) {
        if (key.startsWith(`${type}-`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.instances.delete(key));
      
      // Remove from registry
      this.registry.clear();
      this.registry.getAll()
        .filter(reg => reg.type !== type)
        .forEach(reg => this.registry.register(reg));
      
      return true;
    }
    return false;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate that an adapter instance implements the required interface
   */
  private validateAdapterInstance(adapter: any, type: AdapterType): void {
    const requiredMethods = ['transform', 'validate', 'getDefaultOutput', 'handleError', 'getMetadata'];
    
    for (const method of requiredMethods) {
      if (typeof adapter[method] !== 'function') {
        throw new AdapterError(
          `Adapter '${type}' does not implement required method: ${method}`,
          'AdapterFactory'
        );
      }
    }

    // Validate metadata
    try {
      const metadata = adapter.getMetadata();
      if (!metadata || typeof metadata !== 'object') {
        throw new Error('getMetadata() must return an object');
      }
      
      const requiredMetadataFields = ['name', 'version', 'inputType', 'outputType'];
      for (const field of requiredMetadataFields) {
        if (!metadata[field]) {
          throw new Error(`Metadata missing required field: ${field}`);
        }
      }
    } catch (error) {
      throw new AdapterError(
        `Adapter '${type}' metadata validation failed: ${error.message}`,
        'AdapterFactory',
        undefined,
        error as Error
      );
    }
  }
}

/**
 * Default singleton factory instance
 */
export const defaultAdapterFactory = new AdapterFactory();

/**
 * Convenience function to register an adapter with the default factory
 */
export function registerAdapter<TInput, TOutput>(
  type: AdapterType,
  adapterClass: new (config?: AdapterConfig) => IBaseAdapter<TInput, TOutput>,
  metadata?: Partial<AdapterMetadata>
): void {
  defaultAdapterFactory.registerAdapter(type, adapterClass, metadata);
}

/**
 * Convenience function to create an adapter with the default factory
 */
export function createAdapter<TInput, TOutput>(
  type: AdapterType,
  config?: AdapterConfig
): IBaseAdapter<TInput, TOutput> {
  return defaultAdapterFactory.createAdapter<TInput, TOutput>(type, config);
}

/**
 * Convenience function to get a singleton adapter with the default factory
 */
export function getAdapter<TInput, TOutput>(
  type: AdapterType,
  config?: AdapterConfig
): IBaseAdapter<TInput, TOutput> {
  return defaultAdapterFactory.getSingletonAdapter<TInput, TOutput>(type, config);
}

/**
 * Get available adapter types from the default factory
 */
export function getAvailableAdapterTypes(): AdapterType[] {
  return defaultAdapterFactory.getAvailableTypes();
}

/**
 * Check if an adapter type is available in the default factory
 */
export function isAdapterAvailable(type: AdapterType): boolean {
  return defaultAdapterFactory.hasAdapter(type);
}

/**
 * Batch register multiple adapters
 */
export function registerAdapters(
  adapters: Array<{
    type: AdapterType;
    adapterClass: new (config?: AdapterConfig) => IBaseAdapter<any, any>;
    metadata?: Partial<AdapterMetadata>;
  }>
): void {
  for (const adapter of adapters) {
    registerAdapter(adapter.type, adapter.adapterClass, adapter.metadata);
  }
}

/**
 * Create multiple adapters at once
 */
export function createAdapters(
  requests: Array<{
    type: AdapterType;
    config?: AdapterConfig;
  }>
): IBaseAdapter<any, any>[] {
  return requests.map(request => 
    createAdapter(request.type, request.config)
  );
}