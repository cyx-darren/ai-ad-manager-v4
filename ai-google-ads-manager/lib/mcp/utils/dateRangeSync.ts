/**
 * Date Range Synchronization Utilities
 * 
 * Provides centralized date range management with validation, synchronization,
 * and integration with multi-property support system.
 */

import { DateRange } from '@/contexts/DashboardContext';

export interface DateRangeLimits {
  minDate: Date;
  maxDate: Date;
  maxRangeDays: number;
  minRangeDays: number;
}

export interface DateRangeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  adjustedRange?: DateRange;
}

export interface DateRangeSyncConfig {
  enableValidation: boolean;
  enablePersistence: boolean;
  enableCrossBrowserSync: boolean;
  enablePropertySpecificRanges: boolean;
  autoCorrectInvalidRanges: boolean;
}

export interface DateRangeEventData {
  oldRange: DateRange;
  newRange: DateRange;
  source: 'user' | 'system' | 'property-change' | 'sync';
  propertyId?: string;
  timestamp: Date;
}

/**
 * Date Range Synchronization Manager
 */
export class DateRangeSyncManager {
  private config: DateRangeSyncConfig;
  private limits: DateRangeLimits;
  private eventListeners: Map<string, ((data: DateRangeEventData) => void)[]> = new Map();
  private persistenceKey = 'dashboard-date-range';
  private propertyRangeKey = 'property-date-ranges';

  constructor(
    config: Partial<DateRangeSyncConfig> = {},
    limits: Partial<DateRangeLimits> = {}
  ) {
    this.config = {
      enableValidation: true,
      enablePersistence: true,
      enableCrossBrowserSync: true,
      enablePropertySpecificRanges: true,
      autoCorrectInvalidRanges: true,
      ...config
    };

    // Default limits for GA4 API
    const now = new Date();
    const fourYearsAgo = new Date(now.getFullYear() - 4, now.getMonth(), now.getDate());
    
    this.limits = {
      minDate: fourYearsAgo,
      maxDate: now,
      maxRangeDays: 365, // Max 1 year range
      minRangeDays: 1,   // Min 1 day range
      ...limits
    };

    this.initializeCrossBrowserSync();
  }

  /**
   * Validate a date range against API limits and business rules
   */
  validateDateRange(dateRange: DateRange): DateRangeValidationResult {
    const result: DateRangeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!dateRange.startDate || !dateRange.endDate) {
      result.isValid = false;
      result.errors.push('Start date and end date are required');
      return result;
    }

    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Check date validity
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      result.isValid = false;
      result.errors.push('Invalid date format');
      return result;
    }

    // Check date order
    if (startDate > endDate) {
      result.isValid = false;
      result.errors.push('Start date must be before end date');
      
      if (this.config.autoCorrectInvalidRanges) {
        result.adjustedRange = {
          ...dateRange,
          startDate: dateRange.endDate,
          endDate: dateRange.startDate
        };
        result.warnings.push('Dates were automatically swapped');
      }
    }

    // Check against limits
    if (startDate < this.limits.minDate) {
      result.isValid = false;
      result.errors.push(`Start date cannot be before ${this.formatDate(this.limits.minDate)}`);
      
      if (this.config.autoCorrectInvalidRanges) {
        result.adjustedRange = {
          ...dateRange,
          startDate: this.formatDate(this.limits.minDate)
        };
        result.warnings.push('Start date was adjusted to minimum allowed date');
      }
    }

    if (endDate > this.limits.maxDate) {
      result.isValid = false;
      result.errors.push(`End date cannot be after ${this.formatDate(this.limits.maxDate)}`);
      
      if (this.config.autoCorrectInvalidRanges) {
        result.adjustedRange = {
          ...dateRange,
          endDate: this.formatDate(this.limits.maxDate)
        };
        result.warnings.push('End date was adjusted to maximum allowed date');
      }
    }

    // Check range duration
    const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (rangeDays > this.limits.maxRangeDays) {
      result.isValid = false;
      result.errors.push(`Date range cannot exceed ${this.limits.maxRangeDays} days`);
      
      if (this.config.autoCorrectInvalidRanges) {
        const maxEndDate = new Date(startDate);
        maxEndDate.setDate(startDate.getDate() + this.limits.maxRangeDays);
        
        result.adjustedRange = {
          ...dateRange,
          endDate: this.formatDate(maxEndDate)
        };
        result.warnings.push(`Range was truncated to maximum ${this.limits.maxRangeDays} days`);
      }
    }

    if (rangeDays < this.limits.minRangeDays) {
      result.isValid = false;
      result.errors.push(`Date range must be at least ${this.limits.minRangeDays} day(s)`);
      
      if (this.config.autoCorrectInvalidRanges) {
        const minEndDate = new Date(startDate);
        minEndDate.setDate(startDate.getDate() + this.limits.minRangeDays);
        
        result.adjustedRange = {
          ...dateRange,
          endDate: this.formatDate(minEndDate)
        };
        result.warnings.push(`Range was extended to minimum ${this.limits.minRangeDays} day(s)`);
      }
    }

    // Performance warnings
    if (rangeDays > 90) {
      result.warnings.push('Large date ranges may result in slower loading times');
    }

    return result;
  }

  /**
   * Normalize a date range (standardize format, apply corrections)
   */
  normalizeDateRange(dateRange: DateRange): DateRange {
    const validation = this.validateDateRange(dateRange);
    
    if (validation.adjustedRange && this.config.autoCorrectInvalidRanges) {
      return validation.adjustedRange;
    }
    
    return {
      ...dateRange,
      startDate: this.formatDate(new Date(dateRange.startDate)),
      endDate: this.formatDate(new Date(dateRange.endDate))
    };
  }

  /**
   * Get standardized preset date ranges
   */
  getPresetDateRange(preset: 'last7days' | 'last30days' | 'last90days'): DateRange {
    const endDate = new Date();
    const startDate = new Date();

    switch (preset) {
      case 'last7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
    }

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      preset
    };
  }

  /**
   * Persist date range to storage
   */
  persistDateRange(dateRange: DateRange, propertyId?: string): void {
    if (!this.config.enablePersistence) return;

    try {
      if (propertyId && this.config.enablePropertySpecificRanges) {
        // Store property-specific range
        const propertyRanges = this.getPropertyRanges();
        propertyRanges[propertyId] = dateRange;
        localStorage.setItem(this.propertyRangeKey, JSON.stringify(propertyRanges));
      } else {
        // Store global range
        localStorage.setItem(this.persistenceKey, JSON.stringify(dateRange));
      }

      // Trigger cross-browser sync
      if (this.config.enableCrossBrowserSync) {
        this.broadcastDateRangeChange(dateRange, 'system', propertyId);
      }
    } catch (error) {
      console.warn('Failed to persist date range:', error);
    }
  }

  /**
   * Restore date range from storage
   */
  restoreDateRange(propertyId?: string): DateRange | null {
    if (!this.config.enablePersistence) return null;

    try {
      if (propertyId && this.config.enablePropertySpecificRanges) {
        // Try property-specific range first
        const propertyRanges = this.getPropertyRanges();
        if (propertyRanges[propertyId]) {
          return propertyRanges[propertyId];
        }
      }

      // Fall back to global range
      const stored = localStorage.getItem(this.persistenceKey);
      if (stored) {
        const dateRange = JSON.parse(stored) as DateRange;
        const validation = this.validateDateRange(dateRange);
        
        if (validation.isValid) {
          return dateRange;
        } else if (validation.adjustedRange) {
          return validation.adjustedRange;
        }
      }
    } catch (error) {
      console.warn('Failed to restore date range:', error);
    }

    return null;
  }

  /**
   * Add event listener for date range changes
   */
  addEventListener(event: 'change' | 'sync' | 'error', callback: (data: DateRangeEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: 'change' | 'sync' | 'error', callback: (data: DateRangeEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: 'change' | 'sync' | 'error', data: DateRangeEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in date range event listener:', error);
        }
      });
    }
  }

  /**
   * Initialize cross-browser synchronization
   */
  private initializeCrossBrowserSync(): void {
    if (!this.config.enableCrossBrowserSync || typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (event.key === this.persistenceKey || event.key === this.propertyRangeKey) {
        try {
          const newValue = event.newValue ? JSON.parse(event.newValue) : null;
          this.emitEvent('sync', {
            key: event.key,
            oldValue: event.oldValue ? JSON.parse(event.oldValue) : null,
            newValue,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Error processing storage sync event:', error);
        }
      }
    });
  }

  /**
   * Broadcast date range change to other tabs
   */
  private broadcastDateRangeChange(dateRange: DateRange, source: string, propertyId?: string): void {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('dateRangeChange', {
      detail: {
        dateRange,
        source,
        propertyId,
        timestamp: new Date()
      }
    });

    window.dispatchEvent(event);
  }

  /**
   * Get property-specific ranges from storage
   */
  private getPropertyRanges(): Record<string, DateRange> {
    try {
      const stored = localStorage.getItem(this.propertyRangeKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to get property ranges:', error);
      return {};
    }
  }

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get current configuration
   */
  getConfig(): DateRangeSyncConfig {
    return { ...this.config };
  }

  /**
   * Get current limits
   */
  getLimits(): DateRangeLimits {
    return { ...this.limits };
  }
}

// Singleton instance for global use
export const dateRangeSyncManager = new DateRangeSyncManager();

// React hook for easy component integration
export function useDateRangeSync() {
  return dateRangeSyncManager;
}

export default dateRangeSyncManager;