// Dashboard Components - using named exports
export { DashboardLayout } from './DashboardLayout';
export { MetricCard, LoadingMetricCard, ErrorMetricCard } from './MetricCard';
export { AlertBanner, SuccessAlert, WarningAlert, InfoAlert, ErrorAlert } from './AlertBanner';
export { TableComponent, GA4_PAGES_COLUMNS, GA4_TRAFFIC_SOURCES_COLUMNS, GOOGLE_ADS_CAMPAIGNS_COLUMNS } from './TableComponent';
export { ChartContainer, SmallChartContainer, MediumChartContainer, LargeChartContainer, ChartContainerWithMenu } from './ChartContainer';
export { DateRangePicker } from './DateRangePicker';
export { SettingsPanel } from './SettingsPanel';

// Chart Components - Direct exports (Next.js 14 compatible)
export { 
  BarChart, 
  CampaignPerformanceBarChart,
  ChannelTrafficBarChart,
  DevicePerformanceBarChart,
  TopCampaignsBarChart
} from './BarChart';

export { 
  DonutChart,
  TrafficSourceDonutChart,
  DeviceBreakdownDonutChart,
  CampaignTypeDonutChart,
  GeographicDonutChart,
  ConversionFunnelDonutChart
} from './DonutChart';

export { 
  LineChart,
  TrafficLineChart,
  EngagementLineChart,
  AdsPerformanceLineChart,
  AdsEfficiencyLineChart
} from './LineChart';

// Export constants (these don't need SSR disabling)
export { 
  GA4_TRAFFIC_METRICS,
  GA4_ENGAGEMENT_METRICS,
  GOOGLE_ADS_PERFORMANCE_METRICS,
  GOOGLE_ADS_EFFICIENCY_METRICS
} from './LineChart';

// Widget Components  
export * from './widgets';

// Sample Data
export * from './sampleData';