/**
 * Component State Registry
 * 
 * Centralized registry system for tracking all MCP components and their state,
 * managing component relationships, dependencies, and lifecycle events.
 */

export interface ComponentState {
  [key: string]: unknown;
}

export interface ComponentRegistration<T = ComponentState> {
  id: string;
  name: string;
  type: 'widget' | 'chart' | 'filter' | 'control' | 'layout' | 'data';
  version: string;
  state: T;
  metadata: {
    mountedAt: Date;
    lastUpdated: Date;
    updateCount: number;
    errorCount: number;
    dependencies: string[];
    children: string[];
    parent?: string;
    tags: string[];
  };
  config: {
    autoSync: boolean;
    validateState: boolean;
    enableEvents: boolean;
    priority: 'low' | 'normal' | 'high' | 'critical';
  };
  hooks: {
    onStateChange?: <T = ComponentState>(newState: T, oldState: T) => void;
    onMount?: <T = ComponentState>(component: ComponentRegistration<T>) => void;
    onUnmount?: <T = ComponentState>(component: ComponentRegistration<T>) => void;
    onError?: <T = ComponentState>(error: Error, component: ComponentRegistration<T>) => void;
  };
}

export interface ComponentSnapshot<T = ComponentState> {
  timestamp: Date;
  componentId: string;
  state: T;
  version: string;
  checksum: string;
}

export interface ComponentDependency {
  from: string;
  to: string;
  type: 'state' | 'data' | 'event' | 'lifecycle';
  required: boolean;
  description?: string;
}

export interface RegistryStats {
  totalComponents: number;
  componentsByType: Record<string, number>;
  activeComponents: number;
  errorComponents: number;
  averageUpdateCount: number;
  totalStateSize: number;
  dependencyCount: number;
}

export interface RegistryEventData {
  type: string;
  componentId?: string;
  timestamp: number;
  state?: ComponentState;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Component State Registry Manager
 */
export class ComponentStateRegistry {
  private components: Map<string, ComponentRegistration> = new Map();
  private snapshots: Map<string, ComponentSnapshot[]> = new Map();
  private dependencies: ComponentDependency[] = [];
  private eventListeners: Map<string, ((data: RegistryEventData) => void)[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeHealthCheck();
  }

  /**
   * Register a new component
   */
  register(component: Omit<ComponentRegistration, 'metadata'>): ComponentRegistration {
    const registration: ComponentRegistration = {
      ...component,
      metadata: {
        mountedAt: new Date(),
        lastUpdated: new Date(),
        updateCount: 0,
        errorCount: 0,
        dependencies: [],
        children: [],
        tags: [],
        ...component.metadata
      }
    };

    // Validate component ID uniqueness
    if (this.components.has(component.id)) {
      throw new Error(`Component with ID '${component.id}' is already registered`);
    }

    this.components.set(component.id, registration);
    this.initializeSnapshots(component.id);

    // Create initial snapshot
    this.createSnapshot(component.id, registration.state);

    // Call onMount hook if provided
    if (registration.hooks.onMount) {
      try {
        registration.hooks.onMount(registration);
      } catch (error) {
        this.handleComponentError(component.id, error);
      }
    }

    this.emitEvent('component_registered', { component: registration });

    console.log(`🔧 Component registered: ${component.name} (${component.id})`);

    return registration;
  }

  /**
   * Unregister a component
   */
  unregister(componentId: string): boolean {
    const component = this.components.get(componentId);
    if (!component) {
      return false;
    }

    // Call onUnmount hook if provided
    if (component.hooks.onUnmount) {
      try {
        component.hooks.onUnmount(component);
      } catch (error) {
        this.handleComponentError(componentId, error);
      }
    }

    // Remove dependencies
    this.removeDependenciesByComponent(componentId);

    // Remove from parent's children list
    if (component.metadata.parent) {
      this.removeChild(component.metadata.parent, componentId);
    }

    // Remove children from this component
    component.metadata.children.forEach(childId => {
      const child = this.components.get(childId);
      if (child) {
        child.metadata.parent = undefined;
      }
    });

    // Clean up snapshots
    this.snapshots.delete(componentId);

    // Remove from registry
    this.components.delete(componentId);

    this.emitEvent('component_unregistered', { componentId, component });

    console.log(`🗑️ Component unregistered: ${componentId}`);

    return true;
  }

  /**
   * Update component state
   */
  updateState<T = ComponentState>(componentId: string, newState: T): boolean {
    const component = this.components.get(componentId);
    if (!component) {
      console.warn(`Component '${componentId}' not found for state update`);
      return false;
    }

    const oldState = component.state;
    
    // Create snapshot before update
    this.createSnapshot(componentId, oldState);

    // Update component state and metadata
    component.state = newState;
    component.metadata.lastUpdated = new Date();
    component.metadata.updateCount++;

    // Call onStateChange hook if provided
    if (component.hooks.onStateChange) {
      try {
        component.hooks.onStateChange(newState, oldState);
      } catch (error) {
        this.handleComponentError(componentId, error);
      }
    }

    this.emitEvent('component_state_updated', { 
      componentId, 
      newState, 
      oldState, 
      component 
    });

    return true;
  }

  /**
   * Get component registration
   */
  getComponent(componentId: string): ComponentRegistration | null {
    return this.components.get(componentId) || null;
  }

  /**
   * Get all components
   */
  getAllComponents(): ComponentRegistration[] {
    return Array.from(this.components.values());
  }

  /**
   * Get components by type
   */
  getComponentsByType(type: ComponentRegistration['type']): ComponentRegistration[] {
    return Array.from(this.components.values()).filter(c => c.type === type);
  }

  /**
   * Get component state
   */
  getState<T = ComponentState>(componentId: string): T | null {
    const component = this.components.get(componentId);
    return component ? component.state : null;
  }

  /**
   * Add dependency between components
   */
  addDependency(dependency: ComponentDependency): void {
    // Validate that both components exist
    if (!this.components.has(dependency.from) || !this.components.has(dependency.to)) {
      throw new Error('Cannot add dependency: one or both components do not exist');
    }

    // Check for circular dependencies
    if (this.wouldCreateCircularDependency(dependency.from, dependency.to)) {
      throw new Error('Cannot add dependency: would create circular dependency');
    }

    // Remove existing dependency if any
    this.dependencies = this.dependencies.filter(d => 
      !(d.from === dependency.from && d.to === dependency.to && d.type === dependency.type)
    );

    this.dependencies.push(dependency);

    // Update component metadata
    const fromComponent = this.components.get(dependency.from)!;
    if (!fromComponent.metadata.dependencies.includes(dependency.to)) {
      fromComponent.metadata.dependencies.push(dependency.to);
    }

    this.emitEvent('dependency_added', { dependency });
  }

  /**
   * Remove dependency between components
   */
  removeDependency(from: string, to: string, type?: ComponentDependency['type']): boolean {
    const initialLength = this.dependencies.length;
    
    this.dependencies = this.dependencies.filter(d => {
      if (d.from === from && d.to === to) {
        return type ? d.type !== type : false;
      }
      return true;
    });

    if (this.dependencies.length < initialLength) {
      // Update component metadata
      const fromComponent = this.components.get(from);
      if (fromComponent && !type) {
        fromComponent.metadata.dependencies = fromComponent.metadata.dependencies.filter(id => id !== to);
      }

      this.emitEvent('dependency_removed', { from, to, type });
      return true;
    }

    return false;
  }

  /**
   * Get dependencies for a component
   */
  getDependencies(componentId: string): ComponentDependency[] {
    return this.dependencies.filter(d => d.from === componentId);
  }

  /**
   * Get dependents of a component
   */
  getDependents(componentId: string): ComponentDependency[] {
    return this.dependencies.filter(d => d.to === componentId);
  }

  /**
   * Set parent-child relationship
   */
  setParent(childId: string, parentId: string): void {
    const child = this.components.get(childId);
    const parent = this.components.get(parentId);

    if (!child || !parent) {
      throw new Error('Cannot set parent: component(s) not found');
    }

    // Remove from previous parent if any
    if (child.metadata.parent) {
      this.removeChild(child.metadata.parent, childId);
    }

    // Set new parent
    child.metadata.parent = parentId;
    
    // Add to parent's children list
    if (!parent.metadata.children.includes(childId)) {
      parent.metadata.children.push(childId);
    }

    this.emitEvent('parent_child_set', { childId, parentId });
  }

  /**
   * Get component snapshots
   */
  getSnapshots(componentId: string, limit: number = 10): ComponentSnapshot[] {
    const snapshots = this.snapshots.get(componentId) || [];
    return snapshots.slice(-limit);
  }

  /**
   * Restore component state from snapshot
   */
  restoreFromSnapshot(componentId: string, snapshotIndex: number = 0): boolean {
    const snapshots = this.snapshots.get(componentId);
    if (!snapshots || snapshots.length === 0) {
      return false;
    }

    const snapshot = snapshots[snapshots.length - 1 - snapshotIndex];
    if (!snapshot) {
      return false;
    }

    return this.updateState(componentId, snapshot.state);
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const components = Array.from(this.components.values());
    const componentsByType: Record<string, number> = {};
    let totalUpdateCount = 0;
    let totalStateSize = 0;
    let errorComponents = 0;

    components.forEach(component => {
      componentsByType[component.type] = (componentsByType[component.type] || 0) + 1;
      totalUpdateCount += component.metadata.updateCount;
      totalStateSize += this.calculateStateSize(component.state);
      
      if (component.metadata.errorCount > 0) {
        errorComponents++;
      }
    });

    return {
      totalComponents: components.length,
      componentsByType,
      activeComponents: components.length,
      errorComponents,
      averageUpdateCount: components.length > 0 ? totalUpdateCount / components.length : 0,
      totalStateSize,
      dependencyCount: this.dependencies.length
    };
  }

  /**
   * Perform health check on all components
   */
  performHealthCheck(): { healthy: string[]; unhealthy: string[]; issues: Record<string, string[]> } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];
    const issues: Record<string, string[]> = {};

    this.components.forEach((component, id) => {
      const componentIssues: string[] = [];

      // Check for high error count
      if (component.metadata.errorCount > 10) {
        componentIssues.push(`High error count: ${component.metadata.errorCount}`);
      }

      // Check for stale components (no updates in last hour)
      const now = Date.now();
      const lastUpdate = component.metadata.lastUpdated.getTime();
      if (now - lastUpdate > 3600000 && component.metadata.updateCount > 0) {
        componentIssues.push('Component appears stale (no updates in 1 hour)');
      }

      // Check for missing dependencies
      const missingDeps = component.metadata.dependencies.filter(depId => 
        !this.components.has(depId)
      );
      if (missingDeps.length > 0) {
        componentIssues.push(`Missing dependencies: ${missingDeps.join(', ')}`);
      }

      if (componentIssues.length > 0) {
        unhealthy.push(id);
        issues[id] = componentIssues;
      } else {
        healthy.push(id);
      }
    });

    return { healthy, unhealthy, issues };
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (data: RegistryEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (data: RegistryEventData) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clean up registry
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Unregister all components
    const componentIds = Array.from(this.components.keys());
    componentIds.forEach(id => this.unregister(id));

    // Clear all data
    this.components.clear();
    this.snapshots.clear();
    this.dependencies = [];
    this.eventListeners.clear();
  }

  // Private methods

  private initializeSnapshots(componentId: string): void {
    if (!this.snapshots.has(componentId)) {
      this.snapshots.set(componentId, []);
    }
  }

  private createSnapshot<T = ComponentState>(componentId: string, state: T): void {
    const snapshots = this.snapshots.get(componentId);
    if (!snapshots) return;

    const snapshot: ComponentSnapshot = {
      timestamp: new Date(),
      componentId,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      version: Date.now().toString(),
      checksum: this.calculateChecksum(state)
    };

    snapshots.push(snapshot);

    // Keep only last 50 snapshots
    if (snapshots.length > 50) {
      snapshots.splice(0, snapshots.length - 50);
    }
  }

  private calculateChecksum<T = ComponentState>(data: T): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private calculateStateSize<T = ComponentState>(state: T): number {
    try {
      return JSON.stringify(state).length;
    } catch {
      return 0;
    }
  }

  private wouldCreateCircularDependency(from: string, to: string): boolean {
    const visited = new Set<string>();
    
    const hasPath = (current: string, target: string): boolean => {
      if (current === target) return true;
      if (visited.has(current)) return false;
      
      visited.add(current);
      
      const deps = this.dependencies.filter(d => d.from === current);
      return deps.some(dep => hasPath(dep.to, target));
    };

    return hasPath(to, from);
  }

  private removeDependenciesByComponent(componentId: string): void {
    this.dependencies = this.dependencies.filter(d => 
      d.from !== componentId && d.to !== componentId
    );

    // Update metadata for affected components
    this.components.forEach(component => {
      component.metadata.dependencies = component.metadata.dependencies.filter(id => id !== componentId);
    });
  }

  private removeChild(parentId: string, childId: string): void {
    const parent = this.components.get(parentId);
    if (parent) {
      parent.metadata.children = parent.metadata.children.filter(id => id !== childId);
    }
  }

  private handleComponentError(componentId: string, error: Error): void {
    const component = this.components.get(componentId);
    if (component) {
      component.metadata.errorCount++;
      
      if (component.hooks.onError) {
        try {
          component.hooks.onError(error, component);
        } catch (hookError) {
          console.error('Error in component error hook:', hookError);
        }
      }
    }

    this.emitEvent('component_error', { componentId, error, component });
    console.error(`Component error in ${componentId}:`, error);
  }

  private initializeHealthCheck(): void {
    // Perform health check every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      const health = this.performHealthCheck();
      if (health.unhealthy.length > 0) {
        this.emitEvent('health_check_issues', health);
      }
    }, 5 * 60 * 1000);
  }

  private emitEvent(event: string, data: RegistryEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in registry event listener:', error);
        }
      });
    }
  }
}

// Singleton instance for global use
export const componentStateRegistry = new ComponentStateRegistry();

export default componentStateRegistry;