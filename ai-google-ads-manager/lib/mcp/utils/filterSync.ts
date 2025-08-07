/**
 * Filter Synchronization Utilities
 * 
 * Provides centralized filter management with validation, synchronization,
 * dependency tracking, and integration with multi-property support system.
 */

import { DashboardFilters } from '@/contexts/DashboardContext';

export interface FilterDependency {
  source: string;
  target: string;
  relationship: 'requires' | 'excludes' | 'implies';
  priority: number;
}

export interface FilterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: FilterConflict[];
  adjustedFilters?: DashboardFilters;
}

export interface FilterConflict {
  filter1: string;
  filter2: string;
  reason: string;
  resolution: 'remove' | 'priority' | 'merge';
}

export interface FilterSyncConfig {
  enableValidation: boolean;
  enablePersistence: boolean;
  enableCrossBrowserSync: boolean;
  enablePropertySpecificFilters: boolean;
  enableDependencyTracking: boolean;
  autoResolveConflicts: boolean;
}

export interface FilterEventData {
  oldFilters: DashboardFilters;
  newFilters: DashboardFilters;
  source: 'user' | 'system' | 'property-change' | 'sync' | 'dependency';
  propertyId?: string;
  timestamp: Date;
  triggeredBy?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<DashboardFilters>;
  tags: string[];
}

/**
 * Filter Synchronization Manager
 */
export class FilterSyncManager {
  private config: FilterSyncConfig;
  private dependencies: FilterDependency[] = [];
  private presets: FilterPreset[] = [];
  private eventListeners: Map<string, ((data: FilterEventData) => void)[]> = new Map();
  private persistenceKey = 'dashboard-filters';
  private propertyFilterKey = 'property-filters';

  constructor(config: Partial<FilterSyncConfig> = {}) {
    this.config = {
      enableValidation: true,
      enablePersistence: true,
      enableCrossBrowserSync: true,
      enablePropertySpecificFilters: true,
      enableDependencyTracking: true,
      autoResolveConflicts: true,
      ...config
    };

    this.initializeDefaultDependencies();
    this.initializeDefaultPresets();
    this.initializeCrossBrowserSync();
  }

  /**
   * Validate filters against dependencies and business rules
   */
  validateFilters(filters: DashboardFilters): FilterValidationResult {
    const result: FilterValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      conflicts: []
    };

    // Validate traffic sources
    if (filters.trafficSources && filters.trafficSources.length > 0) {
      const invalidSources = filters.trafficSources.filter(source => 
        !this.isValidTrafficSource(source)
      );
      
      if (invalidSources.length > 0) {
        result.errors.push(`Invalid traffic sources: ${invalidSources.join(', ')}`);
        result.isValid = false;
      }

      if (filters.trafficSources.length > 10) {
        result.warnings.push('Too many traffic sources selected, may impact performance');
      }
    }

    // Validate device categories
    if (filters.deviceCategories && filters.deviceCategories.length > 0) {
      const validCategories = ['desktop', 'mobile', 'tablet'];
      const invalidCategories = filters.deviceCategories.filter(category => 
        !validCategories.includes(category)
      );
      
      if (invalidCategories.length > 0) {
        result.errors.push(`Invalid device categories: ${invalidCategories.join(', ')}`);
        result.isValid = false;
      }
    }

    // Check filter dependencies
    if (this.config.enableDependencyTracking) {
      const dependencyConflicts = this.checkFilterDependencies(filters);
      result.conflicts.push(...dependencyConflicts);
      
      if (dependencyConflicts.length > 0 && !this.config.autoResolveConflicts) {
        result.isValid = false;
        result.errors.push('Filter dependency conflicts detected');
      }
    }

    // Auto-resolve conflicts if enabled
    if (this.config.autoResolveConflicts && result.conflicts.length > 0) {
      result.adjustedFilters = this.resolveFilterConflicts(filters, result.conflicts);
      result.warnings.push('Some filter conflicts were automatically resolved');
    }

    // Check for potentially expensive filter combinations
    if (this.isExpensiveFilterCombination(filters)) {
      result.warnings.push('This filter combination may result in slower loading times');
    }

    return result;
  }

  /**
   * Normalize filters (standardize format, apply corrections)
   */
  normalizeFilters(filters: DashboardFilters): DashboardFilters {
    const validation = this.validateFilters(filters);
    
    if (validation.adjustedFilters && this.config.autoResolveConflicts) {
      return validation.adjustedFilters;
    }
    
    return {
      ...filters,
      trafficSources: [...new Set(filters.trafficSources || [])], // Remove duplicates
      deviceCategories: [...new Set(filters.deviceCategories || [])], // Remove duplicates
      customFilters: filters.customFilters || {}
    };
  }

  /**
   * Apply filter dependencies and implications
   */
  applyFilterDependencies(filters: DashboardFilters): DashboardFilters {
    if (!this.config.enableDependencyTracking) return filters;

    let resultFilters = { ...filters };

    // Apply dependency implications
    for (const dependency of this.dependencies) {
      if (this.hasFilterValue(resultFilters, dependency.source)) {
        switch (dependency.relationship) {
          case 'implies':
            resultFilters = this.addFilterValue(resultFilters, dependency.target);
            break;
          case 'excludes':
            resultFilters = this.removeFilterValue(resultFilters, dependency.target);
            break;
        }
      }
    }

    return resultFilters;
  }

  /**
   * Get filter presets
   */
  getFilterPresets(): FilterPreset[] {
    return [...this.presets];
  }

  /**
   * Apply a filter preset
   */
  applyFilterPreset(presetId: string, baseFilters: DashboardFilters): DashboardFilters {
    const preset = this.presets.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Filter preset '${presetId}' not found`);
    }

    return {
      ...baseFilters,
      ...preset.filters
    };
  }

  /**
   * Persist filters to storage
   */
  persistFilters(filters: DashboardFilters, propertyId?: string): void {
    if (!this.config.enablePersistence) return;

    try {
      if (propertyId && this.config.enablePropertySpecificFilters) {
        // Store property-specific filters
        const propertyFilters = this.getPropertyFilters();
        propertyFilters[propertyId] = filters;
        localStorage.setItem(this.propertyFilterKey, JSON.stringify(propertyFilters));
      } else {
        // Store global filters
        localStorage.setItem(this.persistenceKey, JSON.stringify(filters));
      }

      // Trigger cross-browser sync
      if (this.config.enableCrossBrowserSync) {
        this.broadcastFilterChange(filters, 'system', propertyId);
      }
    } catch (error) {
      console.warn('Failed to persist filters:', error);
    }
  }

  /**
   * Restore filters from storage
   */
  restoreFilters(propertyId?: string): DashboardFilters | null {
    if (!this.config.enablePersistence) return null;

    try {
      if (propertyId && this.config.enablePropertySpecificFilters) {
        // Try property-specific filters first
        const propertyFilters = this.getPropertyFilters();
        if (propertyFilters[propertyId]) {
          return propertyFilters[propertyId];
        }
      }

      // Fall back to global filters
      const stored = localStorage.getItem(this.persistenceKey);
      if (stored) {
        const filters = JSON.parse(stored) as DashboardFilters;
        const validation = this.validateFilters(filters);
        
        if (validation.isValid) {
          return filters;
        } else if (validation.adjustedFilters) {
          return validation.adjustedFilters;
        }
      }
    } catch (error) {
      console.warn('Failed to restore filters:', error);
    }

    return null;
  }

  /**
   * Add filter dependency
   */
  addFilterDependency(dependency: FilterDependency): void {
    // Remove existing dependency with same source/target
    this.dependencies = this.dependencies.filter(d => 
      !(d.source === dependency.source && d.target === dependency.target)
    );
    
    this.dependencies.push(dependency);
    this.dependencies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove filter dependency
   */
  removeFilterDependency(source: string, target: string): void {
    this.dependencies = this.dependencies.filter(d => 
      !(d.source === source && d.target === target)
    );
  }

  /**
   * Add event listener for filter changes
   */
  addEventListener(event: 'change' | 'sync' | 'error', callback: (data: FilterEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: 'change' | 'sync' | 'error', callback: (data: FilterEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): FilterSyncConfig {
    return { ...this.config };
  }

  /**
   * Get filter statistics
   */
  getFilterStats(filters: DashboardFilters): Record<string, any> {
    return {
      totalTrafficSources: filters.trafficSources?.length || 0,
      totalDeviceCategories: filters.deviceCategories?.length || 0,
      totalCustomFilters: Object.keys(filters.customFilters || {}).length,
      highlightGoogleAds: filters.highlightGoogleAds,
      hasActiveFilters: this.hasActiveFilters(filters),
      complexity: this.calculateFilterComplexity(filters)
    };
  }

  // Private helper methods

  private isValidTrafficSource(source: string): boolean {
    const validSources = [
      'organic', 'paid', 'direct', 'referral', 'social', 'email', 
      'google', 'facebook', 'twitter', 'linkedin', 'youtube'
    ];
    return validSources.includes(source.toLowerCase());
  }

  private checkFilterDependencies(filters: DashboardFilters): FilterConflict[] {
    const conflicts: FilterConflict[] = [];

    for (const dependency of this.dependencies) {
      const hasSource = this.hasFilterValue(filters, dependency.source);
      const hasTarget = this.hasFilterValue(filters, dependency.target);

      if (hasSource && hasTarget && dependency.relationship === 'excludes') {
        conflicts.push({
          filter1: dependency.source,
          filter2: dependency.target,
          reason: `${dependency.source} excludes ${dependency.target}`,
          resolution: 'remove'
        });
      }

      if (hasSource && !hasTarget && dependency.relationship === 'requires') {
        conflicts.push({
          filter1: dependency.source,
          filter2: dependency.target,
          reason: `${dependency.source} requires ${dependency.target}`,
          resolution: 'merge'
        });
      }
    }

    return conflicts;
  }

  private resolveFilterConflicts(filters: DashboardFilters, conflicts: FilterConflict[]): DashboardFilters {
    let resultFilters = { ...filters };

    for (const conflict of conflicts) {
      switch (conflict.resolution) {
        case 'remove':
          resultFilters = this.removeFilterValue(resultFilters, conflict.filter2);
          break;
        case 'merge':
          resultFilters = this.addFilterValue(resultFilters, conflict.filter2);
          break;
      }
    }

    return resultFilters;
  }

  private hasFilterValue(filters: DashboardFilters, filterPath: string): boolean {
    const [category, value] = filterPath.split('.');
    
    switch (category) {
      case 'trafficSources':
        return filters.trafficSources?.includes(value) || false;
      case 'deviceCategories':
        return filters.deviceCategories?.includes(value) || false;
      case 'highlightGoogleAds':
        return filters.highlightGoogleAds;
      case 'customFilters':
        return !!filters.customFilters?.[value];
      default:
        return false;
    }
  }

  private addFilterValue(filters: DashboardFilters, filterPath: string): DashboardFilters {
    const [category, value] = filterPath.split('.');
    const result = { ...filters };

    switch (category) {
      case 'trafficSources':
        result.trafficSources = [...(result.trafficSources || []), value];
        break;
      case 'deviceCategories':
        result.deviceCategories = [...(result.deviceCategories || []), value];
        break;
      case 'highlightGoogleAds':
        result.highlightGoogleAds = true;
        break;
      case 'customFilters':
        result.customFilters = { ...(result.customFilters || {}), [value]: true };
        break;
    }

    return result;
  }

  private removeFilterValue(filters: DashboardFilters, filterPath: string): DashboardFilters {
    const [category, value] = filterPath.split('.');
    const result = { ...filters };

    switch (category) {
      case 'trafficSources':
        result.trafficSources = (result.trafficSources || []).filter(s => s !== value);
        break;
      case 'deviceCategories':
        result.deviceCategories = (result.deviceCategories || []).filter(d => d !== value);
        break;
      case 'highlightGoogleAds':
        result.highlightGoogleAds = false;
        break;
      case 'customFilters':
        const { [value]: _, ...rest } = result.customFilters || {};
        result.customFilters = rest;
        break;
    }

    return result;
  }

  private isExpensiveFilterCombination(filters: DashboardFilters): boolean {
    const trafficSourceCount = filters.trafficSources?.length || 0;
    const deviceCategoryCount = filters.deviceCategories?.length || 0;
    const customFilterCount = Object.keys(filters.customFilters || {}).length;

    return trafficSourceCount > 5 || deviceCategoryCount > 2 || customFilterCount > 3;
  }

  private hasActiveFilters(filters: DashboardFilters): boolean {
    return !!(
      (filters.trafficSources && filters.trafficSources.length > 0) ||
      (filters.deviceCategories && filters.deviceCategories.length > 0) ||
      (filters.customFilters && Object.keys(filters.customFilters).length > 0) ||
      filters.highlightGoogleAds
    );
  }

  private calculateFilterComplexity(filters: DashboardFilters): number {
    let complexity = 0;
    
    complexity += (filters.trafficSources?.length || 0) * 2;
    complexity += (filters.deviceCategories?.length || 0) * 1;
    complexity += Object.keys(filters.customFilters || {}).length * 3;
    complexity += filters.highlightGoogleAds ? 1 : 0;

    return Math.min(complexity, 100); // Cap at 100
  }

  private initializeDefaultDependencies(): void {
    // Example dependencies - customize based on business rules
    this.addFilterDependency({
      source: 'trafficSources.google',
      target: 'highlightGoogleAds',
      relationship: 'implies',
      priority: 1
    });
  }

  private initializeDefaultPresets(): void {
    this.presets = [
      {
        id: 'google-focus',
        name: 'Google Focus',
        description: 'Focus on Google traffic sources',
        filters: {
          highlightGoogleAds: true,
          trafficSources: ['google']
        },
        tags: ['google', 'ads']
      },
      {
        id: 'mobile-only',
        name: 'Mobile Only',
        description: 'Show only mobile traffic',
        filters: {
          deviceCategories: ['mobile']
        },
        tags: ['mobile', 'device']
      },
      {
        id: 'organic-traffic',
        name: 'Organic Traffic',
        description: 'Focus on organic traffic sources',
        filters: {
          trafficSources: ['organic'],
          highlightGoogleAds: false
        },
        tags: ['organic', 'seo']
      }
    ];
  }

  private initializeCrossBrowserSync(): void {
    if (!this.config.enableCrossBrowserSync || typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (event.key === this.persistenceKey || event.key === this.propertyFilterKey) {
        try {
          const newValue = event.newValue ? JSON.parse(event.newValue) : null;
          this.emitEvent('sync', {
            key: event.key,
            oldValue: event.oldValue ? JSON.parse(event.oldValue) : null,
            newValue,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Error processing filter sync event:', error);
        }
      }
    });
  }

  private broadcastFilterChange(filters: DashboardFilters, source: string, propertyId?: string): void {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('filterChange', {
      detail: {
        filters,
        source,
        propertyId,
        timestamp: new Date()
      }
    });

    window.dispatchEvent(event);
  }

  private getPropertyFilters(): Record<string, DashboardFilters> {
    try {
      const stored = localStorage.getItem(this.propertyFilterKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to get property filters:', error);
      return {};
    }
  }

  private emitEvent(event: 'change' | 'sync' | 'error', data: FilterEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in filter event listener:', error);
        }
      });
    }
  }
}

// Singleton instance for global use
export const filterSyncManager = new FilterSyncManager();

// React hook for easy component integration
export function useFilterSync() {
  return filterSyncManager;
}

export default filterSyncManager;