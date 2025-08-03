/**
 * Google Analytics 4 TypeScript type definitions
 */

export interface GA4Config {
  propertyId: string;
  credentials: GA4Credentials;
}

export interface GA4Credentials {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface GA4Metric {
  name: string;
  value: string | number;
}

export interface GA4Dimension {
  name: string;
  value: string;
}

export interface GA4Row {
  metrics: GA4Metric[];
  dimensions: GA4Dimension[];
}

export interface GA4Response {
  rows: GA4Row[];
  totalRows: number;
  samplesReadCounts?: string[];
  samplingSpaceSizes?: string[];
}

export interface QueryAnalyticsParams {
  metrics: string[];
  dimensions?: string[];
  startDate: string;
  endDate: string;
  limit?: number;
  orderBy?: string;
  filters?: any[];
}

export interface RealtimeDataParams {
  metrics?: string[];
  dimensions?: string[];
  limit?: number;
}

export interface TrafficSourcesParams {
  startDate: string;
  endDate: string;
  includeChannels?: boolean;
  limit?: number;
}

export interface UserDemographicsParams {
  startDate: string;
  endDate: string;
  breakdown: 'age' | 'gender' | 'location';
  limit?: number;
}

export interface PagePerformanceParams {
  startDate: string;
  endDate: string;
  orderBy?: string;
  limit?: number;
}

export interface ConversionDataParams {
  startDate: string;
  endDate: string;
  includeGoals?: boolean;
  limit?: number;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}