# GA4 API Service - Endpoint Documentation

## Overview

The GA4 API Service provides access to Google Analytics 4 data through authenticated REST endpoints. All endpoints require authentication via API key or OAuth 2.0.

---

## Authentication

### API Key Authentication (Development)
```bash
curl -H "X-API-Key: development-key" "http://localhost:3001/api/ga4/..."
```

### OAuth 2.0 Authentication (Production)
```bash
curl -H "Authorization: Bearer your-jwt-token" "https://your-service.railway.app/api/ga4/..."
```

---

## Session Metrics Endpoint

**Phase 5.3.1 Implementation** ✅

### `GET /api/ga4/sessions/:propertyId`

Fetch session metrics from Google Analytics 4 for a specified property and date range.

#### Parameters

**Path Parameters:**
- `propertyId` (required): GA4 property ID in format `properties/123456789`

**Query Parameters:**
- `startDate` (optional): Start date in `YYYY-MM-DD` format (default: 7 days ago)
- `endDate` (optional): End date in `YYYY-MM-DD` format (default: today)  
- `dimensions` (optional): Comma-separated list of additional dimensions
- `limit` (optional): Maximum number of rows to return (default: 100, max: 100000)

#### Example Requests

**Basic Request:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/sessions/properties%2F123456789"
```

**With Date Range:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/sessions/properties%2F123456789?startDate=2025-01-01&endDate=2025-01-07"
```

**With Additional Dimensions:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/sessions/properties%2F123456789?dimensions=country,deviceType&limit=50"
```

#### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "endpoint": "getSessionMetrics",
  "propertyId": "properties/123456789",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  },
  "data": [
    {
      "date": "2025-01-01",
      "dimensions": {
        "date": "2025-01-01",
        "country": "United States"
      },
      "metrics": {
        "sessions": 1250,
        "totalUsers": 980,
        "newUsers": 320,
        "sessionsPerUser": 1.28,
        "averageSessionDuration": 185.5,
        "bounceRate": 0.42,
        "screenPageViews": 3200,
        "screenPageViewsPerSession": 2.56
      }
    }
  ],
  "summary": {
    "totalSessions": 8750,
    "totalUsers": 6860,
    "newUsers": 2240,
    "averageSessionDuration": 192.3,
    "bounceRate": 0.38,
    "totalPageViews": 22400,
    "sessionsPerUser": 1.28,
    "pageViewsPerSession": 2.56
  },
  "metadata": {
    "recordCount": 7,
    "samplingMetadata": null,
    "currencyCode": "USD",
    "timezone": "America/Los_Angeles",
    "quotaConsumed": null
  },
  "requestInfo": {
    "authenticatedUser": "user@example.com",
    "requestTime": "2025-07-29T06:49:50.558Z",
    "parametersUsed": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07",
      "limit": 100
    }
  }
}
```

#### Available Metrics

The session metrics endpoint returns the following GA4 metrics:

| Metric | Description | Type |
|--------|-------------|------|
| `sessions` | Total number of sessions | Integer |
| `totalUsers` | Total number of users | Integer |
| `newUsers` | Number of new users | Integer |
| `sessionsPerUser` | Average sessions per user | Float |
| `averageSessionDuration` | Average session duration in seconds | Float |
| `bounceRate` | Bounce rate (0-1) | Float |
| `screenPageViews` | Total page/screen views | Integer |
| `screenPageViewsPerSession` | Average page views per session | Float |

#### Available Dimensions

You can include additional dimensions in your request:

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `country` | User's country | "United States", "Canada" |
| `city` | User's city | "New York", "San Francisco" |
| `deviceType` | Device type | "desktop", "mobile", "tablet" |
| `operatingSystem` | Operating system | "Windows", "iOS", "Android" |
| `browser` | Browser name | "Chrome", "Safari", "Firefox" |
| `source` | Traffic source | "google", "direct", "facebook" |
| `medium` | Traffic medium | "organic", "cpc", "referral" |

#### Error Responses

**400 Bad Request - Parameter Validation Failed:**
```json
{
  "success": false,
  "error": "Failed to fetch session metrics",
  "message": "Parameter validation failed: Property ID must start with \"properties/\" (e.g., \"properties/123456789\")",
  "endpoint": "getSessionMetrics",
  "propertyId": "invalid-property-id",
  "timestamp": "2025-07-29T06:49:34.273Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {}
  }
}
```

**403 Forbidden - Access Denied:**
```json
{
  "success": false,
  "error": "Failed to fetch session metrics",
  "message": "Access denied: Check that the service account has access to the GA4 property",
  "endpoint": "getSessionMetrics",
  "propertyId": "properties/123456789",
  "timestamp": "2025-07-29T06:49:50.558Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07"
    }
  }
}
```

**429 Too Many Requests - Rate Limited:**
```json
{
  "success": false,
  "error": "Failed to fetch session metrics",
  "message": "API quota exceeded: Too many requests. Please try again later",
  "endpoint": "getSessionMetrics",
  "propertyId": "properties/123456789",
  "timestamp": "2025-07-29T06:49:50.558Z"
}
```

---

## User Metrics Endpoint

**Phase 5.3.2 Implementation** ✅

### `GET /api/ga4/users/:propertyId`

Fetch user metrics and demographics data from Google Analytics 4 for a specified property and date range.

#### Parameters

**Path Parameters:**
- `propertyId` (required): GA4 property ID in format `properties/123456789`

**Query Parameters:**
- `startDate` (optional): Start date in `YYYY-MM-DD` format (default: 7 days ago)
- `endDate` (optional): End date in `YYYY-MM-DD` format (default: today)  
- `dimensions` (optional): Comma-separated list of additional dimensions
- `limit` (optional): Maximum number of rows to return (default: 100, max: 100000)

#### Example Requests

**Basic Request:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/users/properties%2F123456789"
```

**With Date Range:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/users/properties%2F123456789?startDate=2025-01-01&endDate=2025-01-07"
```

**With Additional Dimensions:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/users/properties%2F123456789?dimensions=country,ageGroup&limit=50"
```

#### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "endpoint": "getUserMetrics",
  "propertyId": "properties/123456789",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  },
  "data": [
    {
      "date": "2025-01-01",
      "dimensions": {
        "date": "2025-01-01",
        "country": "United States"
      },
      "metrics": {
        "totalUsers": 2450,
        "newUsers": 890,
        "returningUsers": 1560,
        "activeUsers": 2380,
        "userEngagementDuration": 485.5,
        "engagedSessions": 1820,
        "engagementRate": 0.74,
        "averageEngagementTime": 198.2
      }
    }
  ],
  "summary": {
    "totalUsers": 17150,
    "newUsers": 6230,
    "returningUsers": 10920,
    "activeUsers": 16650,
    "userEngagementDuration": 3399.5,
    "engagedSessions": 12740,
    "engagementRate": 0.74,
    "averageEngagementTime": 198.2,
    "newUserPercentage": 36.3,
    "returningUserPercentage": 63.7
  },
  "metadata": {
    "recordCount": 7,
    "samplingMetadata": null,
    "currencyCode": "USD",
    "timezone": "America/Los_Angeles",
    "quotaConsumed": null
  },
  "requestInfo": {
    "authenticatedUser": "user@example.com",
    "requestTime": "2025-07-29T07:02:51.594Z",
    "parametersUsed": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07",
      "limit": 100
    }
  }
}
```

#### Available Metrics

The user metrics endpoint returns the following GA4 metrics:

| Metric | Description | Type |
|--------|-------------|------|
| `totalUsers` | Total number of users | Integer |
| `newUsers` | Number of new users | Integer |
| `returningUsers` | Number of returning users | Integer |
| `activeUsers` | Number of active users | Integer |
| `userEngagementDuration` | Total user engagement duration in seconds | Float |
| `engagedSessions` | Number of engaged sessions | Integer |
| `engagementRate` | Engagement rate (0-1) | Float |
| `averageEngagementTime` | Average engagement time per user in seconds | Float |

#### Summary Statistics

Additional calculated metrics in the summary:

| Metric | Description | Type |
|--------|-------------|------|
| `newUserPercentage` | Percentage of new users | Float |
| `returningUserPercentage` | Percentage of returning users | Float |

#### Available Dimensions for User Metrics

You can include additional dimensions in your request:

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `country` | User's country | "United States", "Canada" |
| `city` | User's city | "New York", "San Francisco" |
| `ageGroup` | User age group | "18-24", "25-34", "35-44" |
| `gender` | User gender | "male", "female" |
| `deviceType` | Device type | "desktop", "mobile", "tablet" |
| `operatingSystem` | Operating system | "Windows", "iOS", "Android" |
| `browser` | Browser name | "Chrome", "Safari", "Firefox" |
| `userType` | User type | "new", "returning" |
| `cohortNthDay` | Days since first visit | "0", "1", "7", "30" |

#### Error Responses

**400 Bad Request - Parameter Validation Failed:**
```json
{
  "success": false,
  "error": "Failed to fetch user metrics",
  "message": "Parameter validation failed: Property ID must start with \"properties/\" (e.g., \"properties/123456789\")",
  "endpoint": "getUserMetrics",
  "propertyId": "invalid-property-id",
  "timestamp": "2025-07-29T07:02:44.684Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {}
  }
}
```

**403 Forbidden - Access Denied:**
```json
{
  "success": false,
  "error": "Failed to fetch user metrics",
  "message": "Access denied: Check that the service account has access to the GA4 property",
  "endpoint": "getUserMetrics",
  "propertyId": "properties/123456789",
  "timestamp": "2025-07-29T07:02:51.594Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07"
    }
  }
}
```

---

## Traffic Source Breakdown Endpoint

**Phase 5.3.3 Implementation** ✅

### `GET /api/ga4/traffic-sources/:propertyId`

Fetch traffic source breakdown and attribution data from Google Analytics 4 for a specified property and date range.

#### Parameters

**Path Parameters:**
- `propertyId` (required): GA4 property ID in format `properties/123456789`

**Query Parameters:**
- `startDate` (optional): Start date in `YYYY-MM-DD` format (default: 7 days ago)
- `endDate` (optional): End date in `YYYY-MM-DD` format (default: today)  
- `dimensions` (optional): Comma-separated list of additional dimensions
- `limit` (optional): Maximum number of rows to return (default: 100, max: 100000)

#### Example Requests

**Basic Request:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/traffic-sources/properties%2F123456789"
```

**With Date Range:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/traffic-sources/properties%2F123456789?startDate=2025-01-01&endDate=2025-01-07"
```

**With Additional Dimensions:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/traffic-sources/properties%2F123456789?dimensions=campaign,country&limit=50"
```

#### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "endpoint": "getTrafficSourceBreakdown",
  "propertyId": "properties/123456789",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  },
  "data": [
    {
      "date": "2025-01-01",
      "source": "google",
      "medium": "organic",
      "dimensions": {
        "date": "2025-01-01",
        "source": "google",
        "medium": "organic",
        "country": "United States"
      },
      "metrics": {
        "sessions": 3250,
        "totalUsers": 2890,
        "newUsers": 1120,
        "screenPageViews": 8450,
        "averageSessionDuration": 245.8,
        "bounceRate": 0.35,
        "engagementRate": 0.78,
        "conversions": 145
      }
    }
  ],
  "summary": {
    "totalSessions": 22750,
    "totalUsers": 20230,
    "newUsers": 7840,
    "totalPageViews": 59150,
    "averageSessionDuration": 235.4,
    "bounceRate": 0.38,
    "engagementRate": 0.76,
    "totalConversions": 1015,
    "conversionRate": 4.46,
    "pageViewsPerSession": 2.6
  },
  "breakdown": {
    "topSources": [
      {
        "source": "google",
        "sessions": 12500,
        "users": 11200,
        "conversions": 560
      },
      {
        "source": "direct",
        "sessions": 6750,
        "users": 5890,
        "conversions": 285
      }
    ],
    "topMediums": [
      {
        "medium": "organic",
        "sessions": 14200,
        "users": 12750,
        "conversions": 640
      },
      {
        "medium": "cpc",
        "sessions": 5500,
        "users": 4850,
        "conversions": 225
      }
    ],
    "sourceMediumCombinations": [
      {
        "source": "google",
        "medium": "organic",
        "sourceMedium": "google / organic",
        "sessions": 11200,
        "users": 10100,
        "conversions": 504
      },
      {
        "source": "direct",
        "medium": "(none)",
        "sourceMedium": "direct / (none)",
        "sessions": 6750,
        "users": 5890,
        "conversions": 285
      }
    ]
  },
  "metadata": {
    "recordCount": 7,
    "samplingMetadata": null,
    "currencyCode": "USD",
    "timezone": "America/Los_Angeles",
    "quotaConsumed": null
  },
  "requestInfo": {
    "authenticatedUser": "user@example.com",
    "requestTime": "2025-07-29T07:10:38.322Z",
    "parametersUsed": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07",
      "limit": 100
    }
  }
}
```

#### Available Metrics

The traffic source breakdown endpoint returns the following GA4 metrics:

| Metric | Description | Type |
|--------|-------------|------|
| `sessions` | Total number of sessions | Integer |
| `totalUsers` | Total number of users | Integer |
| `newUsers` | Number of new users | Integer |
| `screenPageViews` | Total page/screen views | Integer |
| `averageSessionDuration` | Average session duration in seconds | Float |
| `bounceRate` | Bounce rate (0-1) | Float |
| `engagementRate` | Engagement rate (0-1) | Float |
| `conversions` | Total conversions | Integer |

#### Summary Statistics

Additional calculated metrics in the summary:

| Metric | Description | Type |
|--------|-------------|------|
| `conversionRate` | Conversion rate as percentage | Float |
| `pageViewsPerSession` | Average page views per session | Float |

#### Traffic Source Breakdown Analysis

The response includes detailed breakdown analysis:

**Top Sources** (up to 10):
- Ordered by session count
- Shows sessions, users, and conversions per source

**Top Mediums** (up to 10):
- Ordered by session count  
- Shows sessions, users, and conversions per medium

**Source/Medium Combinations** (up to 15):
- Ordered by session count
- Shows the most effective traffic source combinations
- Includes separate source and medium fields plus combined `sourceMedium`

#### Available Dimensions for Traffic Sources

You can include additional dimensions in your request:

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `campaign` | Campaign name | "summer_sale_2025", "brand_awareness" |
| `sourceMedium` | Combined source/medium | "google / organic", "facebook / cpc" |
| `campaignId` | Campaign ID | "123456789" |
| `adContent` | Ad content | "text_ad_1", "banner_creative_a" |
| `keyword` | Search keyword | "analytics tool", "website builder" |
| `country` | User's country | "United States", "Canada" |
| `city` | User's city | "New York", "San Francisco" |
| `deviceType` | Device type | "desktop", "mobile", "tablet" |
| `operatingSystem` | Operating system | "Windows", "iOS", "Android" |
| `browser` | Browser name | "Chrome", "Safari", "Firefox" |

#### Error Responses

**400 Bad Request - Parameter Validation Failed:**
```json
{
  "success": false,
  "error": "Failed to fetch traffic source breakdown",
  "message": "Parameter validation failed: Property ID must start with \"properties/\" (e.g., \"properties/123456789\")",
  "endpoint": "getTrafficSourceBreakdown",
  "propertyId": "invalid-property-id",
  "timestamp": "2025-07-29T07:10:31.150Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {}
  }
}
```

**403 Forbidden - Access Denied:**
```json
{
  "success": false,
  "error": "Failed to fetch traffic source breakdown",
  "message": "Access denied: Check that the service account has access to the GA4 property",
  "endpoint": "getTrafficSourceBreakdown",
  "propertyId": "properties/123456789",
  "timestamp": "2025-07-29T07:10:38.322Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07"
    }
  }
}
```

---

## Page Performance Endpoint

**Phase 5.3.4 Implementation** ✅

### `GET /api/ga4/page-performance/:propertyId`

Fetch page-level performance metrics from Google Analytics 4 for a specified property and date range.

#### Parameters

**Path Parameters:**
- `propertyId` (required): GA4 property ID in format `properties/123456789`

**Query Parameters:**
- `startDate` (optional): Start date in `YYYY-MM-DD` format (default: 7 days ago)
- `endDate` (optional): End date in `YYYY-MM-DD` format (default: today)  
- `dimensions` (optional): Comma-separated list of additional dimensions
- `limit` (optional): Maximum number of rows to return (default: 100, max: 100000)

#### Example Requests

**Basic Request:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/page-performance/properties%2F123456789"
```

**With Date Range:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/page-performance/properties%2F123456789?startDate=2025-01-01&endDate=2025-01-07"
```

**With Additional Dimensions:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/page-performance/properties%2F123456789?dimensions=country,deviceType&limit=50"
```

#### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "endpoint": "getPagePerformance",
  "propertyId": "properties/123456789",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  },
  "data": [
    {
      "date": "2025-01-01",
      "pagePath": "/products/analytics-dashboard",
      "pageTitle": "Analytics Dashboard - Our Product",
      "dimensions": {
        "date": "2025-01-01",
        "pagePath": "/products/analytics-dashboard",
        "pageTitle": "Analytics Dashboard - Our Product",
        "country": "United States"
      },
      "metrics": {
        "screenPageViews": 4250,
        "uniqueScreenPageViews": 3890,
        "sessions": 2150,
        "totalUsers": 1980,
        "averageSessionDuration": 285.4,
        "bounceRate": 0.28,
        "engagementRate": 0.82,
        "userEngagementDuration": 1250.5
      }
    }
  ],
  "summary": {
    "totalPageViews": 29750,
    "uniquePageViews": 27230,
    "totalSessions": 15050,
    "totalUsers": 13840,
    "averageSessionDuration": 245.8,
    "bounceRate": 0.32,
    "engagementRate": 0.78,
    "userEngagementDuration": 8750.5,
    "viewsPerSession": 1.98,
    "usersPerPage": 1973.4
  },
  "breakdown": {
    "topPages": [
      {
        "pagePath": "/",
        "pageTitle": "Home - Our Site",
        "pageViews": 8450,
        "sessions": 4250,
        "users": 3890,
        "engagementRate": 0.85,
        "bounceRate": 0.25
      },
      {
        "pagePath": "/products",
        "pageTitle": "Products - Our Site",
        "pageViews": 5250,
        "sessions": 2890,
        "users": 2650,
        "engagementRate": 0.78,
        "bounceRate": 0.35
      }
    ],
    "pagesByEngagement": [
      {
        "pagePath": "/success-stories",
        "pageTitle": "Success Stories",
        "pageViews": 1250,
        "sessions": 890,
        "users": 820,
        "engagementRate": 0.92,
        "bounceRate": 0.18
      }
    ],
    "pagesByBounceRate": [
      {
        "pagePath": "/contact",
        "pageTitle": "Contact Us",
        "pageViews": 2150,
        "sessions": 1450,
        "users": 1320,
        "engagementRate": 0.88,
        "bounceRate": 0.15
      }
    ]
  },
  "metadata": {
    "recordCount": 7,
    "samplingMetadata": null,
    "currencyCode": "USD",
    "timezone": "America/Los_Angeles",
    "quotaConsumed": null
  },
  "requestInfo": {
    "authenticatedUser": "user@example.com",
    "requestTime": "2025-07-29T07:16:07.907Z",
    "parametersUsed": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07",
      "limit": 100
    }
  }
}
```

#### Available Metrics

The page performance endpoint returns the following GA4 metrics:

| Metric | Description | Type |
|--------|-------------|------|
| `screenPageViews` | Total page views | Integer |
| `uniqueScreenPageViews` | Unique page views (deduplicated) | Integer |
| `sessions` | Sessions that included this page | Integer |
| `totalUsers` | Users who viewed this page | Integer |
| `averageSessionDuration` | Average session duration in seconds | Float |
| `bounceRate` | Bounce rate for sessions including this page (0-1) | Float |
| `engagementRate` | Engagement rate for this page (0-1) | Float |
| `userEngagementDuration` | Total user engagement duration in seconds | Float |

#### Summary Statistics

Additional calculated metrics in the summary:

| Metric | Description | Type |
|--------|-------------|------|
| `viewsPerSession` | Average page views per session | Float |
| `usersPerPage` | Average users per page | Float |

#### Page Performance Breakdown Analysis

The response includes detailed page performance analysis:

**Top Pages** (up to 10):
- Ordered by page view count
- Shows page views, sessions, users, engagement rate, and bounce rate per page

**Pages by Engagement** (up to 10):
- Ordered by engagement rate (highest first)
- Shows which pages have the highest user engagement

**Pages by Bounce Rate** (up to 10):
- Ordered by bounce rate (lowest first)
- Shows pages with the best user retention

#### Available Dimensions for Page Performance

You can include additional dimensions in your request:

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `pageLocation` | Full page URL | "https://example.com/products" |
| `pageReferrer` | Previous page URL | "https://google.com", "https://example.com/home" |
| `landingPage` | Landing page path | "/", "/products", "/blog" |
| `exitPage` | Exit page path | "/contact", "/checkout", "/thank-you" |
| `country` | User's country | "United States", "Canada" |
| `city` | User's city | "New York", "San Francisco" |
| `deviceType` | Device type | "desktop", "mobile", "tablet" |
| `operatingSystem` | Operating system | "Windows", "iOS", "Android" |
| `browser` | Browser name | "Chrome", "Safari", "Firefox" |
| `source` | Traffic source | "google", "direct", "facebook" |
| `medium` | Traffic medium | "organic", "cpc", "referral" |

#### Error Responses

**400 Bad Request - Parameter Validation Failed:**
```json
{
  "success": false,
  "error": "Failed to fetch page performance metrics",
  "message": "Parameter validation failed: Property ID must start with \"properties/\" (e.g., \"properties/123456789\")",
  "endpoint": "getPagePerformance",
  "propertyId": "invalid-property-id",
  "timestamp": "2025-07-29T07:16:00.239Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {}
  }
}
```

**403 Forbidden - Access Denied:**
```json
{
  "success": false,
  "error": "Failed to fetch page performance metrics",
  "message": "Access denied: Check that the service account has access to the GA4 property",
  "endpoint": "getPagePerformance",
  "propertyId": "properties/123456789",
  "timestamp": "2025-07-29T07:16:07.907Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07"
    }
  }
}
```

---

## Conversion Metrics Endpoint

**Phase 5.3.5 Implementation** ✅

### `GET /api/ga4/conversions/:propertyId`

Fetch conversion and goal completion metrics from Google Analytics 4 for a specified property and date range.

#### Parameters

**Path Parameters:**
- `propertyId` (required): GA4 property ID in format `properties/123456789`

**Query Parameters:**
- `startDate` (optional): Start date in `YYYY-MM-DD` format (default: 7 days ago)
- `endDate` (optional): End date in `YYYY-MM-DD` format (default: today)  
- `dimensions` (optional): Comma-separated list of additional dimensions
- `limit` (optional): Maximum number of rows to return (default: 100, max: 100000)

#### Example Requests

**Basic Request:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/conversions/properties%2F123456789"
```

**With Date Range:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/conversions/properties%2F123456789?startDate=2025-01-01&endDate=2025-01-07"
```

**With Additional Dimensions:**
```bash
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/conversions/properties%2F123456789?dimensions=country,source&limit=50"
```

#### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "endpoint": "getConversionMetrics",
  "propertyId": "properties/123456789",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  },
  "data": [
    {
      "date": "2025-01-01",
      "eventName": "purchase",
      "dimensions": {
        "date": "2025-01-01",
        "eventName": "purchase",
        "country": "United States"
      },
      "metrics": {
        "conversions": 285,
        "totalRevenue": 14250.75,
        "purchaseRevenue": 14250.75,
        "sessions": 2150,
        "totalUsers": 1980,
        "sessionsWithEvent": 285,
        "userConversionRate": 14.39,
        "sessionConversionRate": 13.26
      }
    },
    {
      "date": "2025-01-01", 
      "eventName": "sign_up",
      "dimensions": {
        "date": "2025-01-01",
        "eventName": "sign_up",
        "country": "United States"
      },
      "metrics": {
        "conversions": 125,
        "totalRevenue": 0,
        "purchaseRevenue": 0,
        "sessions": 2150,
        "totalUsers": 1980,
        "sessionsWithEvent": 125,
        "userConversionRate": 6.31,
        "sessionConversionRate": 5.81
      }
    }
  ],
  "summary": {
    "totalConversions": 1450,
    "totalRevenue": 72350.75,
    "purchaseRevenue": 68250.50,
    "totalSessions": 15050,
    "totalUsers": 13840,
    "sessionsWithConversions": 1450,
    "userConversionRate": 10.48,
    "sessionConversionRate": 9.63,
    "averageOrderValue": 49.90,
    "revenuePerUser": 5.23,
    "conversionValue": 49.90
  },
  "breakdown": {
    "topConversionEvents": [
      {
        "eventName": "purchase",
        "conversions": 950,
        "revenue": 68250.50,
        "sessions": 12050,
        "users": 10840
      },
      {
        "eventName": "sign_up",
        "conversions": 350,
        "revenue": 0,
        "sessions": 15050,
        "users": 13840
      },
      {
        "eventName": "contact",
        "conversions": 150,
        "revenue": 4100.25,
        "sessions": 8500,
        "users": 7650
      }
    ],
    "revenueByEvent": [
      {
        "eventName": "purchase",
        "conversions": 950,
        "revenue": 68250.50,
        "sessions": 12050,
        "users": 10840
      },
      {
        "eventName": "contact", 
        "conversions": 150,
        "revenue": 4100.25,
        "sessions": 8500,
        "users": 7650
      }
    ],
    "conversionsByDate": [
      {
        "date": "2025-01-01",
        "conversions": 410,
        "revenue": 20150.25,
        "sessions": 2150,
        "users": 1980
      },
      {
        "date": "2025-01-02",
        "conversions": 385,
        "revenue": 18950.50,
        "sessions": 2080,
        "users": 1920
      }
    ]
  },
  "metadata": {
    "recordCount": 14,
    "samplingMetadata": null,
    "currencyCode": "USD",
    "timezone": "America/Los_Angeles",
    "quotaConsumed": null
  },
  "requestInfo": {
    "authenticatedUser": "user@example.com",
    "requestTime": "2025-07-29T07:21:46.826Z",
    "parametersUsed": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07",
      "limit": 100
    }
  }
}
```

#### Available Metrics

The conversion metrics endpoint returns the following GA4 metrics:

| Metric | Description | Type |
|--------|-------------|------|
| `conversions` | Total conversion events | Integer |
| `totalRevenue` | Total revenue from all conversions | Float |
| `purchaseRevenue` | Revenue specifically from purchase events | Float |
| `sessions` | Total sessions in the period | Integer |
| `totalUsers` | Total users in the period | Integer |
| `sessionsWithEvent` | Sessions that included the conversion event | Integer |
| `userConversionRate` | Percentage of users who converted | Float |
| `sessionConversionRate` | Percentage of sessions with conversions | Float |

#### Summary Statistics

Additional calculated metrics in the summary:

| Metric | Description | Type | Formula |
|--------|-------------|------|---------|
| `averageOrderValue` | Average revenue per conversion | Float | totalRevenue / totalConversions |
| `revenuePerUser` | Average revenue per user | Float | totalRevenue / totalUsers |
| `conversionValue` | Average value per conversion | Float | totalRevenue / totalConversions |

#### Conversion Events Filter

The endpoint automatically filters for common conversion events:
- `purchase` - Ecommerce purchases
- `sign_up` - User registrations 
- `contact` - Contact form submissions
- `download` - File downloads
- `conversion` - Custom conversion events

#### Conversion Analysis Breakdown

The response includes detailed conversion analysis:

**Top Conversion Events** (up to 10):
- Ordered by conversion count
- Shows conversions, revenue, sessions, and users per event

**Revenue by Event** (up to 10):
- Ordered by revenue amount (highest first)
- Shows which events generate the most revenue

**Conversions by Date**:
- Daily breakdown of conversions and revenue
- Ordered chronologically for trend analysis

#### Available Dimensions for Conversions

You can include additional dimensions in your request:

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| `conversionGoalId` | GA4 conversion goal ID | "123456789", "987654321" |
| `conversionGoalName` | GA4 conversion goal name | "Purchase", "Newsletter Signup" |
| `transactionId` | Ecommerce transaction ID | "TXN_001", "ORDER_12345" |
| `itemId` | Product/item identifier | "PROD_001", "SKU_ABC123" |
| `itemName` | Product/item name | "Analytics Dashboard", "Premium Plan" |
| `itemCategory` | Product category | "Software", "Subscription" |
| `country` | User's country | "United States", "Canada" |
| `city` | User's city | "New York", "San Francisco" |
| `deviceType` | Device type | "desktop", "mobile", "tablet" |
| `operatingSystem` | Operating system | "Windows", "iOS", "Android" |
| `browser` | Browser name | "Chrome", "Safari", "Firefox" |
| `source` | Traffic source | "google", "direct", "facebook" |
| `medium` | Traffic medium | "organic", "cpc", "referral" |
| `campaign` | Campaign name | "summer_sale", "brand_awareness" |

#### Error Responses

**400 Bad Request - Parameter Validation Failed:**
```json
{
  "success": false,
  "error": "Failed to fetch conversion metrics",
  "message": "Parameter validation failed: Property ID must start with \"properties/\" (e.g., \"properties/123456789\")",
  "endpoint": "getConversionMetrics",
  "propertyId": "invalid-property-id",
  "timestamp": "2025-07-29T07:21:40.245Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {}
  }
}
```

**403 Forbidden - Access Denied:**
```json
{
  "success": false,
  "error": "Failed to fetch conversion metrics",
  "message": "Access denied: Check that the service account has access to the GA4 property",
  "endpoint": "getConversionMetrics",
  "propertyId": "properties/123456789",
  "timestamp": "2025-07-29T07:21:46.826Z",
  "requestInfo": {
    "authenticatedUser": "developer@localhost",
    "parametersReceived": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-07"
    }
  }
}
```

#### Common Use Cases

**Ecommerce Revenue Analysis:**
```bash
# Get purchase conversions with item details
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/conversions/properties%2F123456789?dimensions=itemName,itemCategory"
```

**Lead Generation Tracking:**
```bash
# Get sign-up and contact conversions
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/conversions/properties%2F123456789?dimensions=source,medium"
```

**Campaign Performance:**
```bash
# Get conversions by campaign and source
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/conversions/properties%2F123456789?dimensions=campaign,source,medium"
```

---

## Upcoming Endpoints

**Note**: All core GA4 data fetching endpoints (Sessions, Users, Traffic Sources, Page Performance, Conversions) are now implemented. 

The remaining development work focuses on:

### Phase 5.3.6: Parameter Validation and Common Utilities
- **Status**: Pending
- **Description**: Implement comprehensive input validation for all functions, add common error handling, and create shared utility functions for enhanced reliability and maintainability

---

## Common Use Cases

### Daily Dashboard Data
```bash
# Get yesterday's session metrics
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/sessions/properties%2F123456789?startDate=2025-01-28&endDate=2025-01-28"
```

### Weekly Report Data  
```bash
# Get last 7 days with country breakdown
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/sessions/properties%2F123456789?dimensions=country&limit=200"
```

### Device Performance Analysis
```bash
# Get monthly data by device type
curl -H "X-API-Key: development-key" \
  "http://localhost:3001/api/ga4/sessions/properties%2F123456789?startDate=2025-01-01&endDate=2025-01-31&dimensions=deviceType"
```

---

## Technical Implementation Details

### Data Processing Pipeline
1. **Parameter Validation**: Validates property ID format and date ranges
2. **Authentication Check**: Verifies API key or OAuth token
3. **GA4 API Call**: Constructs and executes GA4 Data API request
4. **Data Transformation**: Normalizes response into consistent format
5. **Summary Calculation**: Aggregates metrics for quick insights
6. **Response Formatting**: Returns structured JSON with metadata

### Error Handling
- **Parameter validation** with descriptive error messages
- **GA4 API error mapping** to appropriate HTTP status codes
- **Comprehensive logging** for debugging and monitoring
- **Graceful degradation** for API quota and permission issues

### Performance Features
- **Configurable limits** to prevent large data transfers
- **Efficient data transformation** with streaming where possible
- **Detailed timing metrics** in logs for performance monitoring
- **Memory-conscious processing** for large datasets

---

## Rate Limiting & Quotas

The service respects Google Analytics 4 API quotas:
- **Standard quota**: 25,000 tokens per day
- **Requests per day**: 40,000 requests per day  
- **Requests per 100 seconds**: 2,000 requests per 100 seconds
- **Concurrent requests**: 10 concurrent requests

Rate limiting is enforced at the service level with 429 responses when quotas are exceeded.