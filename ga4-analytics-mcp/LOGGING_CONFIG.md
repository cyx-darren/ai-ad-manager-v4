# Production Logging Configuration

This document outlines the production logging infrastructure for the GA4 Analytics MCP Server.

## Environment Variables

### Core Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment (development, production, staging, test) |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Minimum log level to output (error, warn, info, http, debug) |
| `LOG_DIR` | `./logs` | Directory for log files (production only) |
| `LOG_RETENTION_DAYS` | `30` | Number of days to retain log files |
| `LOG_MAX_SIZE` | `20m` | Maximum size per log file before rotation |
| `LOG_MAX_FILES` | `14` | Maximum number of archived log files |

### Security & Features

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_SENSITIVE_DATA` | `false` | **NEVER enable in production** - logs sensitive data |
| `ENABLE_REQUEST_LOGGING` | `true` | Enable HTTP request/response logging |
| `ENABLE_GA4_API_LOGGING` | `true` | Enable GA4 API call logging |
| `ENABLE_AUTH_LOGGING` | `true` | Enable authentication event logging |
| `ENABLE_PERFORMANCE_LOGGING` | `true` | Enable performance metrics logging |

## Log Levels

- **error**: System errors, failures, exceptions
- **warn**: Warning conditions, slow operations, potential issues
- **info**: General information, successful operations, startup/shutdown
- **http**: HTTP requests and responses (production file logging only)
- **debug**: Detailed debugging information (development only)

## Log Formats

### Development (Console)
```
HH:mm:ss [level] [correlationId] [component] method (duration): message
```

### Production (JSON)
```json
{
  "timestamp": "2025-08-02T10:00:00.000Z",
  "level": "info",
  "message": "MCP Tool completed: query_analytics",
  "correlationId": "abc123de-f456-789g-h012-345678901234",
  "component": "MCP_TOOLS",
  "method": "POST",
  "duration": 245,
  "environment": "production",
  "service": "ga4-analytics-mcp"
}
```

## Log Files (Production)

### File Structure
```
logs/
├── error-2025-08-02.log      # Error logs only
├── combined-2025-08-02.log   # All logs
├── http-2025-08-02.log       # HTTP request/response logs
└── archived/                 # Compressed older logs
```

### Rotation Policy
- **Daily rotation**: New file created each day
- **Size limits**: Files rotated when exceeding `LOG_MAX_SIZE`
- **Compression**: Archived files are gzipped
- **Retention**: Old files deleted after `LOG_RETENTION_DAYS`

## Correlation IDs

Every request is assigned a unique correlation ID for request tracing:
- **Format**: UUID v4 (e.g., `abc123de-f456-789g-h012-345678901234`)
- **Propagation**: Included in all related log entries
- **Headers**: Available in HTTP responses as `x-correlation-id`
- **MCP Tools**: Each tool call gets a unique correlation ID

## Security Features

### Data Sanitization
Sensitive fields are automatically redacted in logs:
- `password`, `token`, `secret`, `key`
- `authorization`, `api_key`, `access_token`
- `refresh_token`, `client_secret`, `private_key`
- `credential`, `auth`, `bearer`

### Safe Logging
```typescript
// Unsafe (sensitive data exposed)
logger.info('User login', { password: 'secret123' });

// Safe (automatically redacted)
logger.info('User login', { password: '[REDACTED]' });
```

## Component Logging

### MCP Tools
```typescript
// Tool execution with correlation ID
logger.info('MCP Tool invoked: query_analytics', {
  correlationId: 'abc123...',
  component: 'MCP_TOOLS',
  toolName: 'query_analytics',
  args: { /* sanitized arguments */ }
});
```

### GA4 API Calls
```typescript
// API request logging
logger.logGA4Request('/api/ga4/reports', {
  propertyId: 'GA_PROPERTY_ID',
  metrics: ['sessions', 'users'],
  dimensions: ['country']
});

// API response logging
logger.logGA4Response('/api/ga4/reports', true, 245, {
  responseSize: 1024,
  fromCache: false
});
```

### Authentication Events
```typescript
// Authentication success
logger.logAuth('token_refresh', true, 'user123', {
  tokenExpiry: '2025-08-02T11:00:00Z'
});

// Authentication failure
logger.logAuth('login', false, undefined, {
  reason: 'invalid_credentials',
  ip: '192.168.1.1'
});
```

### Health Checks
```typescript
logger.logHealthCheck('healthy', {
  uptime: 3600000,
  memoryUsage: '245MB',
  activeConnections: 12
});
```

### Performance Monitoring
```typescript
logger.logPerformance('GA4 API Query', 245, {
  endpoint: '/api/ga4/reports',
  cached: false,
  resultSize: 1024
});
```

## Error Logging

### Structured Error Information
```typescript
logger.error('GA4 API request failed', error, {
  correlationId: 'abc123...',
  component: 'GA4_API',
  endpoint: '/api/ga4/reports',
  statusCode: 500,
  retryAttempt: 2
});
```

### Error Context
- **Stack traces**: Full stack traces in development
- **Error correlation**: Link errors to specific requests
- **Recovery actions**: Log automatic recovery attempts
- **User impact**: Track user-facing vs internal errors

## Monitoring Integration

### Health Check Endpoints
- `GET /health` - Basic health status
- `GET /health/detailed` - Comprehensive health check
- `GET /metrics` - Performance metrics
- `GET /diagnostics` - Detailed diagnostics (development only)

### Performance Metrics
- Request/response times
- Memory usage
- API call success/failure rates
- Cache hit/miss ratios
- Active connection counts

## Best Practices

### Development
1. Use `debug` level for detailed tracing
2. Enable console logging for immediate feedback
3. Use correlation IDs to trace request flows
4. Test logging with various error scenarios

### Production
1. Set `LOG_LEVEL=info` or `LOG_LEVEL=warn`
2. Monitor log file sizes and rotation
3. Set up log aggregation (ELK, Splunk, etc.)
4. Configure alerting on error patterns
5. Never log sensitive data

### Performance
1. Avoid logging large objects in hot paths
2. Use structured logging for machine parsing
3. Buffer logs in high-throughput scenarios
4. Monitor logging overhead

## Troubleshooting

### Common Issues

**Logs not appearing in production**
- Check `LOG_LEVEL` setting
- Verify `LOG_DIR` exists and is writable
- Check file permissions

**High log volume**
- Reduce `LOG_LEVEL` to `warn` or `error`
- Disable non-essential logging features
- Implement log sampling for high-volume endpoints

**Log rotation not working**
- Verify `LOG_RETENTION_DAYS` and `LOG_MAX_SIZE`
- Check disk space
- Ensure write permissions to log directory

**Missing correlation IDs**
- Verify correlation ID middleware is enabled
- Check if correlation ID is being set in request headers
- Ensure correlation ID propagation through async operations

## Example Configuration

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_DEBUG_LOGGING=true
LOG_DETAILED_ERRORS=true
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_DIR=/var/log/ga4-analytics-mcp
LOG_RETENTION_DAYS=90
LOG_MAX_SIZE=50m
LOG_MAX_FILES=30
ENABLE_REQUEST_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=true
LOG_SENSITIVE_DATA=false
```

### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=debug
LOG_RETENTION_DAYS=7
ENABLE_DEBUG_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=true
```