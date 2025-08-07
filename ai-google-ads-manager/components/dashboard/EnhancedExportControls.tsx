/**
 * Enhanced Export Controls Component
 * 
 * Advanced export functionality for campaign table with multiple formats,
 * progress indicators, and feature flag control (Phase 5 of Subtask 29.3)
 */

'use client';

import React, { useState, useCallback } from 'react';
import { CampaignData } from '@/lib/mcp/dataFetchers/CampaignTableDataFetcher';

// Icons
const DocumentArrowDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TableCellsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0a2 2 0 002-2h6l2 2h6a2 2 0 012 2v1" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CloudArrowDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';
export type ExportScope = 'all' | 'filtered' | 'visible' | 'selected';

interface ExportProgress {
  status: 'idle' | 'preparing' | 'exporting' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  downloadUrl?: string;
  filename?: string;
  fileSize?: number;
  recordCount?: number;
}

interface ExportConfiguration {
  format: ExportFormat;
  scope: ExportScope;
  includeHeaders: boolean;
  includeMetadata: boolean;
  dateFormat: 'iso' | 'us' | 'eu';
  numberFormat: 'standard' | 'accounting';
  selectedColumns?: string[];
}

interface EnhancedExportControlsProps {
  campaigns: CampaignData[];
  totalCount: number;
  filteredCount: number;
  onExport: (config: ExportConfiguration) => Promise<void>;
  isExporting: boolean;
  exportProgress: ExportProgress;
  exportEnabled?: boolean;
  showAdvancedOptions?: boolean;
  selectedCampaigns?: string[];
  className?: string;
}

const EXPORT_FORMATS = [
  { value: 'csv' as ExportFormat, label: 'CSV', icon: TableCellsIcon, description: 'Comma-separated values' },
  { value: 'excel' as ExportFormat, label: 'Excel', icon: DocumentIcon, description: 'Microsoft Excel format' },
  { value: 'json' as ExportFormat, label: 'JSON', icon: DocumentArrowDownIcon, description: 'JavaScript Object Notation' },
  { value: 'pdf' as ExportFormat, label: 'PDF', icon: DocumentIcon, description: 'Portable Document Format' }
];

const EXPORT_SCOPES = [
  { value: 'all' as ExportScope, label: 'All Data', description: 'Export all campaigns in database' },
  { value: 'filtered' as ExportScope, label: 'Filtered Results', description: 'Export currently filtered campaigns' },
  { value: 'visible' as ExportScope, label: 'Current Page', description: 'Export campaigns on current page' },
  { value: 'selected' as ExportScope, label: 'Selected Rows', description: 'Export manually selected campaigns' }
];

const COLUMN_OPTIONS = [
  { key: 'name', label: 'Campaign Name', enabled: true },
  { key: 'status', label: 'Status', enabled: true },
  { key: 'type', label: 'Type', enabled: true },
  { key: 'budget', label: 'Budget', enabled: true },
  { key: 'spend', label: 'Spend', enabled: true },
  { key: 'impressions', label: 'Impressions', enabled: true },
  { key: 'clicks', label: 'Clicks', enabled: true },
  { key: 'ctr', label: 'CTR', enabled: true },
  { key: 'cpc', label: 'CPC', enabled: false },
  { key: 'conversions', label: 'Conversions', enabled: true },
  { key: 'conversionRate', label: 'Conversion Rate', enabled: false },
  { key: 'roas', label: 'ROAS', enabled: true },
  { key: 'lastModified', label: 'Last Modified', enabled: false }
];

export function EnhancedExportControls({
  campaigns,
  totalCount,
  filteredCount,
  onExport,
  isExporting,
  exportProgress,
  exportEnabled = true,
  showAdvancedOptions = true,
  selectedCampaigns = [],
  className = ''
}: EnhancedExportControlsProps) {

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfiguration>({
    format: 'csv',
    scope: 'filtered',
    includeHeaders: true,
    includeMetadata: false,
    dateFormat: 'iso',
    numberFormat: 'standard',
    selectedColumns: COLUMN_OPTIONS.filter(col => col.enabled).map(col => col.key)
  });

  // Calculate export count based on scope
  const getExportCount = useCallback(() => {
    switch (exportConfig.scope) {
      case 'all':
        return totalCount;
      case 'filtered':
        return filteredCount;
      case 'visible':
        return campaigns.length;
      case 'selected':
        return selectedCampaigns.length;
      default:
        return 0;
    }
  }, [exportConfig.scope, totalCount, filteredCount, campaigns.length, selectedCampaigns.length]);

  // Handle export initiation
  const handleExport = async () => {
    try {
      await onExport(exportConfig);
      setShowExportPanel(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Handle column selection
  const handleColumnToggle = (columnKey: string) => {
    setExportConfig(prev => ({
      ...prev,
      selectedColumns: prev.selectedColumns?.includes(columnKey)
        ? prev.selectedColumns.filter(key => key !== columnKey)
        : [...(prev.selectedColumns || []), columnKey]
    }));
  };

  // Get scope availability
  const getScopeAvailability = (scope: ExportScope) => {
    switch (scope) {
      case 'all':
        return totalCount > 0;
      case 'filtered':
        return filteredCount > 0;
      case 'visible':
        return campaigns.length > 0;
      case 'selected':
        return selectedCampaigns.length > 0;
      default:
        return false;
    }
  };

  if (!exportEnabled) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Export Button */}
      {!showExportPanel && (
        <div className="p-4">
          <button
            onClick={() => setShowExportPanel(true)}
            disabled={isExporting || filteredCount === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DocumentArrowDownIcon />
            <span className="ml-2">Export Data</span>
            {filteredCount > 0 && (
              <span className="ml-1 text-indigo-200">({filteredCount.toLocaleString()})</span>
            )}
          </button>
        </div>
      )}

      {/* Export Panel */}
      {showExportPanel && (
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DocumentArrowDownIcon />
              <h3 className="text-lg font-medium text-gray-900">Export Campaigns</h3>
            </div>
            <button
              onClick={() => setShowExportPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Export Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {EXPORT_FORMATS.map(format => (
                <button
                  key={format.value}
                  onClick={() => setExportConfig(prev => ({ ...prev, format: format.value }))}
                  className={`flex items-center p-3 border rounded-md text-sm transition-colors ${
                    exportConfig.format === format.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <format.icon />
                  <div className="ml-2 text-left">
                    <div className="font-medium">{format.label}</div>
                    <div className="text-xs text-gray-500">{format.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Scope Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data to Export</label>
            <div className="space-y-2">
              {EXPORT_SCOPES.map(scope => {
                const isAvailable = getScopeAvailability(scope.value);
                const count = scope.value === 'all' ? totalCount :
                             scope.value === 'filtered' ? filteredCount :
                             scope.value === 'visible' ? campaigns.length :
                             selectedCampaigns.length;

                return (
                  <label
                    key={scope.value}
                    className={`flex items-center p-2 border rounded cursor-pointer transition-colors ${
                      exportConfig.scope === scope.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : isAvailable
                        ? 'border-gray-300 hover:bg-gray-50'
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      value={scope.value}
                      checked={exportConfig.scope === scope.value}
                      onChange={(e) => setExportConfig(prev => ({ ...prev, scope: e.target.value as ExportScope }))}
                      disabled={!isAvailable}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{scope.label}</span>
                        <span className="text-sm text-gray-500">
                          {isAvailable ? `${count.toLocaleString()} records` : 'No data'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{scope.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
              
              {/* Basic Options */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeHeaders}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeHeaders: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Headers</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeMetadata}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include Metadata</span>
                </label>
              </div>

              {/* Format Options */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                  <select
                    value={exportConfig.dateFormat}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, dateFormat: e.target.value as any }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="iso">ISO 8601 (2024-01-15)</option>
                    <option value="us">US Format (01/15/2024)</option>
                    <option value="eu">EU Format (15/01/2024)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number Format</label>
                  <select
                    value={exportConfig.numberFormat}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, numberFormat: e.target.value as any }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="standard">Standard (1234.56)</option>
                    <option value="accounting">Accounting ($1,234.56)</option>
                  </select>
                </div>
              </div>

              {/* Column Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Columns to Include
                  <span className="ml-1 text-xs text-gray-500">
                    ({exportConfig.selectedColumns?.length || 0} selected)
                  </span>
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {COLUMN_OPTIONS.map(column => (
                    <label key={column.key} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={exportConfig.selectedColumns?.includes(column.key) || false}
                        onChange={() => handleColumnToggle(column.key)}
                        className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-gray-700">{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Export Summary */}
          <div className="bg-gray-50 rounded-md p-3">
            <div className="text-sm text-gray-700">
              <div className="flex justify-between items-center">
                <span>Export Summary:</span>
                <span className="font-medium">
                  {getExportCount().toLocaleString()} records as {exportConfig.format.toUpperCase()}
                </span>
              </div>
              {exportConfig.selectedColumns && (
                <div className="text-xs text-gray-500 mt-1">
                  {exportConfig.selectedColumns.length} columns selected
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowExportPanel(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || getExportCount() === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <CloudArrowDownIcon />
                  <span className="ml-2">Start Export</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Export Progress */}
      {(isExporting || exportProgress.status !== 'idle') && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {exportProgress.status === 'complete' ? (
                <CheckCircleIcon />
              ) : exportProgress.status === 'error' ? (
                <ExclamationTriangleIcon />
              ) : (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              )}
              <span className="text-sm font-medium text-gray-900">
                {exportProgress.status === 'complete' ? 'Export Complete' :
                 exportProgress.status === 'error' ? 'Export Failed' :
                 'Exporting...'}
              </span>
            </div>
            <span className="text-sm text-gray-500">{exportProgress.progress}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                exportProgress.status === 'error' ? 'bg-red-600' :
                exportProgress.status === 'complete' ? 'bg-green-600' :
                'bg-indigo-600'
              }`}
              style={{ width: `${exportProgress.progress}%` }}
            />
          </div>
          
          <div className="mt-2 text-xs text-gray-600">
            {exportProgress.message}
            {exportProgress.recordCount && (
              <span className="ml-2">({exportProgress.recordCount.toLocaleString()} records)</span>
            )}
          </div>
          
          {exportProgress.status === 'complete' && exportProgress.downloadUrl && (
            <div className="mt-3">
              <a
                href={exportProgress.downloadUrl}
                download={exportProgress.filename}
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
              >
                <CloudArrowDownIcon />
                <span className="ml-1">Download {exportProgress.filename}</span>
                {exportProgress.fileSize && (
                  <span className="ml-1 text-gray-500">
                    ({(exportProgress.fileSize / 1024).toFixed(1)} KB)
                  </span>
                )}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}