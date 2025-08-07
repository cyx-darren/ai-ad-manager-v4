/**
 * Table View Preferences Hook
 * 
 * Manages table view preferences including column visibility, width, order,
 * and saved view configurations (Phase 6 of Subtask 29.3)
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ColumnDefinition, TableViewPreference } from '@/components/dashboard/AdvancedTableControls';

interface UseTableViewPreferencesProps {
  tableId: string; // Unique identifier for the table (e.g., 'campaign-table')
  defaultColumns: ColumnDefinition[];
  enabled?: boolean;
}

interface UseTableViewPreferencesReturn {
  // Current columns state
  columns: ColumnDefinition[];
  
  // Column management
  updateColumns: (columns: ColumnDefinition[]) => void;
  toggleColumnVisibility: (columnKey: string) => void;
  resizeColumn: (columnKey: string, width: number) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  resetToDefault: () => void;
  
  // View preferences
  viewPreferences: TableViewPreference[];
  saveViewPreference: (preference: Omit<TableViewPreference, 'id' | 'createdAt'>) => void;
  loadViewPreference: (preferenceId: string) => void;
  deleteViewPreference: (preferenceId: string) => void;
  
  // Computed values
  visibleColumns: ColumnDefinition[];
  columnWidths: Record<string, number>;
  columnOrder: string[];
  
  // Storage management
  clearAllPreferences: () => void;
  exportPreferences: () => string;
  importPreferences: (data: string) => boolean;
}

const STORAGE_KEYS = {
  columns: (tableId: string) => `table-columns-${tableId}`,
  preferences: (tableId: string) => `table-preferences-${tableId}`,
  activePreference: (tableId: string) => `table-active-preference-${tableId}`
};

export function useTableViewPreferences({
  tableId,
  defaultColumns,
  enabled = true
}: UseTableViewPreferencesProps): UseTableViewPreferencesReturn {

  // State for current columns
  const [columns, setColumns] = useState<ColumnDefinition[]>(defaultColumns);
  
  // State for saved view preferences
  const [viewPreferences, setViewPreferences] = useState<TableViewPreference[]>([]);

  // Load saved columns and preferences from localStorage on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      // Load saved columns
      const savedColumns = localStorage.getItem(STORAGE_KEYS.columns(tableId));
      if (savedColumns) {
        const parsedColumns = JSON.parse(savedColumns);
        // Merge with default columns to handle new columns added to the app
        const mergedColumns = mergeWithDefaults(parsedColumns, defaultColumns);
        setColumns(mergedColumns);
      }

      // Load saved preferences
      const savedPreferences = localStorage.getItem(STORAGE_KEYS.preferences(tableId));
      if (savedPreferences) {
        const parsedPreferences = JSON.parse(savedPreferences);
        const preferences = parsedPreferences.map((pref: any) => ({
          ...pref,
          createdAt: new Date(pref.createdAt)
        }));
        setViewPreferences(preferences);
      }
    } catch (error) {
      console.warn('Failed to load table view preferences:', error);
    }
  }, [tableId, defaultColumns, enabled]);

  // Save columns to localStorage whenever they change
  useEffect(() => {
    if (!enabled) return;

    try {
      localStorage.setItem(STORAGE_KEYS.columns(tableId), JSON.stringify(columns));
    } catch (error) {
      console.warn('Failed to save table columns:', error);
    }
  }, [columns, tableId, enabled]);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!enabled) return;

    try {
      localStorage.setItem(STORAGE_KEYS.preferences(tableId), JSON.stringify(viewPreferences));
    } catch (error) {
      console.warn('Failed to save table preferences:', error);
    }
  }, [viewPreferences, tableId, enabled]);

  // Merge saved columns with defaults to handle schema changes
  const mergeWithDefaults = useCallback((saved: ColumnDefinition[], defaults: ColumnDefinition[]): ColumnDefinition[] => {
    const savedMap = new Map(saved.map(col => [col.key, col]));
    const merged: ColumnDefinition[] = [];

    // Add all default columns, using saved settings if available
    defaults.forEach(defaultCol => {
      const savedCol = savedMap.get(defaultCol.key);
      if (savedCol) {
        // Use saved column but ensure all required properties exist
        merged.push({
          ...defaultCol,
          ...savedCol,
          key: defaultCol.key, // Ensure key is consistent
          label: defaultCol.label, // Use updated label from defaults
          resizable: defaultCol.resizable, // Use updated capabilities from defaults
          sortable: defaultCol.sortable,
          filterable: defaultCol.filterable
        });
      } else {
        // New column not in saved data
        merged.push({ ...defaultCol });
      }
    });

    return merged;
  }, []);

  // Update columns
  const updateColumns = useCallback((newColumns: ColumnDefinition[]) => {
    setColumns(newColumns);
  }, []);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnKey: string) => {
    setColumns(prevColumns => 
      prevColumns.map(col =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col
      )
    );
  }, []);

  // Resize column
  const resizeColumn = useCallback((columnKey: string, width: number) => {
    setColumns(prevColumns => 
      prevColumns.map(col =>
        col.key === columnKey ? { ...col, width: Math.max(50, Math.min(500, width)) } : col
      )
    );
  }, []);

  // Reorder columns
  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      const sortedColumns = newColumns.sort((a, b) => a.order - b.order);
      
      // Move the column
      const [movedColumn] = sortedColumns.splice(fromIndex, 1);
      sortedColumns.splice(toIndex, 0, movedColumn);
      
      // Update order values
      sortedColumns.forEach((col, index) => {
        col.order = index;
      });
      
      return sortedColumns;
    });
  }, []);

  // Reset to default columns
  const resetToDefault = useCallback(() => {
    setColumns([...defaultColumns]);
    try {
      localStorage.removeItem(STORAGE_KEYS.columns(tableId));
      localStorage.removeItem(STORAGE_KEYS.activePreference(tableId));
    } catch (error) {
      console.warn('Failed to clear table preferences:', error);
    }
  }, [defaultColumns, tableId]);

  // Save view preference
  const saveViewPreference = useCallback((preference: Omit<TableViewPreference, 'id' | 'createdAt'>) => {
    const newPreference: TableViewPreference = {
      ...preference,
      id: `pref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      columns: [...preference.columns] // Deep copy columns
    };

    setViewPreferences(prev => [...prev, newPreference]);
  }, []);

  // Load view preference
  const loadViewPreference = useCallback((preferenceId: string) => {
    const preference = viewPreferences.find(pref => pref.id === preferenceId);
    if (preference) {
      setColumns([...preference.columns]);
      try {
        localStorage.setItem(STORAGE_KEYS.activePreference(tableId), preferenceId);
      } catch (error) {
        console.warn('Failed to save active preference:', error);
      }
    }
  }, [viewPreferences, tableId]);

  // Delete view preference
  const deleteViewPreference = useCallback((preferenceId: string) => {
    setViewPreferences(prev => prev.filter(pref => pref.id !== preferenceId));
    
    // Clear active preference if it was deleted
    try {
      const activePreference = localStorage.getItem(STORAGE_KEYS.activePreference(tableId));
      if (activePreference === preferenceId) {
        localStorage.removeItem(STORAGE_KEYS.activePreference(tableId));
      }
    } catch (error) {
      console.warn('Failed to clear active preference:', error);
    }
  }, [tableId]);

  // Clear all preferences
  const clearAllPreferences = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.columns(tableId));
      localStorage.removeItem(STORAGE_KEYS.preferences(tableId));
      localStorage.removeItem(STORAGE_KEYS.activePreference(tableId));
      setColumns([...defaultColumns]);
      setViewPreferences([]);
    } catch (error) {
      console.warn('Failed to clear all preferences:', error);
    }
  }, [tableId, defaultColumns]);

  // Export preferences
  const exportPreferences = useCallback(() => {
    const data = {
      tableId,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      columns,
      viewPreferences: viewPreferences.map(pref => ({
        ...pref,
        createdAt: pref.createdAt.toISOString()
      }))
    };
    return JSON.stringify(data, null, 2);
  }, [tableId, columns, viewPreferences]);

  // Import preferences
  const importPreferences = useCallback((data: string): boolean => {
    try {
      const parsed = JSON.parse(data);
      
      // Validate structure
      if (!parsed.tableId || !parsed.columns || !Array.isArray(parsed.viewPreferences)) {
        return false;
      }

      // Merge imported columns with current defaults
      const mergedColumns = mergeWithDefaults(parsed.columns, defaultColumns);
      setColumns(mergedColumns);

      // Import view preferences
      const importedPreferences = parsed.viewPreferences.map((pref: any) => ({
        ...pref,
        id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate new IDs
        createdAt: new Date(pref.createdAt),
        columns: mergeWithDefaults(pref.columns, defaultColumns)
      }));

      setViewPreferences(prev => [...prev, ...importedPreferences]);
      return true;
    } catch (error) {
      console.warn('Failed to import preferences:', error);
      return false;
    }
  }, [defaultColumns, mergeWithDefaults]);

  // Computed values
  const visibleColumns = useMemo(() => 
    columns.filter(col => col.visible).sort((a, b) => a.order - b.order),
    [columns]
  );

  const columnWidths = useMemo(() => 
    columns.reduce((acc, col) => {
      acc[col.key] = col.width;
      return acc;
    }, {} as Record<string, number>),
    [columns]
  );

  const columnOrder = useMemo(() => 
    columns.sort((a, b) => a.order - b.order).map(col => col.key),
    [columns]
  );

  return {
    // Current state
    columns,
    
    // Column management
    updateColumns,
    toggleColumnVisibility,
    resizeColumn,
    reorderColumns,
    resetToDefault,
    
    // View preferences
    viewPreferences,
    saveViewPreference,
    loadViewPreference,
    deleteViewPreference,
    
    // Computed values
    visibleColumns,
    columnWidths,
    columnOrder,
    
    // Storage management
    clearAllPreferences,
    exportPreferences,
    importPreferences
  };
}