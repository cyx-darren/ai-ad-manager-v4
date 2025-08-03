# MCP Data Format Analysis & Interface Mapping

## Phase 1: Analysis & Interface Mapping - Complete Documentation

### Overview
This document provides comprehensive analysis of existing dashboard component interfaces and maps them to MCP response formats to identify transformation requirements for data format adapters.

## 1. EXISTING COMPONENT INTERFACES ANALYSIS

### 1.1 Chart Components

#### LineChart Component
**Interface**: `LineChartProps`
```typescript
interface TimeSeriesDataPoint {
  date: string;
  sessions?: number;
  users?: number;
  pageviews?: number;
  clicks?: number;
  impressions?: number;
  cost?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  roas?: number;
}

interface LineChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  description?: string;
  metrics: string[];          // Which metrics to display as lines
  height?: string;
  colors?: string[];
  showLegend?: boolean;
  showGridLines?: boolean;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, metric: string) => string;
  className?: string;
}
```

**Data Requirements**:
- Array of time-series data points with date string
- Flexible metrics (sessions, users, pageviews, clicks, impressions, cost, conversions)
- Computed metrics (ctr, cpc, roas)
- Optional fields for all metrics

#### BarChart Component
**Interface**: `BarChartProps`
```typescript
interface BarChartDataPoint {
  name: string;               // Campaign name, channel, device, etc.
  sessions?: number;
  users?: number;
  clicks?: number;
  impressions?: number;
  cost?: number;
  conversions?: number;
  revenue?: number;
  ctr?: number;
  cpc?: number;
  roas?: number;
  conversionRate?: number;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  title?: string;
  description?: string;
  metric: string;             // Single metric to display
  height?: string;
  color?: string;
  showDataLabels?: boolean;
  sortBy?: 'value' | 'name' | 'none';
  sortDirection?: 'asc' | 'desc';
  maxItems?: number;
  formatValue?: (value: number) => string;
  className?: string;
  layout?: 'vertical' | 'horizontal';
  maxLabelLength?: number;
  loading?: boolean;
  loadingHeight?: string;
}
```

**Data Requirements**:
- Array of categorical data points with name identifier
- Single metric focus with optional sorting
- Similar metrics to LineChart but includes revenue
- Loading state support

#### DonutChart Component
**Interface**: `DonutChartProps`
```typescript
interface DonutChartDataPoint {
  name: string;               // Source/Medium, Device, Campaign Type, etc.
  value: number;              // Sessions, users, clicks, revenue, etc.
  percentage?: number;        // Optional pre-calculated percentage
}

interface DonutChartProps {
  data: DonutChartDataPoint[];
  title?: string;
  description?: string;
  metric?: string;            // What the values represent
  height?: string;
  colors?: string[];
  showLegend?: boolean;
  showLabels?: boolean;
  showTooltip?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  formatValue?: (value: number) => string;
  formatPercentage?: (percentage: number) => string;
  className?: string;
  showAnimation?: boolean;
  centerContent?: React.ReactNode;
  loading?: boolean;
  loadingHeight?: string;
}
```

**Data Requirements**:
- Simple name/value pairs for proportional data
- Automatic percentage calculation capability
- Focus on single metric representation

### 1.2 Widget Components

#### TrafficOverviewWidget
**Interface**: `TrafficOverviewWidgetProps`
```typescript
interface TrafficOverviewWidgetProps {
  data?: typeof sampleData.timeSeries; // TimeSeriesDataPoint[]
  loading?: boolean;
  error?: string;
  className?: string;
}
```

**Data Processing**:
- Expects time-series data (TimeSeriesDataPoint[])
- Calculates current vs previous period metrics
- Aggregates sessions, users, pageviews for 7-day periods
- Computes percentage changes

#### ConversionWidget
**Interface**: `ConversionWidgetProps`
```typescript
interface ConversionWidgetProps {
  data?: typeof sampleData.timeSeries;     // TimeSeriesDataPoint[]
  channelData?: typeof sampleData.channels; // BarChartDataPoint[]
  loading?: boolean;
  error?: string;
  className?: string;
}
```

**Data Processing**:
- Requires both time-series and channel breakdown data
- Calculates conversion metrics from time-series
- Computes conversion rates, cost per conversion
- Estimates revenue with average order value

### 1.3 Table Component

#### TableComponent
**Interface**: `TableComponentProps<T>`
```typescript
interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'badge';
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

interface TableRow {
  [key: string]: any;
}

interface TableComponentProps<T extends TableRow> {
  data: T[];
  columns: TableColumn[];
  title?: string;
  description?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  sortable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  showRowCount?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
  highlightRow?: (row: T) => boolean;
}
```

**Data Requirements**:
- Flexible key-value row structure
- Type-specific formatters (currency, percentage, date)
- Sorting and pagination support
- Search functionality

### 1.4 Metric Card Component

#### MetricCard
**Interface**: `MetricCardProps`
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;              // Percentage change
    type: 'increase' | 'decrease';
    timeframe?: string;
  };
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  loading?: boolean;
  error?: string;
  className?: string;
  onClick?: () => void;
}
```

**Data Requirements**:
- Simple value with optional change calculation
- Percentage-based change representation
- String or number value support

## 2. MCP RESPONSE FORMATS ANALYSIS

### 2.1 Analytics Hook Response (`AnalyticsResult<T>`)
```typescript
interface AnalyticsResult<T = any> {
  data: T;                    // Raw GA4/MCP data
  isLoading: boolean;
  error?: Error;
  lastUpdated: number;
  cache: {
    isFromCache: boolean;
    cacheAge: number;
  };
  meta: {
    totalRows: number;
    samplingLevel: string;
    isDataGolden: boolean;
  };
}
```

**Response Characteristics**:
- Wrapper around raw GA4 data
- Cache and metadata information
- Generic data type (requires adapter interpretation)

### 2.2 Real-time Hook Response (`RealtimeResult<T>`)
```typescript
interface RealtimeResult<T = any> {
  data: T;
  isConnected: boolean;
  isPaused: boolean;
  lastUpdate: number;
  updateCount: number;
  errorCount: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}
```

**Response Characteristics**:
- Connection state management
- Performance metrics
- Generic data payload

### 2.3 Traffic Sources Response (`TrafficSourcesResult`)
```typescript
interface TrafficSourcesResult {
  sources: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
    newUsers: number;
    bounceRate: number;
    avgSessionDuration: number;
    conversions: number;
    revenue: number;
    isGoogleAds: boolean;
  }>;
  summary: {
    totalSessions: number;
    totalUsers: number;
    googleAdsShare: number;
    organicShare: number;
    directShare: number;
    socialShare: number;
    referralShare: number;
  };
}
```

**Response Characteristics**:
- Structured source/medium breakdown
- Pre-calculated summary statistics
- Google Ads identification

### 2.4 Page Performance Response (`PagePerformanceResult`)
```typescript
interface PagePerformanceResult {
  pages: Array<{
    pagePath: string;
    pageTitle: string;
    pageViews: number;
    uniquePageViews: number;
    avgTimeOnPage: number;
    bounceRate: number;
    exitRate: number;
    conversions: number;
    conversionRate: number;
    pageValue: number;
  }>;
  summary: {
    totalPageViews: number;
    avgTimeOnPage: number;
    avgBounceRate: number;
    totalConversions: number;
    avgConversionRate: number;
  };
}
```

**Response Characteristics**:
- Page-level performance metrics
- Multiple rate calculations
- Aggregated summary data

### 2.5 Conversions Response (`ConversionsResult`)
```typescript
interface ConversionsResult {
  conversions: Array<{
    goalName: string;
    goalCompletions: number;
    goalValue: number;
    goalConversionRate: number;
    source: string;
    medium: string;
    campaign: string;
    date: string;
  }>;
  ecommerce?: {
    transactions: number;
    revenue: number;
    avgOrderValue: number;
    conversionRate: number;
  };
  summary: {
    totalConversions: number;
    totalValue: number;
    avgConversionRate: number;
    topGoal: string;
  };
}
```

**Response Characteristics**:
- Goal-based conversion tracking
- Optional e-commerce metrics
- Attribution data (source, medium, campaign)

## 3. TRANSFORMATION REQUIREMENTS MAPPING

### 3.1 Chart Component Adapters Required

#### LineChart Adapter
**Transformation**: `AnalyticsResult<GA4TimeSeriesData>` → `TimeSeriesDataPoint[]`

**Required Mappings**:
- GA4 date dimensions → `date: string`
- GA4 sessions metric → `sessions?: number`
- GA4 users metric → `users?: number`
- GA4 pageViews metric → `pageviews?: number`
- Google Ads clicks → `clicks?: number`
- Google Ads impressions → `impressions?: number`
- Google Ads cost → `cost?: number`
- GA4 conversions → `conversions?: number`

**Computed Metrics Required**:
- CTR = clicks / impressions
- CPC = cost / clicks
- ROAS = (conversions * avg_order_value) / cost

#### BarChart Adapter
**Transformation**: `TrafficSourcesResult` | `PagePerformanceResult` → `BarChartDataPoint[]`

**Required Mappings**:
- Traffic Sources: `source/medium` → `name`
- Page Performance: `pagePath` or `pageTitle` → `name`
- Direct metric mapping with computed rates

#### DonutChart Adapter
**Transformation**: `TrafficSourcesResult.summary` → `DonutChartDataPoint[]`

**Required Mappings**:
- Share percentages → proportion data
- Source names → `name`
- Share values → `value`
- Automatic percentage calculation

### 3.2 Widget Component Adapters Required

#### TrafficOverviewWidget Adapter
**Transformation**: `AnalyticsResult<GA4TimeSeriesData>` → `TimeSeriesDataPoint[]`
- Same as LineChart adapter
- Additional period comparison logic
- Percentage change calculations

#### ConversionWidget Adapter
**Transformation**: Multiple MCP sources → Widget data format
- Time-series conversion data
- Channel breakdown data
- Computed metrics integration

### 3.3 Table Component Adapters Required

#### Generic Table Adapter
**Transformation**: Any MCP result → `TableRow[]`

**Column Mapping**:
- Field type detection
- Formatter assignment based on data type
- Sortable field identification

### 3.4 MetricCard Adapter Required

#### Single Metric Adapter
**Transformation**: MCP summary data → `MetricCardProps`

**Required Calculations**:
- Current period value extraction
- Previous period comparison
- Percentage change computation
- Type determination (increase/decrease)

## 4. COMPATIBILITY GAPS IDENTIFIED

### 4.1 Data Format Mismatches

1. **Date Format Inconsistency**
   - Components expect: `string` (YYYY-MM-DD)
   - MCP may return: Various GA4 date formats
   - **Solution**: Date normalization adapter

2. **Metric Name Mapping**
   - Components use: `pageviews`, `ctr`, `cpc`, `roas`
   - GA4 uses: `screenPageViews`, `clickThroughRate`, `costPerClick`, `returnOnAdSpend`
   - **Solution**: Field name mapping dictionary

3. **Computed vs Raw Metrics**
   - Components expect computed CTR, CPC, ROAS
   - MCP may return raw click/impression/cost data
   - **Solution**: Computation adapter layer

### 4.2 Data Structure Differences

1. **Array vs Object Structures**
   - Components expect flat arrays
   - MCP returns nested objects with metadata
   - **Solution**: Flattening adapters

2. **Summary Data Integration**
   - MCP provides pre-calculated summaries
   - Components calculate their own aggregations
   - **Solution**: Choose between MCP summaries vs component calculations

### 4.3 Error Handling Gaps

1. **Loading State Management**
   - Components expect boolean loading flags
   - MCP provides detailed loading metadata
   - **Solution**: Loading state adapter

2. **Error Format Differences**
   - Components expect string error messages
   - MCP provides Error objects with metadata
   - **Solution**: Error message extraction adapter

## 5. ADAPTER ARCHITECTURE REQUIREMENTS

### 5.1 Base Adapter Interface
```typescript
interface BaseAdapter<TInput, TOutput> {
  transform(input: TInput): TOutput;
  validate(input: TInput): boolean;
  getDefaultOutput(): TOutput;
  handleError(error: Error): TOutput;
}
```

### 5.2 Required Adapter Types

1. **ChartDataAdapter**: MCP → Chart component formats
2. **WidgetDataAdapter**: MCP → Widget component formats
3. **TableDataAdapter**: MCP → Table component formats
4. **MetricAdapter**: MCP → MetricCard formats
5. **ErrorAdapter**: MCP errors → Component error formats
6. **LoadingAdapter**: MCP loading states → Component loading states

### 5.3 Utility Functions Required

1. **Date normalization**: Various date formats → ISO date strings
2. **Metric computation**: Raw metrics → computed metrics (CTR, CPC, ROAS)
3. **Field mapping**: GA4 field names → component field names
4. **Type coercion**: String numbers → actual numbers
5. **Null handling**: undefined/null → default values
6. **Percentage calculation**: Raw values → percentage representations

## 6. NEXT PHASE REQUIREMENTS

### Phase 2: Core Adapter Framework
- Implement base adapter classes
- Create utility transformation functions
- Set up adapter factory pattern
- Implement error handling mechanisms

### Phase 3: Component-Specific Adapters
- Chart adapters (Line, Bar, Donut)
- Widget adapters (Traffic, Conversion, Performance)
- Table adapters with pagination/sorting
- Metric card adapters

### Phase 4: Validation & Sanitization
- Data validation schemas
- Input sanitization
- Type coercion and standardization
- Graceful fallback handling

### Phase 5: Integration & Testing
- Dashboard component integration
- Backward compatibility testing
- Performance optimization
- Documentation and examples

---

**Phase 1 Complete**: Interface analysis and mapping documentation finished.
**Ready for Phase 2**: Core adapter framework development.