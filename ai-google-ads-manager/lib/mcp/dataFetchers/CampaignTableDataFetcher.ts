/**
 * Campaign Table Data Fetcher
 * 
 * Specialized data fetching for campaign table with MCP integration,
 * feature flag control, advanced filtering, sorting, pagination, and export capabilities.
 */

import { MCPClient } from '../client';
import { featureFlagManager } from '@/lib/featureFlags/FeatureFlagManager';

export interface CampaignData {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'VIDEO' | 'APP' | 'PERFORMANCE_MAX';
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionRate: number;
  roas: number;
  startDate: string;
  endDate?: string;
  lastModified: string;
}

export interface CampaignTableFilters {
  search?: string;
  status?: string[];
  type?: string[];
  budgetRange?: { min: number; max: number };
  spendRange?: { min: number; max: number };
  dateRange?: { startDate: string; endDate: string };
}

export interface CampaignTableSorting {
  column: keyof CampaignData;
  direction: 'asc' | 'desc';
}

export interface CampaignTablePagination {
  page: number;
  pageSize: number;
}

export interface CampaignTableOptions {
  filters?: CampaignTableFilters;
  sorting?: CampaignTableSorting;
  pagination?: CampaignTablePagination;
  forceRefresh?: boolean;
  userId?: string;
  userRole?: string;
  propertyId?: string;
}

export interface CampaignTableData {
  campaigns: CampaignData[];
  totalCount: number;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  loading: boolean;
  error?: string;
  lastUpdated?: Date;
  source: 'mcp' | 'mock' | 'cache';
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Data fetcher for campaign table with advanced functionality
 */
export class CampaignTableDataFetcher {
  private mcpClient: MCPClient;
  private cache: Map<string, { data: CampaignTableData; timestamp: number; ttl: number }> = new Map();
  private cacheTtl: number = 300000; // 5 minutes

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Fetch campaign table data with advanced features
   */
  async fetchCampaigns(options: CampaignTableOptions = {}): Promise<CampaignTableData> {
    const {
      filters = {},
      sorting = { column: 'name', direction: 'asc' },
      pagination = { page: 1, pageSize: 25 },
      forceRefresh = false,
      userId,
      userRole,
      propertyId
    } = options;

    const cacheKey = `campaigns-${JSON.stringify({ filters, sorting, pagination, propertyId })}`;

    // Check cache first
    if (!forceRefresh) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Check feature flags
      const isMCPEnabled = await featureFlagManager.isEnabled('campaign_table_migration_enabled', {
        userId,
        userRole
      });

      const isFallbackEnabled = await featureFlagManager.isEnabled('campaign_table_fallback_enabled', {
        userId,
        userRole
      });

      let result: CampaignTableData;

      if (isMCPEnabled) {
        try {
          result = await this.fetchFromMCP(options);
        } catch (error) {
          console.warn('MCP fetch failed for campaigns:', error);
          if (isFallbackEnabled) {
            result = this.getFallbackData(options);
            result.error = `MCP fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          } else {
            throw error;
          }
        }
      } else {
        result = this.getFallbackData(options);
      }

      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;

    } catch (error) {
      const fallbackEnabled = await featureFlagManager.isEnabled('campaign_table_fallback_enabled', {
        userId,
        userRole
      });

      if (fallbackEnabled) {
        const fallbackResult = this.getFallbackData(options);
        fallbackResult.error = `Failed to fetch campaign data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        return fallbackResult;
      }

      throw error;
    }
  }

  /**
   * Fetch campaigns from MCP
   */
  private async fetchFromMCP(options: CampaignTableOptions): Promise<CampaignTableData> {
    const { filters, sorting, pagination, propertyId } = options;

    // Build MCP request parameters
    const mcpParams: any = {
      propertyId,
      includeMetrics: true,
      includeSegments: true
    };

    // Add filtering parameters
    if (filters?.search) {
      mcpParams.searchQuery = filters.search;
    }
    if (filters?.status?.length) {
      mcpParams.statusFilter = filters.status;
    }
    if (filters?.type?.length) {
      mcpParams.typeFilter = filters.type;
    }
    if (filters?.dateRange) {
      mcpParams.dateRange = filters.dateRange;
    }
    if (filters?.budgetRange) {
      mcpParams.budgetRange = filters.budgetRange;
    }
    if (filters?.spendRange) {
      mcpParams.spendRange = filters.spendRange;
    }

    // Add sorting parameters
    if (sorting) {
      mcpParams.sortBy = sorting.column;
      mcpParams.sortDirection = sorting.direction;
    }

    // Add pagination parameters
    if (pagination) {
      mcpParams.page = pagination.page;
      mcpParams.pageSize = pagination.pageSize;
    }

    // Execute MCP request
    const response = await this.mcpClient.callTool('google-ads-get-campaigns-advanced', mcpParams);

    // Transform MCP response to table format
    const campaigns: CampaignData[] = response.campaigns?.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      type: campaign.campaignType || campaign.type,
      budget: campaign.budget?.amountMicros ? campaign.budget.amountMicros / 1000000 : 0,
      spend: campaign.metrics?.cost ? campaign.metrics.cost / 1000000 : 0,
      impressions: campaign.metrics?.impressions || 0,
      clicks: campaign.metrics?.clicks || 0,
      ctr: campaign.metrics?.ctr || 0,
      cpc: campaign.metrics?.averageCpc ? campaign.metrics.averageCpc / 1000000 : 0,
      conversions: campaign.metrics?.conversions || 0,
      conversionRate: campaign.metrics?.conversionRate || 0,
      roas: campaign.metrics?.returnOnAdSpend || 0,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      lastModified: campaign.lastModified || new Date().toISOString()
    })) || [];

    const totalCount = response.totalCount || campaigns.length;
    const currentPage = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 25;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      campaigns,
      totalCount,
      filteredCount: response.filteredCount || totalCount,
      currentPage,
      totalPages,
      pageSize,
      loading: false,
      source: 'mcp',
      lastUpdated: new Date(),
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    };
  }

  /**
   * Get fallback mock data
   */
  private getFallbackData(options: CampaignTableOptions): CampaignTableData {
    const { filters, sorting, pagination } = options;

    // Mock campaign data
    let mockCampaigns: CampaignData[] = [
      {
        id: '1',
        name: 'Summer Sale Search Campaign',
        status: 'ENABLED',
        type: 'SEARCH',
        budget: 1000,
        spend: 856.23,
        impressions: 12450,
        clicks: 1240,
        ctr: 9.96,
        cpc: 0.69,
        conversions: 124,
        conversionRate: 10.0,
        roas: 4.2,
        startDate: '2024-06-01',
        lastModified: '2024-08-05T10:30:00Z'
      },
      {
        id: '2',
        name: 'Brand Awareness Display',
        status: 'ENABLED',
        type: 'DISPLAY',
        budget: 500,
        spend: 423.67,
        impressions: 45600,
        clicks: 456,
        ctr: 1.0,
        cpc: 0.93,
        conversions: 23,
        conversionRate: 5.04,
        roas: 2.8,
        startDate: '2024-07-01',
        lastModified: '2024-08-04T15:20:00Z'
      },
      {
        id: '3',
        name: 'Product Shopping Campaign',
        status: 'ENABLED',
        type: 'SHOPPING',
        budget: 1500,
        spend: 1234.56,
        impressions: 8900,
        clicks: 890,
        ctr: 10.0,
        cpc: 1.39,
        conversions: 89,
        conversionRate: 10.0,
        roas: 6.1,
        startDate: '2024-05-15',
        lastModified: '2024-08-05T09:15:00Z'
      },
      {
        id: '4',
        name: 'Video Advertising Campaign',
        status: 'PAUSED',
        type: 'VIDEO',
        budget: 750,
        spend: 345.78,
        impressions: 23400,
        clicks: 234,
        ctr: 1.0,
        cpc: 1.48,
        conversions: 12,
        conversionRate: 5.13,
        roas: 1.9,
        startDate: '2024-07-15',
        endDate: '2024-07-31',
        lastModified: '2024-08-01T12:00:00Z'
      },
      {
        id: '5',
        name: 'Mobile App Install Campaign',
        status: 'ENABLED',
        type: 'APP',
        budget: 2000,
        spend: 1567.89,
        impressions: 34500,
        clicks: 1725,
        ctr: 5.0,
        cpc: 0.91,
        conversions: 172,
        conversionRate: 9.97,
        roas: 3.5,
        startDate: '2024-06-10',
        lastModified: '2024-08-05T14:45:00Z'
      }
    ];

    // Apply filters
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      mockCampaigns = mockCampaigns.filter(campaign =>
        campaign.name.toLowerCase().includes(searchTerm)
      );
    }

    if (filters?.status?.length) {
      mockCampaigns = mockCampaigns.filter(campaign =>
        filters.status!.includes(campaign.status)
      );
    }

    if (filters?.type?.length) {
      mockCampaigns = mockCampaigns.filter(campaign =>
        filters.type!.includes(campaign.type)
      );
    }

    // Apply sorting
    if (sorting) {
      mockCampaigns.sort((a, b) => {
        const aVal = a[sorting.column];
        const bVal = b[sorting.column];
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sorting.direction === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sorting.direction === 'asc' 
            ? aVal - bVal
            : bVal - aVal;
        }
        
        return 0;
      });
    }

    const totalCount = mockCampaigns.length;
    const pageSize = pagination?.pageSize || 25;
    const currentPage = pagination?.page || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCampaigns = mockCampaigns.slice(startIndex, endIndex);
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      campaigns: paginatedCampaigns,
      totalCount: 5, // Original mock data count
      filteredCount: totalCount,
      currentPage,
      totalPages,
      pageSize,
      loading: false,
      source: 'mock',
      lastUpdated: new Date(),
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    };
  }

  /**
   * Export campaign data with enhanced configuration support
   */
  async exportCampaigns(
    options: CampaignTableOptions,
    format: 'csv' | 'excel' = 'csv'
  ): Promise<string> {
    // Get all data (no pagination for export)
    const exportOptions = {
      ...options,
      pagination: { page: 1, pageSize: 10000 } // Large page size for export
    };

    const data = await this.fetchCampaigns(exportOptions);
    
    if (format === 'csv') {
      return this.convertToCSV(data.campaigns);
    }
    
    // Excel export would require additional library
    throw new Error('Excel export not yet implemented');
  }

  /**
   * Enhanced export with configuration support
   */
  async exportCampaignsEnhanced(
    options: CampaignTableOptions,
    exportConfig: {
      format: 'csv' | 'excel' | 'json' | 'pdf';
      scope: 'all' | 'filtered' | 'visible' | 'selected';
      includeHeaders: boolean;
      includeMetadata: boolean;
      dateFormat: 'iso' | 'us' | 'eu';
      numberFormat: 'standard' | 'accounting';
      selectedColumns?: string[];
      selectedCampaigns?: CampaignData[];
      onProgress?: (progress: number, message: string) => void;
    }
  ): Promise<{ data: string; filename: string; mimeType: string; recordCount: number }> {
    
    const { onProgress } = exportConfig;
    
    // Step 1: Fetch data based on scope
    onProgress?.(10, 'Fetching campaign data...');
    
    let campaigns: CampaignData[];
    let filename: string;
    
    if (exportConfig.scope === 'selected' && exportConfig.selectedCampaigns) {
      campaigns = exportConfig.selectedCampaigns;
      filename = `selected-campaigns-${Date.now()}`;
    } else {
      const exportOptions = {
        ...options,
        pagination: { page: 1, pageSize: exportConfig.scope === 'all' ? 50000 : 10000 }
      };
      
      const data = await this.fetchCampaigns(exportOptions);
      campaigns = data.campaigns;
      filename = `campaigns-${exportConfig.scope}-${Date.now()}`;
    }
    
    onProgress?.(30, 'Processing campaign data...');
    
    // Step 2: Filter columns if specified
    if (exportConfig.selectedColumns && exportConfig.selectedColumns.length > 0) {
      campaigns = campaigns.map(campaign => {
        const filtered: any = {};
        exportConfig.selectedColumns!.forEach(column => {
          if (column in campaign) {
            filtered[column] = (campaign as any)[column];
          }
        });
        return filtered as CampaignData;
      });
    }
    
    onProgress?.(50, 'Formatting data...');
    
    // Step 3: Format and export based on format
    let data: string;
    let mimeType: string;
    let extension: string;
    
    switch (exportConfig.format) {
      case 'csv':
        data = this.convertToCSVEnhanced(campaigns, exportConfig);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
        
      case 'json':
        data = this.convertToJSONEnhanced(campaigns, exportConfig);
        mimeType = 'application/json';
        extension = 'json';
        break;
        
      case 'excel':
        onProgress?.(60, 'Generating Excel file...');
        data = this.convertToExcelEnhanced(campaigns, exportConfig);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
        
      case 'pdf':
        onProgress?.(70, 'Generating PDF file...');
        data = this.convertToPDFEnhanced(campaigns, exportConfig);
        mimeType = 'application/pdf';
        extension = 'pdf';
        break;
        
      default:
        throw new Error(`Unsupported export format: ${exportConfig.format}`);
    }
    
    onProgress?.(100, 'Export complete!');
    
    return {
      data,
      filename: `${filename}.${extension}`,
      mimeType,
      recordCount: campaigns.length
    };
  }

  /**
   * Convert campaigns to CSV format
   */
  private convertToCSV(campaigns: CampaignData[]): string {
    const headers = [
      'ID', 'Name', 'Status', 'Type', 'Budget', 'Spend', 
      'Impressions', 'Clicks', 'CTR (%)', 'CPC', 'Conversions', 
      'Conversion Rate (%)', 'ROAS', 'Start Date', 'End Date', 'Last Modified'
    ];

    const rows = campaigns.map(campaign => [
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.type,
      campaign.budget.toFixed(2),
      campaign.spend.toFixed(2),
      campaign.impressions,
      campaign.clicks,
      (campaign.ctr * 100).toFixed(2),
      campaign.cpc.toFixed(2),
      campaign.conversions,
      (campaign.conversionRate * 100).toFixed(2),
      campaign.roas.toFixed(1),
      campaign.startDate,
      campaign.endDate || '',
      campaign.lastModified
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Enhanced CSV conversion with configuration support
   */
  private convertToCSVEnhanced(campaigns: CampaignData[], config: any): string {
    // Build headers based on selected columns or all columns
    const allColumns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Campaign Name' },
      { key: 'status', label: 'Status' },
      { key: 'type', label: 'Type' },
      { key: 'budget', label: 'Budget' },
      { key: 'spend', label: 'Spend' },
      { key: 'impressions', label: 'Impressions' },
      { key: 'clicks', label: 'Clicks' },
      { key: 'ctr', label: 'CTR (%)' },
      { key: 'cpc', label: 'CPC' },
      { key: 'conversions', label: 'Conversions' },
      { key: 'conversionRate', label: 'Conversion Rate (%)' },
      { key: 'roas', label: 'ROAS' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'lastModified', label: 'Last Modified' }
    ];

    const selectedColumns = config.selectedColumns 
      ? allColumns.filter(col => config.selectedColumns.includes(col.key))
      : allColumns;

    const result: string[] = [];

    // Add metadata if requested
    if (config.includeMetadata) {
      result.push(`# Export Generated: ${new Date().toISOString()}`);
      result.push(`# Format: CSV`);
      result.push(`# Records: ${campaigns.length}`);
      result.push(`# Columns: ${selectedColumns.length}`);
      result.push('');
    }

    // Add headers if requested
    if (config.includeHeaders) {
      result.push(selectedColumns.map(col => `"${col.label}"`).join(','));
    }

    // Add data rows
    campaigns.forEach(campaign => {
      const row = selectedColumns.map(col => {
        const value = (campaign as any)[col.key];
        return this.formatCellValue(value, col.key, config);
      });
      result.push(row.map(cell => `"${cell}"`).join(','));
    });

    return result.join('\n');
  }

  /**
   * Convert campaigns to JSON format
   */
  private convertToJSONEnhanced(campaigns: CampaignData[], config: any): string {
    const exportData: any = {
      campaigns: campaigns.map(campaign => {
        if (config.selectedColumns && config.selectedColumns.length > 0) {
          const filtered: any = {};
          config.selectedColumns.forEach((column: string) => {
            if (column in campaign) {
              filtered[column] = this.formatCellValue((campaign as any)[column], column, config);
            }
          });
          return filtered;
        }
        return campaign;
      })
    };

    if (config.includeMetadata) {
      exportData.metadata = {
        exportedAt: new Date().toISOString(),
        format: 'JSON',
        recordCount: campaigns.length,
        columns: config.selectedColumns || Object.keys(campaigns[0] || {}),
        configuration: {
          dateFormat: config.dateFormat,
          numberFormat: config.numberFormat,
          includeHeaders: config.includeHeaders
        }
      };
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Convert campaigns to Excel format (Basic implementation)
   */
  private convertToExcelEnhanced(campaigns: CampaignData[], config: any): string {
    // For now, return CSV format with Excel-specific formatting
    // In a real implementation, you would use a library like xlsx or exceljs
    const csvData = this.convertToCSVEnhanced(campaigns, config);
    
    // Add Excel-specific metadata
    if (config.includeMetadata) {
      return `sep=,\n${csvData}`;
    }
    
    return csvData;
  }

  /**
   * Convert campaigns to PDF format (Basic implementation)
   */
  private convertToPDFEnhanced(campaigns: CampaignData[], config: any): string {
    // For now, return a simple text format
    // In a real implementation, you would use a library like jsPDF or PDFKit
    const lines: string[] = [];
    
    if (config.includeMetadata) {
      lines.push('CAMPAIGN EXPORT REPORT');
      lines.push('='.repeat(50));
      lines.push(`Generated: ${new Date().toLocaleString()}`);
      lines.push(`Records: ${campaigns.length}`);
      lines.push('');
    }

    // Add table header
    const allColumns = [
      { key: 'name', label: 'Campaign Name' },
      { key: 'status', label: 'Status' },
      { key: 'type', label: 'Type' },
      { key: 'budget', label: 'Budget' },
      { key: 'spend', label: 'Spend' },
      { key: 'roas', label: 'ROAS' }
    ];

    const selectedColumns = config.selectedColumns 
      ? allColumns.filter(col => config.selectedColumns.includes(col.key))
      : allColumns.slice(0, 6); // Limit for PDF readability

    if (config.includeHeaders) {
      lines.push(selectedColumns.map(col => col.label.padEnd(15)).join(' | '));
      lines.push('-'.repeat(selectedColumns.length * 18));
    }

    // Add data rows
    campaigns.forEach(campaign => {
      const row = selectedColumns.map(col => {
        const value = this.formatCellValue((campaign as any)[col.key], col.key, config);
        return String(value).padEnd(15).substring(0, 15);
      });
      lines.push(row.join(' | '));
    });

    return lines.join('\n');
  }

  /**
   * Format cell values based on configuration
   */
  private formatCellValue(value: any, columnKey: string, config: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Date formatting
    if (columnKey.includes('Date') || columnKey === 'lastModified') {
      const date = new Date(value);
      switch (config.dateFormat) {
        case 'us':
          return date.toLocaleDateString('en-US');
        case 'eu':
          return date.toLocaleDateString('en-GB');
        default:
          return date.toISOString().split('T')[0];
      }
    }

    // Number formatting
    if (typeof value === 'number') {
      if (config.numberFormat === 'accounting') {
        if (columnKey === 'budget' || columnKey === 'spend' || columnKey === 'cpc') {
          return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return value.toLocaleString('en-US');
      } else {
        // Standard formatting
        if (columnKey === 'ctr' || columnKey === 'conversionRate') {
          return (value * 100).toFixed(2);
        }
        if (columnKey === 'budget' || columnKey === 'spend' || columnKey === 'cpc') {
          return value.toFixed(2);
        }
        if (columnKey === 'roas') {
          return value.toFixed(1);
        }
        return value.toString();
      }
    }

    return String(value);
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): CampaignTableData | null {
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return {
        ...entry.data,
        source: 'cache'
      };
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  private setCache(key: string, data: CampaignTableData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTtl
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}