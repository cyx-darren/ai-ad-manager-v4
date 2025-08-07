/**
 * Advanced Table Controls Component
 * 
 * Column management, resizing, reordering, and view preferences for campaign table
 * (Phase 6 of Subtask 29.3)
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';

// Icons
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m0 0l3.121 3.121M12 12L3 3m9 9l9 9" />
  </svg>
);

const CogIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ArrowsPointingOutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const QueueListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const DragIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

export interface ColumnDefinition {
  key: string;
  label: string;
  visible: boolean;
  width: number; // pixels
  order: number;
  resizable: boolean;
  sortable: boolean;
  filterable: boolean;
}

export interface TableViewPreference {
  id: string;
  name: string;
  description?: string;
  columns: ColumnDefinition[];
  createdAt: Date;
  isDefault: boolean;
}

interface AdvancedTableControlsProps {
  columns: ColumnDefinition[];
  onColumnsChange: (columns: ColumnDefinition[]) => void;
  onColumnResize: (columnKey: string, width: number) => void;
  onColumnReorder: (fromIndex: number, toIndex: number) => void;
  viewPreferences: TableViewPreference[];
  onSaveViewPreference: (preference: Omit<TableViewPreference, 'id' | 'createdAt'>) => void;
  onLoadViewPreference: (preferenceId: string) => void;
  onDeleteViewPreference: (preferenceId: string) => void;
  advancedFeaturesEnabled?: boolean;
  className?: string;
}

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { key: 'name', label: 'Campaign Name', visible: true, width: 200, order: 0, resizable: true, sortable: true, filterable: true },
  { key: 'status', label: 'Status', visible: true, width: 120, order: 1, resizable: true, sortable: true, filterable: true },
  { key: 'type', label: 'Type', visible: true, width: 150, order: 2, resizable: true, sortable: true, filterable: true },
  { key: 'budget', label: 'Budget', visible: true, width: 120, order: 3, resizable: true, sortable: true, filterable: true },
  { key: 'spend', label: 'Spend', visible: true, width: 120, order: 4, resizable: true, sortable: true, filterable: true },
  { key: 'impressions', label: 'Impressions', visible: true, width: 120, order: 5, resizable: true, sortable: true, filterable: false },
  { key: 'clicks', label: 'Clicks', visible: true, width: 100, order: 6, resizable: true, sortable: true, filterable: false },
  { key: 'ctr', label: 'CTR', visible: true, width: 80, order: 7, resizable: true, sortable: true, filterable: false },
  { key: 'cpc', label: 'CPC', visible: false, width: 80, order: 8, resizable: true, sortable: true, filterable: false },
  { key: 'conversions', label: 'Conversions', visible: true, width: 120, order: 9, resizable: true, sortable: true, filterable: false },
  { key: 'conversionRate', label: 'Conv. Rate', visible: false, width: 100, order: 10, resizable: true, sortable: true, filterable: false },
  { key: 'roas', label: 'ROAS', visible: true, width: 80, order: 11, resizable: true, sortable: true, filterable: false },
  { key: 'lastModified', label: 'Last Modified', visible: false, width: 150, order: 12, resizable: true, sortable: true, filterable: true }
];

export function AdvancedTableControls({
  columns,
  onColumnsChange,
  onColumnResize,
  onColumnReorder,
  viewPreferences,
  onSaveViewPreference,
  onLoadViewPreference,
  onDeleteViewPreference,
  advancedFeaturesEnabled = true,
  className = ''
}: AdvancedTableControlsProps) {

  const [showControls, setShowControls] = useState(false);
  const [activeTab, setActiveTab] = useState<'columns' | 'resize' | 'reorder' | 'preferences'>('columns');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [newPreferenceName, setNewPreferenceName] = useState('');
  const [newPreferenceDescription, setNewPreferenceDescription] = useState('');

  // Load saved view preference from localStorage on mount
  useEffect(() => {
    const savedPreferenceId = localStorage.getItem('campaign-table-view-preference');
    if (savedPreferenceId && viewPreferences.find(p => p.id === savedPreferenceId)) {
      onLoadViewPreference(savedPreferenceId);
    }
  }, [viewPreferences, onLoadViewPreference]);

  // Handle column visibility toggle
  const handleColumnVisibilityToggle = useCallback((columnKey: string) => {
    const updatedColumns = columns.map(col =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updatedColumns);
  }, [columns, onColumnsChange]);

  // Handle column width change
  const handleColumnWidthChange = useCallback((columnKey: string, width: number) => {
    onColumnResize(columnKey, Math.max(50, Math.min(500, width))); // Min 50px, Max 500px
  }, [onColumnResize]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', columnKey);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedColumn) return;

    const sourceIndex = columns.findIndex(col => col.key === draggedColumn);
    if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
      onColumnReorder(sourceIndex, targetIndex);
    }

    setDraggedColumn(null);
    setDragOverIndex(null);
  }, [draggedColumn, columns, onColumnReorder]);

  // Handle saving view preference
  const handleSaveViewPreference = useCallback(() => {
    if (!newPreferenceName.trim()) {
      alert('Please enter a preference name');
      return;
    }

    const preference: Omit<TableViewPreference, 'id' | 'createdAt'> = {
      name: newPreferenceName.trim(),
      description: newPreferenceDescription.trim() || undefined,
      columns: [...columns],
      isDefault: false
    };

    onSaveViewPreference(preference);
    setNewPreferenceName('');
    setNewPreferenceDescription('');
  }, [newPreferenceName, newPreferenceDescription, columns, onSaveViewPreference]);

  // Handle loading view preference
  const handleLoadViewPreference = useCallback((preferenceId: string) => {
    onLoadViewPreference(preferenceId);
    localStorage.setItem('campaign-table-view-preference', preferenceId);
  }, [onLoadViewPreference]);

  // Reset to default columns
  const handleResetToDefault = useCallback(() => {
    onColumnsChange([...DEFAULT_COLUMNS]);
    localStorage.removeItem('campaign-table-view-preference');
  }, [onColumnsChange]);

  // Get visible columns count
  const visibleColumnsCount = columns.filter(col => col.visible).length;
  const totalColumnsCount = columns.length;

  if (!advancedFeaturesEnabled) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Controls Toggle Button */}
      {!showControls && (
        <div className="p-4">
          <button
            onClick={() => setShowControls(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <CogIcon />
            <span className="ml-2">Table Options</span>
            <span className="ml-2 text-gray-500">
              ({visibleColumnsCount}/{totalColumnsCount} columns)
            </span>
          </button>
        </div>
      )}

      {/* Advanced Controls Panel */}
      {showControls && (
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CogIcon />
              <h3 className="text-lg font-medium text-gray-900">Advanced Table Controls</h3>
            </div>
            <button
              onClick={() => setShowControls(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'columns' as const, label: 'Show/Hide', icon: EyeIcon },
                { key: 'resize' as const, label: 'Resize', icon: ArrowsPointingOutIcon },
                { key: 'reorder' as const, label: 'Reorder', icon: QueueListIcon },
                { key: 'preferences' as const, label: 'Preferences', icon: SaveIcon }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon />
                  <span className="ml-2">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {/* Column Visibility Tab */}
            {activeTab === 'columns' && (
              <div>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Column Visibility ({visibleColumnsCount}/{totalColumnsCount} visible)
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {columns.sort((a, b) => a.order - b.order).map(column => (
                      <label
                        key={column.key}
                        className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.visible}
                          onChange={() => handleColumnVisibilityToggle(column.key)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{column.label}</span>
                        {column.visible ? (
                          <EyeIcon />
                        ) : (
                          <EyeSlashIcon />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const allVisible = columns.map(col => ({ ...col, visible: true }));
                      onColumnsChange(allVisible);
                    }}
                    className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                  >
                    Show All
                  </button>
                  <button
                    onClick={handleResetToDefault}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Reset Default
                  </button>
                </div>
              </div>
            )}

            {/* Column Resize Tab */}
            {activeTab === 'resize' && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Column Widths</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {columns
                    .filter(col => col.visible && col.resizable)
                    .sort((a, b) => a.order - b.order)
                    .map(column => (
                      <div key={column.key} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                        <label className="text-sm text-gray-700 flex-1">
                          {column.label}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={column.width}
                            onChange={(e) => handleColumnWidthChange(column.key, parseInt(e.target.value))}
                            className="w-24"
                          />
                          <input
                            type="number"
                            min="50"
                            max="500"
                            value={column.width}
                            onChange={(e) => handleColumnWidthChange(column.key, parseInt(e.target.value) || 50)}
                            className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-500">px</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Column Reorder Tab */}
            {activeTab === 'reorder' && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Column Order</h4>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {columns
                    .sort((a, b) => a.order - b.order)
                    .map((column, index) => (
                      <div
                        key={column.key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, column.key)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`flex items-center p-2 border border-gray-200 rounded cursor-move hover:bg-gray-50 ${
                          dragOverIndex === index ? 'bg-indigo-50 border-indigo-300' : ''
                        } ${draggedColumn === column.key ? 'opacity-50' : ''}`}
                      >
                        <DragIcon />
                        <span className="ml-2 text-sm font-medium text-gray-500">#{index + 1}</span>
                        <span className="ml-3 text-sm text-gray-700 flex-1">{column.label}</span>
                        {column.visible ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Visible</span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">Hidden</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* View Preferences Tab */}
            {activeTab === 'preferences' && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">View Preferences</h4>
                
                {/* Save New Preference */}
                <div className="mb-4 p-3 border border-gray-200 rounded-md bg-gray-50">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">Save Current View</h5>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Preference name"
                      value={newPreferenceName}
                      onChange={(e) => setNewPreferenceName(e.target.value)}
                      className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newPreferenceDescription}
                      onChange={(e) => setNewPreferenceDescription(e.target.value)}
                      className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSaveViewPreference}
                      disabled={!newPreferenceName.trim()}
                      className="inline-flex items-center px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SaveIcon />
                      <span className="ml-1">Save Preference</span>
                    </button>
                  </div>
                </div>

                {/* Saved Preferences */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {viewPreferences.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No saved preferences</p>
                  ) : (
                    viewPreferences.map(preference => (
                      <div
                        key={preference.id}
                        className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{preference.name}</div>
                          {preference.description && (
                            <div className="text-xs text-gray-500">{preference.description}</div>
                          )}
                          <div className="text-xs text-gray-400">
                            {preference.columns.filter(c => c.visible).length} columns • {preference.createdAt.toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleLoadViewPreference(preference.id)}
                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                          >
                            Load
                          </button>
                          {!preference.isDefault && (
                            <button
                              onClick={() => onDeleteViewPreference(preference.id)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}