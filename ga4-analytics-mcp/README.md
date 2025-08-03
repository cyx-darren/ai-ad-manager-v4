# GA4 Analytics MCP Server

A Model Context Protocol (MCP) server that provides Google Analytics 4 data integration tools for AI applications.

## Features

- **Real-time Analytics**: Get current user activity and live metrics
- **Traffic Sources**: Analyze channel and source breakdown  
- **User Demographics**: Access age, gender, and location data
- **Page Performance**: Monitor page views, load times, and bounce rates
- **Conversion Data**: Track goals and conversion funnels
- **Custom Queries**: Flexible metrics and dimensions queries

## Quick Start

### Prerequisites

- Node.js 18+ 
- Google Analytics 4 property with API access
- Google Cloud Project with Analytics Reporting API enabled
- Service Account with appropriate GA4 permissions

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd ga4-analytics-mcp
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp environment.template .env
   # Edit .env with your GA4 credentials
   ```

3. **Configure Google Analytics access:**
   - Create a service account in Google Cloud Console
   - Download the service account key JSON file
   - Either set `GOOGLE_APPLICATION_CREDENTIALS` path or use individual credentials
   - Add the service account email to your GA4 property with Viewer permissions

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GA4_PROPERTY_ID` | Your GA4 property ID | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | ✅* |
| `GOOGLE_CLIENT_EMAIL` | Service account email | ✅* |
| `GOOGLE_PRIVATE_KEY` | Service account private key | ✅* |
| `GOOGLE_PROJECT_ID` | Google Cloud project ID | ✅* |
| `MCP_SERVER_PORT` | Server port (default: 3002) | ❌ |
| `NODE_ENV` | Environment (development/production) | ❌ |

*Choose either file-based (`GOOGLE_APPLICATION_CREDENTIALS`) or individual credential variables.

## Available MCP Tools

### 1. `query_analytics`
Execute custom GA4 queries with flexible metrics and dimensions.

**Parameters:**
- `metrics`: Array of GA4 metrics (e.g., "sessions", "pageviews")
- `dimensions`: Array of GA4 dimensions (e.g., "country", "deviceType")  
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `limit`: Maximum rows to return (optional)

### 2. `get_realtime_data`
Get current active users and real-time activity.

**Parameters:**
- `metrics`: Real-time metrics array (default: ["activeUsers"])

### 3. `get_traffic_sources`
Analyze traffic sources and channel performance.

**Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `includeChannels`: Include channel grouping data (default: true)

### 4. `get_user_demographics`
Access user demographic information.

**Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `breakdown`: Demographic breakdown type ("age", "gender", "location")

### 5. `get_page_performance`
Monitor page-level performance metrics.

**Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `orderBy`: Sort field (default: "pageviews")
- `limit`: Maximum pages to return (default: 50)

### 6. `get_conversion_data`
Track conversion goals and funnel performance.

**Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `includeGoals`: Include goal completion data (default: true)

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Remove build artifacts

### Project Structure

```
src/
├── index.ts          # MCP server entry point
├── tools/            # MCP tool implementations
│   ├── analytics.ts  # query_analytics tool
│   ├── realtime.ts   # get_realtime_data tool
│   └── ...
├── utils/            # Shared utilities
│   ├── ga4Client.ts  # GA4 API client wrapper
│   └── validation.ts # Input validation
└── types/            # TypeScript type definitions
    └── ga4.ts        # GA4 response types
```

## Deployment

### Railway Deployment

1. **Connect to Railway:**
   ```bash
   railway login
   railway link
   ```

2. **Set environment variables:**
   ```bash
   railway variables set GA4_PROPERTY_ID=your-property-id
   railway variables set GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   railway variables set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
   railway variables set GOOGLE_PROJECT_ID=your-project-id
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

### Health Check

The server exposes a health check endpoint at `/health` for monitoring.

## License

MIT