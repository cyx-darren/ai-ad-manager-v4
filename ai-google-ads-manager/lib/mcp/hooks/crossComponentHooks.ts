/**
 * Cross-Component State Consistency Hooks
 * 
 * React hooks for managing cross-component state consistency,
 * event propagation, and validation across the MCP system.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  componentStateRegistry, 
  ComponentRegistration, 
  ComponentDependency,
  RegistryStats 
} from '../utils/componentRegistry';
import { 
  stateChangeEventManager, 
  StateChangeEvent, 
  EventSubscription,
  EventStats 
} from '../utils/stateEvents';
import { 
  componentStateValidator, 
  ValidationResult, 
  ValidationSchema,
  CrossComponentValidation 
} from '../utils/stateValidator';

export interface CrossComponentOptions {
  componentId: string;
  componentName: string;
  componentType: 'widget' | 'chart' | 'filter' | 'control' | 'layout' | 'data';
  enableValidation?: boolean;
  enableEvents?: boolean;
  enableDependencyTracking?: boolean;
  autoRepair?: boolean;
  validationSchema?: ValidationSchema;
}

export interface ComponentState {
  isRegistered: boolean;
  lastValidation?: ValidationResult;
  dependencies: string[];
  dependents: string[];
  health: {
    isHealthy: boolean;
    issues: string[];
    lastCheck: Date | null;
  };
  events: {
    subscriptions: string[];
    lastEvent: StateChangeEvent | null;
  };
}

export interface CrossComponentResult {
  componentState: ComponentState;
  register: () => void;
  unregister: () => void;
  updateState: (newState: any) => Promise<boolean>;
  validateState: (state?: any) => ValidationResult;
  publishEvent: (topic: string, data: any, type?: StateChangeEvent['type']) => string;
  subscribeToEvent: (topic: string, callback: (event: StateChangeEvent) => void) => string;
  unsubscribeFromEvent: (subscriptionId: string) => void;
  addDependency: (targetComponentId: string, type?: ComponentDependency['type']) => void;
  removeDependency: (targetComponentId: string) => void;
  getRegistryStats: () => RegistryStats;
  getEventStats: () => EventStats;
}

/**
 * Main hook for cross-component state consistency
 */
export function useCrossComponentState(
  options: CrossComponentOptions,
  initialState: any = {}
): CrossComponentResult {
  
  const {
    componentId,
    componentName,
    componentType,
    enableValidation = true,
    enableEvents = true,
    enableDependencyTracking = true,
    autoRepair = false,
    validationSchema
  } = options;

  const [componentState, setComponentState] = useState<ComponentState>({
    isRegistered: false,
    dependencies: [],
    dependents: [],
    health: {
      isHealthy: true,
      issues: [],
      lastCheck: null
    },
    events: {
      subscriptions: [],
      lastEvent: null
    }
  });

  const stateRef = useRef(initialState);
  const subscriptionsRef = useRef<string[]>([]);

  // Register component on mount
  const register = useCallback(() => {
    if (componentState.isRegistered) {
      return;
    }

    try {
      const registration: Omit<ComponentRegistration, 'metadata'> = {
        id: componentId,
        name: componentName,
        type: componentType,
        version: '1.0',
        state: stateRef.current,
        config: {
          autoSync: true,
          validateState: enableValidation,
          enableEvents,
          priority: 'normal'
        },
        hooks: {
          onStateChange: (newState, oldState) => {
            if (enableEvents) {
              stateChangeEventManager.publish(
                `component.${componentId}.state_changed`,
                { newState, oldState },
                componentId,
                'state_change'
              );
            }
          },
          onMount: (component) => {
            console.log(`🔧 Component mounted: ${component.name}`);
          },
          onUnmount: (component) => {
            console.log(`🔧 Component unmounted: ${component.name}`);
          },
          onError: (error, component) => {
            console.error(`Component error in ${component.name}:`, error);
            setComponentState(prev => ({
              ...prev,
              health: {
                isHealthy: false,
                issues: [...prev.health.issues, error.message],
                lastCheck: new Date()
              }
            }));
          }
        }
      };

      componentStateRegistry.register(registration);

      // Register validation schema if provided
      if (validationSchema) {
        componentStateValidator.registerSchema(componentType, validationSchema);
      }

      setComponentState(prev => ({
        ...prev,
        isRegistered: true
      }));

      console.log(`🔧 Component registered: ${componentName} (${componentId})`);

    } catch (error) {
      console.error('Failed to register component:', error);
    }
  }, [
    componentId, 
    componentName, 
    componentType, 
    enableValidation,
    enableEvents,
    validationSchema
  ]);

  // Unregister component
  const unregister = useCallback(() => {
    if (!componentState.isRegistered) {
      return;
    }

    // Unsubscribe from all events
    subscriptionsRef.current.forEach(subscriptionId => {
      stateChangeEventManager.unsubscribe(subscriptionId);
    });
    subscriptionsRef.current = [];

    // Unregister from registry
    componentStateRegistry.unregister(componentId);

    setComponentState(prev => ({
      ...prev,
      isRegistered: false,
      events: {
        subscriptions: [],
        lastEvent: null
      }
    }));

    console.log(`🔧 Component unregistered: ${componentName} (${componentId})`);
  }, [componentId, componentName]);

  // Update component state
  const updateState = useCallback(async (newState: any): Promise<boolean> => {
    try {
      // Validate state if enabled
      if (enableValidation) {
        const validation = componentStateValidator.validateState(
          componentId,
          componentType,
          newState
        );

        if (!validation.isValid) {
          if (autoRepair && validation.repairedState) {
            console.warn(`🔧 Auto-repairing state for ${componentId}:`, validation.errors);
            newState = validation.repairedState;
          } else {
            console.error(`❌ State validation failed for ${componentId}:`, validation.errors);
            setComponentState(prev => ({
              ...prev,
              lastValidation: validation
            }));
            return false;
          }
        }

        setComponentState(prev => ({
          ...prev,
          lastValidation: validation
        }));
      }

      // Update in registry
      const success = componentStateRegistry.updateState(componentId, newState);
      
      if (success) {
        stateRef.current = newState;
        
        // Check state integrity
        const integrityCheck = componentStateValidator.checkStateIntegrity(componentId, newState);
        if (!integrityCheck) {
          console.warn(`⚠️ State integrity check failed for ${componentId}`);
        }
      }

      return success;

    } catch (error) {
      console.error('Failed to update component state:', error);
      return false;
    }
  }, [componentId, componentType, enableValidation, autoRepair]);

  // Validate current state
  const validateState = useCallback((state?: any): ValidationResult => {
    const stateToValidate = state || stateRef.current;
    return componentStateValidator.validateState(componentId, componentType, stateToValidate);
  }, [componentId, componentType]);

  // Publish event
  const publishEvent = useCallback((
    topic: string, 
    data: any, 
    type: StateChangeEvent['type'] = 'state_change'
  ): string => {
    return stateChangeEventManager.publish(topic, data, componentId, type);
  }, [componentId]);

  // Subscribe to event
  const subscribeToEvent = useCallback((
    topic: string, 
    callback: (event: StateChangeEvent) => void
  ): string => {
    const subscriptionId = stateChangeEventManager.subscribe(topic, (event) => {
      setComponentState(prev => ({
        ...prev,
        events: {
          ...prev.events,
          lastEvent: event
        }
      }));
      callback(event);
    });

    subscriptionsRef.current.push(subscriptionId);
    setComponentState(prev => ({
      ...prev,
      events: {
        ...prev.events,
        subscriptions: [...prev.events.subscriptions, subscriptionId]
      }
    }));

    return subscriptionId;
  }, []);

  // Unsubscribe from event
  const unsubscribeFromEvent = useCallback((subscriptionId: string) => {
    const success = stateChangeEventManager.unsubscribe(subscriptionId);
    if (success) {
      subscriptionsRef.current = subscriptionsRef.current.filter(id => id !== subscriptionId);
      setComponentState(prev => ({
        ...prev,
        events: {
          ...prev.events,
          subscriptions: prev.events.subscriptions.filter(id => id !== subscriptionId)
        }
      }));
    }
  }, []);

  // Add dependency
  const addDependency = useCallback((
    targetComponentId: string, 
    type: ComponentDependency['type'] = 'state'
  ) => {
    try {
      componentStateRegistry.addDependency({
        from: componentId,
        to: targetComponentId,
        type,
        required: true
      });

      setComponentState(prev => ({
        ...prev,
        dependencies: [...prev.dependencies, targetComponentId]
      }));

    } catch (error) {
      console.error('Failed to add dependency:', error);
    }
  }, [componentId]);

  // Remove dependency
  const removeDependency = useCallback((targetComponentId: string) => {
    const success = componentStateRegistry.removeDependency(componentId, targetComponentId);
    if (success) {
      setComponentState(prev => ({
        ...prev,
        dependencies: prev.dependencies.filter(id => id !== targetComponentId)
      }));
    }
  }, [componentId]);

  // Get registry stats
  const getRegistryStats = useCallback((): RegistryStats => {
    return componentStateRegistry.getStats();
  }, []);

  // Get event stats
  const getEventStats = useCallback((): EventStats => {
    return stateChangeEventManager.getStats();
  }, []);

  // Update dependencies and dependents
  useEffect(() => {
    if (!componentState.isRegistered) return;

    const dependencies = componentStateRegistry.getDependencies(componentId);
    const dependents = componentStateRegistry.getDependents(componentId);

    setComponentState(prev => ({
      ...prev,
      dependencies: dependencies.map(d => d.to),
      dependents: dependents.map(d => d.from)
    }));
  }, [componentId]);

  // Perform periodic health checks
  useEffect(() => {
    if (!componentState.isRegistered) return;

    const interval = setInterval(() => {
      const health = componentStateRegistry.performHealthCheck();
      const isHealthy = !health.unhealthy.includes(componentId);
      const issues = health.issues[componentId] || [];

      setComponentState(prev => ({
        ...prev,
        health: {
          isHealthy,
          issues,
          lastCheck: new Date()
        }
      }));
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [componentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregister();
    };
  }, [unregister]);

  return {
    componentState,
    register,
    unregister,
    updateState,
    validateState,
    publishEvent,
    subscribeToEvent,
    unsubscribeFromEvent,
    addDependency,
    removeDependency,
    getRegistryStats,
    getEventStats
  };
}

/**
 * Hook for monitoring cross-component events
 */
export function useComponentEvents(topicFilter?: string) {
  const [events, setEvents] = useState<StateChangeEvent[]>([]);
  const [stats, setStats] = useState<EventStats>(stateChangeEventManager.getStats());

  useEffect(() => {
    const topic = topicFilter || 'component.*';
    
    const subscriptionId = stateChangeEventManager.subscribe(topic, (event) => {
      setEvents(prev => [...prev.slice(-99), event]); // Keep last 100 events
    });

    const statsInterval = setInterval(() => {
      setStats(stateChangeEventManager.getStats());
    }, 5000);

    return () => {
      stateChangeEventManager.unsubscribe(subscriptionId);
      clearInterval(statsInterval);
    };
  }, [topicFilter]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    stats,
    clearEvents
  };
}

/**
 * Hook for registry monitoring
 */
export function useRegistryMonitor() {
  const [components, setComponents] = useState<ComponentRegistration[]>([]);
  const [stats, setStats] = useState<RegistryStats>(componentStateRegistry.getStats());

  useEffect(() => {
    const updateData = () => {
      setComponents(componentStateRegistry.getAllComponents());
      setStats(componentStateRegistry.getStats());
    };

    // Initial load
    updateData();

    // Listen for registry changes
    componentStateRegistry.addEventListener('component_registered', updateData);
    componentStateRegistry.addEventListener('component_unregistered', updateData);
    componentStateRegistry.addEventListener('component_state_updated', updateData);

    const interval = setInterval(updateData, 10000); // Update every 10 seconds

    return () => {
      componentStateRegistry.removeEventListener('component_registered', updateData);
      componentStateRegistry.removeEventListener('component_unregistered', updateData);
      componentStateRegistry.removeEventListener('component_state_updated', updateData);
      clearInterval(interval);
    };
  }, []);

  const getComponentsByType = useCallback((type: ComponentRegistration['type']) => {
    return components.filter(c => c.type === type);
  }, [components]);

  const getComponentHealth = useCallback(() => {
    return componentStateRegistry.performHealthCheck();
  }, []);

  return {
    components,
    stats,
    getComponentsByType,
    getComponentHealth
  };
}

/**
 * Hook for validation monitoring
 */
export function useValidationMonitor() {
  const [validationStats, setValidationStats] = useState(
    componentStateValidator.getValidationStats()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setValidationStats(componentStateValidator.getValidationStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const clearValidationCache = useCallback(() => {
    componentStateValidator.clearCache();
  }, []);

  return {
    validationStats,
    clearValidationCache
  };
}

export default useCrossComponentState;