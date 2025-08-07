/**
 * Feature Flag Manager
 * 
 * Manages feature flags for metric card migration with real-time updates from Supabase.
 * Supports gradual rollout, A/B testing, and fallback mechanisms.
 */

import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface FeatureFlag {
  id: string;
  flag_name: string;
  is_enabled: boolean;
  target_audience: {
    percentage: number;
    user_ids: string[];
    roles: string[];
  };
  metadata: Record<string, any>;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagManagerConfig {
  enableRealtime?: boolean;
  cacheTtl?: number; // Cache TTL in milliseconds
  fallbackValues?: Record<string, boolean>;
}

/**
 * Feature Flag Manager class
 */
export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private channel: RealtimeChannel | null = null;
  private lastFetch: number = 0;
  private config: FeatureFlagManagerConfig;
  private listeners: Map<string, ((enabled: boolean) => void)[]> = new Map();

  constructor(config: FeatureFlagManagerConfig = {}) {
    this.config = {
      enableRealtime: true,
      cacheTtl: 30000, // 30 seconds
      fallbackValues: {
        metric_cards_migration_enabled: false,
        metric_cards_fallback_enabled: true,
        metric_cards_monitoring_enabled: true,
      },
      ...config
    };

    this.initializeRealtime();
  }

  /**
   * Initialize real-time subscription to feature flags
   */
  private initializeRealtime(): void {
    if (!this.config.enableRealtime) return;

    this.channel = supabase
      .channel('feature-flags-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags'
        },
        (payload) => {
          this.handleRealtimeUpdate(payload);
        }
      )
      .subscribe();
  }

  /**
   * Handle real-time updates from Supabase
   */
  private handleRealtimeUpdate(payload: any): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (newRecord) {
          this.flags.set(newRecord.flag_name, newRecord);
          this.notifyListeners(newRecord.flag_name, newRecord.is_enabled);
        }
        break;
      case 'DELETE':
        if (oldRecord) {
          this.flags.delete(oldRecord.flag_name);
          this.notifyListeners(oldRecord.flag_name, false);
        }
        break;
    }
  }

  /**
   * Notify listeners of flag changes
   */
  private notifyListeners(flagName: string, enabled: boolean): void {
    const flagListeners = this.listeners.get(flagName);
    if (flagListeners) {
      flagListeners.forEach(listener => listener(enabled));
    }
  }

  /**
   * Fetch all feature flags from Supabase
   */
  async fetchFlags(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('flag_name');

      if (error) {
        console.error('Failed to fetch feature flags:', error);
        return;
      }

      if (data) {
        this.flags.clear();
        data.forEach(flag => {
          this.flags.set(flag.flag_name, flag);
        });
        this.lastFetch = Date.now();
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  async isEnabled(flagName: string, userId?: string, userRole?: string): Promise<boolean> {
    // Check cache validity
    if (Date.now() - this.lastFetch > this.config.cacheTtl!) {
      await this.fetchFlags();
    }

    const flag = this.flags.get(flagName);
    
    if (!flag) {
      // Return fallback value if available
      return this.config.fallbackValues?.[flagName] ?? false;
    }

    if (!flag.is_enabled) {
      return false;
    }

    // Check target audience
    const audience = flag.target_audience;
    
    // Check user ID targeting
    if (userId && audience.user_ids.includes(userId)) {
      return true;
    }

    // Check role targeting
    if (userRole && audience.roles.includes(userRole)) {
      return true;
    }

    // Check percentage rollout
    if (audience.percentage > 0) {
      const hash = userId ? this.hashUserId(userId, flagName) : Math.random() * 100;
      return hash < audience.percentage;
    }

    // If no specific targeting, return the flag's enabled state
    return flag.is_enabled;
  }

  /**
   * Get flag metadata
   */
  getFlagMetadata(flagName: string): Record<string, any> | null {
    const flag = this.flags.get(flagName);
    return flag?.metadata || null;
  }

  /**
   * Subscribe to flag changes
   */
  subscribe(flagName: string, callback: (enabled: boolean) => void): () => void {
    if (!this.listeners.has(flagName)) {
      this.listeners.set(flagName, []);
    }
    this.listeners.get(flagName)!.push(callback);

    // Return unsubscribe function
    return () => {
      const flagListeners = this.listeners.get(flagName);
      if (flagListeners) {
        const index = flagListeners.indexOf(callback);
        if (index > -1) {
          flagListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Check multiple flags at once
   */
  async checkFlags(flagNames: string[], userId?: string, userRole?: string): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      flagNames.map(async (flagName) => {
        results[flagName] = await this.isEnabled(flagName, userId, userRole);
      })
    );

    return results;
  }

  /**
   * Hash user ID for consistent percentage rollout
   */
  private hashUserId(userId: string, flagName: string): number {
    const str = `${userId}-${flagName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Get all flags (for debugging)
   */
  getAllFlags(): Map<string, FeatureFlag> {
    return new Map(this.flags);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.flags.clear();
    this.listeners.clear();
  }
}

// Singleton instance
export const featureFlagManager = new FeatureFlagManager();