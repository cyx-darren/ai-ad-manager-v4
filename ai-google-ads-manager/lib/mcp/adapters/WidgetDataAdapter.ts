/**
 * Widget Data Adapter
 * 
 * Specialized adapters for converting MCP responses to widget component data formats.
 * Supports TrafficOverviewWidget, ConversionWidget, and other dashboard widgets.
 */

import { BaseAdapter } from './BaseAdapter';
import { 
  AdapterConfig,
  AdapterMetadata,
  MCPResponse
} from './types';
import { 
  normalizeDateString, 
  mapFields, 
  computeMetrics, 
  coerceToNumber,
  handleNullValue,
  calculatePercentages,
  GA4_TO_COMPONENT_MAPPING
} from './utils';

// ============================================================================
// WIDGET DATA TYPES
// ============================================================================

/**
 * Traffic Overview Widget Data
 */
export interface TrafficOverviewData {
  totalSessions: number;
  totalPageviews: number;
  averageSessionDuration: number;
  bounceRate: number;
  newUsers: number;
  returningUsers: number;
  change: {
    sessions: number;
    pageviews: number;
    duration: number;
    bounceRate: number;
  };
  trend: 'up' | 'down' | 'stable';
  topPages: Array<{
    page: string;
    pageviews: number;
    sessions: number;
  }>;
}

/**
 * Conversion Widget Data  
 */
export interface ConversionData {
  totalConversions: number;
  conversionRate: number;
  conversionValue: number;
  goals: Array<{
    name: string;
    conversions: number;
    value: number;
    rate: number;
  }>;
  ecommerce: {
    transactions: number;
    revenue: number;
    averageOrderValue: number;
    itemsSold: number;
  };
  change: {
    conversions: number;
    rate: number;
    value: number;
  };
  topConvertingPages: Array<{
    page: string;
    conversions: number;
    rate: number;
  }>;
}

/**
 * Traffic Source Widget Data
 */
export interface TrafficSourceData {
  sources: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
    percentage: number;
    bounceRate: number;
    conversions: number;
  }>;
  totalSessions: number;
  organicTraffic: number;
  directTraffic: number;
  referralTraffic: number;
  socialTraffic: number;
  paidTraffic: number;
}

/**
 * Performance Metrics Widget Data
 */
export interface PerformanceMetricsData {
  pageLoadTime: number;
  timeToInteractive: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  coreWebVitals: {
    good: number;
    needsImprovement: number;
    poor: number;
  };
  slowestPages: Array<{
    page: string;
    loadTime: number;
    score: number;
  }>;
}

/**
 * Generic MCP input for widgets
 */
export interface WidgetInputData {
  data: Array<{
    [key: string]: any;
  }>;
  summary?: {
    [key: string]: any;
  };
  metadata?: {
    dateRange?: {
      startDate: string;
      endDate: string;
    };
    [key: string]: any;
  };
}

// ============================================================================
// TRAFFIC OVERVIEW WIDGET ADAPTER
// ============================================================================

/**
 * Adapter for TrafficOverviewWidget component
 */
export class TrafficOverviewAdapter extends BaseAdapter<WidgetInputData, TrafficOverviewData> {
  
  protected transformImplementation(input: WidgetInputData): TrafficOverviewData {
    const data = input.data || [];
    const summary = input.summary || {};
    
    // Extract core metrics
    const totalSessions = this.extractMetric(data, summary, ['sessions', 'totalSessions'], 0);
    const totalPageviews = this.extractMetric(data, summary, ['pageviews', 'screenPageViews', 'totalPageviews'], 0);
    const avgSessionDuration = this.extractMetric(data, summary, ['averageSessionDuration', 'sessionDuration'], 0);
    const bounceRate = this.extractMetric(data, summary, ['bounceRate'], 0);
    const newUsers = this.extractMetric(data, summary, ['newUsers'], 0);
    const returningUsers = this.extractMetric(data, summary, ['returningUsers'], 0);
    
    // Extract change metrics
    const change = {
      sessions: this.extractMetric(data, summary, ['sessionsChange', 'change.sessions'], 0),
      pageviews: this.extractMetric(data, summary, ['pageviewsChange', 'change.pageviews'], 0),
      duration: this.extractMetric(data, summary, ['durationChange', 'change.duration'], 0),
      bounceRate: this.extractMetric(data, summary, ['bounceRateChange', 'change.bounceRate'], 0)
    };
    
    // Determine overall trend
    const trend = this.calculateTrend([change.sessions, change.pageviews]);
    
    // Extract top pages
    const topPages = this.extractTopPages(data);
    
    return {
      totalSessions,
      totalPageviews,
      averageSessionDuration: avgSessionDuration,
      bounceRate,
      newUsers,
      returningUsers,
      change,
      trend,
      topPages
    };
  }

  private extractMetric(data: any[], summary: any, keys: string[], defaultValue: number): number {
    // Try summary first
    for (const key of keys) {
      if (summary[key] !== undefined) {
        return coerceToNumber(summary[key]) as number || defaultValue;
      }
    }
    
    // Try data array
    for (const item of data) {
      for (const key of keys) {
        if (item[key] !== undefined) {
          return coerceToNumber(item[key]) as number || defaultValue;
        }
      }
    }
    
    return defaultValue;
  }

  private calculateTrend(changes: number[]): 'up' | 'down' | 'stable' {
    const positiveChanges = changes.filter(c => c > 0).length;
    const negativeChanges = changes.filter(c => c < 0).length;
    
    if (positiveChanges > negativeChanges) return 'up';
    if (negativeChanges > positiveChanges) return 'down';
    return 'stable';
  }

  private extractTopPages(data: any[]): Array<{page: string; pageviews: number; sessions: number}> {
    return data
      .filter(item => item.page || item.pagePath || item.pageTitle)
      .map(item => ({
        page: item.page || item.pagePath || item.pageTitle || 'Unknown',
        pageviews: coerceToNumber(item.pageviews || item.screenPageViews || 0) as number,
        sessions: coerceToNumber(item.sessions || 0) as number
      }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10);
  }

  public validate(input: WidgetInputData): boolean {
    return input && (Array.isArray(input.data) || typeof input.summary === 'object');
  }

  public getDefaultOutput(): TrafficOverviewData {
    return {
      totalSessions: 0,
      totalPageviews: 0,
      averageSessionDuration: 0,
      bounceRate: 0,
      newUsers: 0,
      returningUsers: 0,
      change: {
        sessions: 0,
        pageviews: 0,
        duration: 0,
        bounceRate: 0
      },
      trend: 'stable',
      topPages: []
    };
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'TrafficOverviewAdapter',
      version: '1.0.0',
      inputType: 'WidgetInputData',
      outputType: 'TrafficOverviewData',
      description: 'Converts MCP analytics data to traffic overview widget format',
      supportsTimeRange: true,
      supportsAggregation: true
    };
  }
}

// ============================================================================
// CONVERSION WIDGET ADAPTER
// ============================================================================

/**
 * Adapter for ConversionWidget component
 */
export class ConversionAdapter extends BaseAdapter<WidgetInputData, ConversionData> {

  protected transformImplementation(input: WidgetInputData): ConversionData {
    const data = input.data || [];
    const summary = input.summary || {};
    
    // Extract core conversion metrics
    const totalConversions = this.extractMetric(data, summary, ['conversions', 'totalConversions'], 0);
    const conversionRate = this.extractMetric(data, summary, ['conversionRate'], 0);
    const conversionValue = this.extractMetric(data, summary, ['conversionValue', 'totalConversionValue'], 0);
    
    // Extract goals
    const goals = this.extractGoals(data);
    
    // Extract ecommerce data
    const ecommerce = this.extractEcommerceData(data, summary);
    
    // Extract change metrics
    const change = {
      conversions: this.extractMetric(data, summary, ['conversionsChange', 'change.conversions'], 0),
      rate: this.extractMetric(data, summary, ['conversionRateChange', 'change.rate'], 0),
      value: this.extractMetric(data, summary, ['conversionValueChange', 'change.value'], 0)
    };
    
    // Extract top converting pages
    const topConvertingPages = this.extractTopConvertingPages(data);
    
    return {
      totalConversions,
      conversionRate,
      conversionValue,
      goals,
      ecommerce,
      change,
      topConvertingPages
    };
  }

  private extractMetric(data: any[], summary: any, keys: string[], defaultValue: number): number {
    // Same implementation as TrafficOverviewAdapter
    for (const key of keys) {
      if (summary[key] !== undefined) {
        return coerceToNumber(summary[key]) as number || defaultValue;
      }
    }
    
    for (const item of data) {
      for (const key of keys) {
        if (item[key] !== undefined) {
          return coerceToNumber(item[key]) as number || defaultValue;
        }
      }
    }
    
    return defaultValue;
  }

  private extractGoals(data: any[]): Array<{name: string; conversions: number; value: number; rate: number}> {
    return data
      .filter(item => item.goalName || item.eventName)
      .map(item => {
        const conversions = coerceToNumber(item.conversions || item.eventCount || 0) as number;
        const value = coerceToNumber(item.conversionValue || item.eventValue || 0) as number;
        const sessions = coerceToNumber(item.sessions || 1) as number;
        
        return {
          name: item.goalName || item.eventName || 'Unknown Goal',
          conversions,
          value,
          rate: sessions > 0 ? (conversions / sessions) * 100 : 0
        };
      })
      .slice(0, 10);
  }

  private extractEcommerceData(data: any[], summary: any) {
    return {
      transactions: this.extractMetric(data, summary, ['transactions', 'purchaseEvents'], 0),
      revenue: this.extractMetric(data, summary, ['revenue', 'purchaseRevenue'], 0),
      averageOrderValue: this.extractMetric(data, summary, ['averageOrderValue', 'aov'], 0),
      itemsSold: this.extractMetric(data, summary, ['itemsSold', 'itemQuantity'], 0)
    };
  }

  private extractTopConvertingPages(data: any[]): Array<{page: string; conversions: number; rate: number}> {
    return data
      .filter(item => (item.page || item.pagePath) && item.conversions)
      .map(item => {
        const conversions = coerceToNumber(item.conversions || 0) as number;
        const sessions = coerceToNumber(item.sessions || 1) as number;
        
        return {
          page: item.page || item.pagePath || 'Unknown',
          conversions,
          rate: sessions > 0 ? (conversions / sessions) * 100 : 0
        };
      })
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 10);
  }

  public validate(input: WidgetInputData): boolean {
    return input && (Array.isArray(input.data) || typeof input.summary === 'object');
  }

  public getDefaultOutput(): ConversionData {
    return {
      totalConversions: 0,
      conversionRate: 0,
      conversionValue: 0,
      goals: [],
      ecommerce: {
        transactions: 0,
        revenue: 0,
        averageOrderValue: 0,
        itemsSold: 0
      },
      change: {
        conversions: 0,
        rate: 0,
        value: 0
      },
      topConvertingPages: []
    };
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'ConversionAdapter',
      version: '1.0.0',
      inputType: 'WidgetInputData',
      outputType: 'ConversionData',
      description: 'Converts MCP analytics data to conversion widget format',
      supportsTimeRange: true,
      supportsAggregation: true
    };
  }
}

// ============================================================================
// TRAFFIC SOURCE WIDGET ADAPTER
// ============================================================================

/**
 * Adapter for TrafficSourceWidget component
 */
export class TrafficSourceAdapter extends BaseAdapter<WidgetInputData, TrafficSourceData> {

  protected transformImplementation(input: WidgetInputData): TrafficSourceData {
    const data = input.data || [];
    const summary = input.summary || {};
    
    // Extract source/medium data
    const sources = this.extractSources(data);
    const totalSessions = sources.reduce((sum, source) => sum + source.sessions, 0);
    
    // Calculate percentages
    sources.forEach(source => {
      source.percentage = totalSessions > 0 ? (source.sessions / totalSessions) * 100 : 0;
    });
    
    // Categorize traffic
    const organicTraffic = this.categorizeTraffic(sources, ['google', 'bing', 'yahoo'], ['organic']);
    const directTraffic = this.categorizeTraffic(sources, ['(direct)'], ['(none)', 'direct']);
    const referralTraffic = this.categorizeTraffic(sources, [], ['referral']);
    const socialTraffic = this.categorizeTraffic(sources, ['facebook', 'twitter', 'linkedin', 'instagram'], ['social']);
    const paidTraffic = this.categorizeTraffic(sources, [], ['cpc', 'cpm', 'paid']);
    
    return {
      sources: sources.slice(0, 20), // Top 20 sources
      totalSessions,
      organicTraffic,
      directTraffic,
      referralTraffic,
      socialTraffic,
      paidTraffic
    };
  }

  private extractSources(data: any[]): Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
    percentage: number;
    bounceRate: number;
    conversions: number;
  }> {
    return data
      .filter(item => item.source || item.sessionSource)
      .map(item => ({
        source: item.source || item.sessionSource || 'Unknown',
        medium: item.medium || item.sessionMedium || 'Unknown',
        sessions: coerceToNumber(item.sessions || 0) as number,
        users: coerceToNumber(item.users || item.activeUsers || 0) as number,
        percentage: 0, // Will be calculated later
        bounceRate: coerceToNumber(item.bounceRate || 0) as number,
        conversions: coerceToNumber(item.conversions || 0) as number
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }

  private categorizeTraffic(sources: any[], sourceKeywords: string[], mediumKeywords: string[]): number {
    return sources
      .filter(source => {
        const matchesSource = sourceKeywords.length === 0 || 
          sourceKeywords.some(keyword => source.source.toLowerCase().includes(keyword.toLowerCase()));
        const matchesMedium = mediumKeywords.length === 0 || 
          mediumKeywords.some(keyword => source.medium.toLowerCase().includes(keyword.toLowerCase()));
        
        return (sourceKeywords.length > 0 ? matchesSource : true) && 
               (mediumKeywords.length > 0 ? matchesMedium : true);
      })
      .reduce((sum, source) => sum + source.sessions, 0);
  }

  public validate(input: WidgetInputData): boolean {
    return input && Array.isArray(input.data);
  }

  public getDefaultOutput(): TrafficSourceData {
    return {
      sources: [],
      totalSessions: 0,
      organicTraffic: 0,
      directTraffic: 0,
      referralTraffic: 0,
      socialTraffic: 0,
      paidTraffic: 0
    };
  }

  public getMetadata(): AdapterMetadata {
    return {
      name: 'TrafficSourceAdapter',
      version: '1.0.0',
      inputType: 'WidgetInputData',
      outputType: 'TrafficSourceData',
      description: 'Converts MCP analytics data to traffic source widget format',
      supportsTimeRange: true,
      supportsAggregation: true
    };
  }
}

// ============================================================================
// WIDGET ADAPTER FACTORY HELPERS
// ============================================================================

/**
 * Widget adapter type for factory registration
 */
export type WidgetAdapterType = 'traffic-overview' | 'conversion' | 'traffic-source' | 'performance';

/**
 * Factory function for creating widget adapters by type
 */
export function createWidgetAdapter(
  type: WidgetAdapterType, 
  config?: AdapterConfig
): TrafficOverviewAdapter | ConversionAdapter | TrafficSourceAdapter {
  switch (type) {
    case 'traffic-overview':
      return new TrafficOverviewAdapter(config);
    case 'conversion':
      return new ConversionAdapter(config);
    case 'traffic-source':
      return new TrafficSourceAdapter(config);
    default:
      throw new Error(`Unknown widget adapter type: ${type}`);
  }
}