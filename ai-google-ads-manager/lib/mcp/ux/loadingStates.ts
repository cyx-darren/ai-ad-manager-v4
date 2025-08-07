/**
 * Property Loading States Manager
 * 
 * Provides loading state management for property switching operations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  loadingType: 'initial' | 'switching' | 'validation' | 'data_fetch';
  progress: number;
  message: string;
  estimatedDuration: number;
  startTime: Date;
  stage: string;
}

export interface LoadingOperation {
  id: string;
  type: 'property_switch' | 'property_validation' | 'data_loading';
  propertyId?: string;
  description: string;
  startTime: Date;
  estimatedDuration: number;
}

export interface LoadingConfig {
  enableSkeletonLoaders: boolean;
  enableProgressIndicators: boolean;
  minimumLoadingDuration: number;
  maxLoadingDuration: number;
  transitionDuration: number;
}

export interface PropertyLoadingState {
  propertyId: string;
  propertyName: string;
  loadingState: LoadingState;
  operation: LoadingOperation | null;
  error: Error | null;
}

export interface LoadingProgress {
  overall: number;
  stages: Record<string, number>;
  currentStage: string;
  estimatedTimeRemaining: number;
}

export interface SkeletonConfig {
  showPropertyBadge: boolean;
  showMetricCards: boolean;
  showCharts: boolean;
  animationDuration: number;
  shimmerEffect: boolean;
}

export interface UsePropertyLoadingResult {
  loadingState: PropertyLoadingState | null;
  startLoading: (operation: Partial<LoadingOperation>) => void;
  updateProgress: (progress: number, stage?: string) => void;
  completeLoading: () => void;
  errorLoading: (error: Error) => void;
  getSkeletonConfig: () => SkeletonConfig;
  isLoading: boolean;
  progress: LoadingProgress;
}

/**
 * Property Loading Manager
 */
export class PropertyLoadingManager {
  private config: LoadingConfig;
  private activeOperations: Map<string, LoadingOperation> = new Map();
  private loadingStates: Map<string, PropertyLoadingState> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<LoadingConfig> = {}) {
    this.config = {
      enableSkeletonLoaders: true,
      enableProgressIndicators: true,
      minimumLoadingDuration: 300,
      maxLoadingDuration: 30000,
      transitionDuration: 250,
      ...config
    };
  }

  startPropertyLoading(propertyId: string, propertyName: string, operation: Partial<LoadingOperation>): string {
    const operationId = this.generateOperationId();
    
    const fullOperation: LoadingOperation = {
      id: operationId,
      type: operation.type || 'property_switch',
      propertyId,
      description: operation.description || 'Loading property...',
      startTime: new Date(),
      estimatedDuration: operation.estimatedDuration || 2500
    };

    const loadingState: PropertyLoadingState = {
      propertyId,
      propertyName,
      loadingState: {
        isLoading: true,
        loadingType: this.mapOperationTypeToLoadingType(fullOperation.type),
        progress: 0,
        message: fullOperation.description,
        estimatedDuration: fullOperation.estimatedDuration,
        startTime: fullOperation.startTime,
        stage: 'Starting...'
      },
      operation: fullOperation,
      error: null
    };

    this.activeOperations.set(operationId, fullOperation);
    this.loadingStates.set(propertyId, loadingState);

    const timeout = setTimeout(() => {
      this.timeoutOperation(operationId);
    }, this.config.maxLoadingDuration);
    this.timeouts.set(operationId, timeout);

    return operationId;
  }

  updateProgress(operationId: string, progress: number, stage?: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const loadingState = this.loadingStates.get(operation.propertyId!);
    if (!loadingState) return;

    loadingState.loadingState.progress = Math.min(100, Math.max(0, progress));
    if (stage) {
      loadingState.loadingState.stage = stage;
    }
  }

  completeLoading(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const loadingState = this.loadingStates.get(operation.propertyId!);
    if (!loadingState) return;

    const elapsed = Date.now() - operation.startTime.getTime();
    const remainingMinDuration = Math.max(0, this.config.minimumLoadingDuration - elapsed);

    setTimeout(() => {
      loadingState.loadingState.isLoading = false;
      loadingState.loadingState.progress = 100;
      loadingState.loadingState.stage = 'Completed';
      this.cleanupOperation(operationId);
    }, remainingMinDuration);
  }

  errorLoading(operationId: string, error: Error): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const loadingState = this.loadingStates.get(operation.propertyId!);
    if (!loadingState) return;

    loadingState.loadingState.isLoading = false;
    loadingState.error = error;
    loadingState.loadingState.stage = 'Error';
    this.cleanupOperation(operationId);
  }

  getLoadingState(propertyId: string): PropertyLoadingState | null {
    return this.loadingStates.get(propertyId) || null;
  }

  getSkeletonConfig(loadingType?: LoadingState['loadingType']): SkeletonConfig {
    const baseConfig: SkeletonConfig = {
      showPropertyBadge: true,
      showMetricCards: true,
      showCharts: true,
      animationDuration: 1500,
      shimmerEffect: true
    };

    switch (loadingType) {
      case 'initial':
        return { ...baseConfig, showPropertyBadge: false };
      case 'switching':
        return { ...baseConfig, showCharts: false };
      case 'validation':
        return { ...baseConfig, showMetricCards: false, showCharts: false };
      default:
        return baseConfig;
    }
  }

  private generateOperationId(): string {
    return `loading_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapOperationTypeToLoadingType(operationType: LoadingOperation['type']): LoadingState['loadingType'] {
    const mapping = {
      property_switch: 'switching' as const,
      property_validation: 'validation' as const,
      data_loading: 'data_fetch' as const
    };
    return mapping[operationType] || 'switching';
  }

  private timeoutOperation(operationId: string): void {
    this.errorLoading(operationId, new Error('Loading operation timed out'));
  }

  private cleanupOperation(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (operation && operation.propertyId) {
      setTimeout(() => {
        this.loadingStates.delete(operation.propertyId!);
      }, this.config.transitionDuration);
    }

    this.activeOperations.delete(operationId);
    const timeout = this.timeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(operationId);
    }
  }
}

/**
 * React hook for property loading states
 */
export function usePropertyLoading(propertyId?: string): UsePropertyLoadingResult {
  const [loadingState, setLoadingState] = useState<PropertyLoadingState | null>(null);
  const [progress, setProgress] = useState<LoadingProgress>({
    overall: 0,
    stages: {},
    currentStage: '',
    estimatedTimeRemaining: 0
  });

  const managerRef = useRef<PropertyLoadingManager>();
  if (!managerRef.current) {
    managerRef.current = propertyLoadingManager;
  }

  const currentOperationRef = useRef<string | null>(null);

  useEffect(() => {
    if (propertyId) {
      const state = managerRef.current!.getLoadingState(propertyId);
      setLoadingState(state);
    }
  }, [propertyId]);

  const startLoading = useCallback((operation: Partial<LoadingOperation>) => {
    if (!propertyId) return;

    const operationId = managerRef.current!.startPropertyLoading(
      propertyId,
      operation.description || 'Loading...',
      operation
    );

    currentOperationRef.current = operationId;
    const state = managerRef.current!.getLoadingState(propertyId);
    setLoadingState(state);
  }, [propertyId]);

  const updateProgress = useCallback((progressValue: number, stage?: string) => {
    if (currentOperationRef.current) {
      managerRef.current!.updateProgress(currentOperationRef.current, progressValue, stage);
    }
  }, []);

  const completeLoading = useCallback(() => {
    if (currentOperationRef.current) {
      managerRef.current!.completeLoading(currentOperationRef.current);
      currentOperationRef.current = null;
    }
  }, []);

  const errorLoading = useCallback((error: Error) => {
    if (currentOperationRef.current) {
      managerRef.current!.errorLoading(currentOperationRef.current, error);
      currentOperationRef.current = null;
    }
  }, []);

  const getSkeletonConfig = useCallback((): SkeletonConfig => {
    return managerRef.current!.getSkeletonConfig(loadingState?.loadingState.loadingType);
  }, [loadingState]);

  return {
    loadingState,
    startLoading,
    updateProgress,
    completeLoading,
    errorLoading,
    getSkeletonConfig,
    isLoading: loadingState?.loadingState.isLoading || false,
    progress
  };
}

export const propertyLoadingManager = new PropertyLoadingManager();
export default propertyLoadingManager;