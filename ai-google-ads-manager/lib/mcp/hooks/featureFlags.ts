/**
 * Feature Flags Hook
 * 
 * React hook for accessing feature flags throughout the application.
 * Provides a simple interface for checking feature availability.
 */

import { useState, useEffect } from 'react';
import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';

export interface UseFeatureFlagOptions {
  defaultValue?: boolean;
  userId?: string;
  userRole?: string;
}

/**
 * Hook to check if a feature flag is enabled
 */
export function useFeatureFlag(
  flagName: string, 
  options: UseFeatureFlagOptions = {}
): boolean {
  const { defaultValue = false, userId, userRole } = options;
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValue);

  useEffect(() => {
    const checkFlag = async () => {
      try {
        const enabled = await featureFlagManager.isEnabled(flagName, {
          userId,
          userRole
        });
        setIsEnabled(enabled);
      } catch (error) {
        console.warn(`Failed to check feature flag "${flagName}":`, error);
        setIsEnabled(defaultValue);
      }
    };

    checkFlag();
  }, [flagName, userId, userRole, defaultValue]);

  return isEnabled;
}

/**
 * Hook to get multiple feature flags at once
 */
export function useFeatureFlags(
  flagNames: string[],
  options: UseFeatureFlagOptions = {}
): Record<string, boolean> {
  const { defaultValue = false, userId, userRole } = options;
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkFlags = async () => {
      const results: Record<string, boolean> = {};
      
      for (const flagName of flagNames) {
        try {
          const enabled = await featureFlagManager.isEnabled(flagName, {
            userId,
            userRole
          });
          results[flagName] = enabled;
        } catch (error) {
          console.warn(`Failed to check feature flag "${flagName}":`, error);
          results[flagName] = defaultValue;
        }
      }
      
      setFlags(results);
    };

    checkFlags();
  }, [flagNames, userId, userRole, defaultValue]);

  return flags;
}

/**
 * Hook for feature flags with loading state
 */
export function useFeatureFlagWithLoading(
  flagName: string,
  options: UseFeatureFlagOptions = {}
): { isEnabled: boolean; loading: boolean; error?: string } {
  const { defaultValue = false, userId, userRole } = options;
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const checkFlag = async () => {
      setLoading(true);
      setError(undefined);
      
      try {
        const enabled = await featureFlagManager.isEnabled(flagName, {
          userId,
          userRole
        });
        setIsEnabled(enabled);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`Failed to check feature flag "${flagName}":`, err);
        setError(errorMessage);
        setIsEnabled(defaultValue);
      } finally {
        setLoading(false);
      }
    };

    checkFlag();
  }, [flagName, userId, userRole, defaultValue]);

  return { isEnabled, loading, error };
}