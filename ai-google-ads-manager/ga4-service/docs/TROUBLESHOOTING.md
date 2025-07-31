# GA4 API Service - Troubleshooting Guide

## Table of Contents
1. [Service Startup Issues](#service-startup-issues)
2. [Authentication Problems](#authentication-problems)
3. [Rate Limiting Issues](#rate-limiting-issues)
4. [Quota Management Problems](#quota-management-problems)
5. [Cache Issues](#cache-issues)
6. [Performance Problems](#performance-problems)
7. [Error Analysis](#error-analysis)
8. [Network Connectivity](#network-connectivity)
9. [Development Environment](#development-environment)
10. [Production Deployment](#production-deployment)

---

## Service Startup Issues

### Problem: Server Won't Start
**Symptoms:**
- Port 3001 already in use
- Import/module errors
- Environment variable errors

**Diagnostic Steps:**
```bash
# Check if port is in use
lsof -ti:3001

# Check for existing server processes
ps aux | grep "node server.js"

# View detailed startup logs
node server.js 2>&1 | tee startup.log
```

**Solutions:**
1. **Port Conflict:**
   ```bash
   # Kill existing process
   kill $(lsof -ti:3001)
   # Or use different port
   PORT=3002 node server.js
   ```

2. **Missing Dependencies:**
   ```bash
   npm install
   npm audit fix --force
   ```

3. **Environment Variables:**
   ```bash
   # Copy and configure environment
   cp env.example.txt .env
   # Edit .env with your values
   ```

### Problem: Redis Connection Timeout
**Symptoms:**
- Long startup delays
- Redis timeout errors
- Service starts but cache disabled

**Solutions:**
1. **Disable Redis for Local Development:**
   ```bash
   REDIS_HOST=disabled node server.js
   ```

2. **Configure Redis Timeout:**
   ```javascript
   // In redisClient.js
   connectTimeout: 5000,  // 5 second timeout
   commandTimeout: 3000   // 3 second command timeout
   ```

---

## Authentication Problems

### Problem: OAuth 2.0 Flow Fails
**Symptoms:**
- HTTP 401 on protected endpoints
- Redirect loop during login
- Invalid token errors

**Diagnostic Steps:**
```bash
# Check OAuth status
curl -H "X-API-Key: development-key" \
  http://localhost:3001/auth/status

# Test login endpoint
curl -i http://localhost:3001/auth/login
```

**Solutions:**
1. **Google OAuth Configuration:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Check authorized redirect URIs in Google Console
   - Ensure callback URL matches: `http://localhost:3001/auth/callback`

2. **Supabase Configuration:**
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Check Supabase OAuth provider settings
   - Ensure proper JWT configuration

### Problem: API Key Authentication Fails
**Symptoms:**
- HTTP 401 with valid-looking API key
- "Invalid API key" errors

**Solutions:**
1. **Development Key:**
   ```bash
   # Ensure using correct development key
   curl -H "X-API-Key: development-key" \
     http://localhost:3001/health
   ```

2. **Production API Keys:**
   - Verify key format and validity
   - Check key permissions in admin panel
   - Ensure key hasn't expired

---

## Rate Limiting Issues

### Problem: Unexpected Rate Limiting
**Symptoms:**
- HTTP 429 errors with light usage
- Rate limits reached too quickly
- Inconsistent rate limit behavior

**Diagnostic Steps:**
```bash
# Check current rate limit status
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/rate-limits

# View rate limit configuration
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/rate-limit-config

# Test rate limiting behavior
curl -X POST -H "X-API-Key: development-key" \
  -H "Content-Type: application/json" \
  -d '{"category":"ga4-general","requestCount":5}' \
  http://localhost:3001/cache/rate-limit-test-dev
```

**Solutions:**
1. **Token Bucket Exhaustion:**
   - Check `utilizationPercent` in status response
   - Wait for token refill (check `refillRate`)
   - Implement proper retry logic with exponential backoff

2. **Category Misconfiguration:**
   ```javascript
   // Verify correct category usage
   // ga4-core-reporting: 100/min
   // ga4-realtime: 60/min  
   // ga4-general: 200/min
   // per-user: 10/sec
   ```

3. **Per-User Rate Limiting:**
   - Multiple users sharing same session
   - Implement proper user identification
   - Consider increasing per-user limits

### Problem: Rate Limit Headers Missing
**Symptoms:**
- No `X-RateLimit-*` headers in responses
- Cannot implement proper client-side backoff

**Solutions:**
1. **Verify Middleware Order:**
   ```javascript
   // Ensure rate limit headers middleware is applied
   app.use(rateLimitHeadersMiddleware);
   ```

2. **Check CORS Configuration:**
   ```javascript
   // Ensure rate limit headers are exposed
   exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After']
   ```

---

## Quota Management Problems

### Problem: Quota Exhaustion
**Symptoms:**
- HTTP 429 with quota error codes
- Daily/hourly limits reached
- Cannot make any requests

**Diagnostic Steps:**
```bash
# Check current quota usage
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/quota-status

# Check for active alerts
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/quota-alerts
```

**Solutions:**
1. **Wait for Reset:**
   - Check `timeToReset` in quota status
   - Daily quotas reset at midnight UTC
   - Hourly quotas reset at top of hour

2. **Optimize Query Patterns:**
   - Use smaller date ranges
   - Reduce dimension count
   - Implement data aggregation
   - Cache frequently requested data

3. **Development Quota Reset:**
   ```bash
   # Reset all quotas (development only)
   curl -X POST -H "X-API-Key: development-key" \
     -H "Content-Type: application/json" \
     -d '{"quotaType":"all"}' \
     http://localhost:3001/cache/quota-reset-dev
   ```

### Problem: Quota Alerts Not Working
**Symptoms:**
- No alerts at high usage levels
- Missing critical quota notifications
- Alert callbacks not triggering

**Solutions:**
1. **Check Alert Configuration:**
   ```javascript
   // Verify warning thresholds
   warningThresholds: {
     yellow: 70,  // 70% usage
     red: 90      // 90% usage
   }
   ```

2. **Register Alert Callbacks:**
   ```javascript
   quotaTracker.onAlert((alert) => {
     console.warn('Quota alert:', alert);
     // Implement notification logic
   });
   ```

---

## Cache Issues

### Problem: Poor Cache Hit Rate
**Symptoms:**
- Low cache hit percentages
- Slow response times
- High GA4 API usage

**Diagnostic Steps:**
```bash
# Check cache performance
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/performance

# View cache statistics
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/status
```

**Solutions:**
1. **Cache Key Analysis:**
   - Ensure consistent parameter ordering
   - Verify date format standardization
   - Check for unnecessary parameter variations

2. **TTL Optimization:**
   ```javascript
   // Adjust cache TTL based on data type
   sessions: 1800,      // 30 minutes
   users: 3600,         // 1 hour
   traffic: 1800,       // 30 minutes
   conversions: 7200    // 2 hours
   ```

3. **Cache Warming:**
   ```bash
   # Pre-warm cache for common queries
   curl -X POST -H "X-API-Key: development-key" \
     -H "Content-Type: application/json" \
     -d '{"properties":["properties/123"],"dataTypes":["sessions"]}' \
     http://localhost:3001/cache/warm
   ```

### Problem: Cache Invalidation Issues
**Symptoms:**
- Stale data being served
- Cache not updating after data changes
- Inconsistent data across requests

**Solutions:**
1. **Manual Cache Clear:**
   ```bash
   # Clear all cache
   curl -X DELETE -H "X-API-Key: development-key" \
     http://localhost:3001/cache/clear

   # Clear specific property
   curl -X DELETE -H "X-API-Key: development-key" \
     http://localhost:3001/cache/invalidate/properties/123456789
   ```

2. **Smart Invalidation:**
   ```bash
   # Invalidate related data
   curl -X POST -H "X-API-Key: development-key" \
     -H "Content-Type: application/json" \
     -d '{"dataType":"sessions","options":{"cascade":true}}' \
     http://localhost:3001/cache/smart-invalidate/properties/123456789
   ```

---

## Performance Problems

### Problem: Slow Response Times
**Symptoms:**
- Response times > 5 seconds
- Timeout errors
- Poor user experience

**Diagnostic Steps:**
```bash
# Monitor performance metrics
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/analytics/report

# Check error statistics
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/error-stats-dev
```

**Solutions:**
1. **Query Optimization:**
   - Reduce date range size
   - Limit dimensions and metrics
   - Use appropriate filters
   - Implement pagination

2. **Cache Strategy:**
   - Increase cache TTL for stable data
   - Implement cache warming
   - Use background refresh patterns

3. **Connection Pooling:**
   ```javascript
   // Optimize GA4 client configuration
   maxRetries: 3,
   requestTimeout: 30000,
   retryDelayBase: 1000
   ```

### Problem: Memory Usage High
**Symptoms:**
- Increasing memory consumption
- Out of memory errors
- Slow garbage collection

**Solutions:**
1. **Cache Size Limits:**
   ```javascript
   // Implement cache size limits
   maxCacheSize: 1000,  // Maximum cached items
   maxMemoryUsage: '512MB'
   ```

2. **Memory Monitoring:**
   ```bash
   # Monitor Node.js memory usage
   node --max-old-space-size=2048 server.js
   ```

---

## Error Analysis

### Problem: High Error Rates
**Symptoms:**
- Many 5xx errors
- Frequent retry attempts
- Failed requests

**Diagnostic Steps:**
```bash
# View error statistics
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/error-stats-dev

# Test error handling
curl -X POST -H "X-API-Key: development-key" \
  -H "Content-Type: application/json" \
  -d '{"errorType":"network","testRetry":true}' \
  http://localhost:3001/cache/test-error-dev
```

**Solutions:**
1. **Retry Logic Tuning:**
   ```javascript
   // Adjust retry configuration
   maxRetries: 3,
   baseDelay: 1000,
   maxDelay: 60000,
   jitterPercent: 25
   ```

2. **Error Classification:**
   - Ensure retryable vs non-retryable errors
   - Implement circuit breaker patterns
   - Add proper error logging

### Problem: Inconsistent Error Responses
**Symptoms:**
- Mixed error formats
- Missing error details
- Unclear error messages

**Solutions:**
1. **Standardize Error Format:**
   ```javascript
   {
     "success": false,
     "error": "ERROR_CODE",
     "message": "Human-readable description",
     "details": { /* Additional context */ }
   }
   ```

---

## Network Connectivity

### Problem: GA4 API Connectivity
**Symptoms:**
- Network timeout errors
- DNS resolution failures
- SSL/TLS errors

**Diagnostic Steps:**
```bash
# Test GA4 API connectivity
curl -I https://analyticsdata.googleapis.com

# Check DNS resolution
nslookup analyticsdata.googleapis.com

# Test with verbose output
curl -v https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport
```

**Solutions:**
1. **Network Configuration:**
   - Verify firewall rules
   - Check proxy settings
   - Ensure DNS resolution works

2. **SSL/TLS Issues:**
   ```bash
   # Update certificates
   npm update
   # Or specify Node.js TLS settings
   NODE_TLS_REJECT_UNAUTHORIZED=0 node server.js  # Dev only!
   ```

---

## Development Environment

### Problem: Development Setup Issues
**Symptoms:**
- Cannot replicate production issues
- Different behavior in dev vs prod
- Missing development tools

**Solutions:**
1. **Environment Parity:**
   ```bash
   # Use production-like configuration
   NODE_ENV=production-like node server.js
   ```

2. **Development Tools:**
   ```bash
   # Enable all development endpoints
   NODE_ENV=development node server.js
   ```

3. **Debug Mode:**
   ```bash
   # Enable detailed logging
   DEBUG=ga4:* node server.js
   ```

---

## Production Deployment

### Problem: Production Configuration
**Symptoms:**
- Service works in dev but fails in production
- Performance degradation
- Security issues

**Solutions:**
1. **Environment Variables:**
   ```bash
   # Production environment setup
   NODE_ENV=production
   REDIS_URL=redis://production-redis:6379
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

2. **Security Configuration:**
   ```javascript
   // Production security settings
   helmet: true,
   rateLimiting: true,
   cors: { origin: ['https://yourdomain.com'] }
   ```

3. **Monitoring Setup:**
   - Configure error tracking (e.g., Sentry)
   - Set up performance monitoring
   - Implement health checks
   - Configure log aggregation

---

## Common Command Reference

### Quick Diagnostics
```bash
# Service health
curl http://localhost:3001/health

# Full system status
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/rate-limits && \
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/quota-status && \
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/status

# Performance check
curl -H "X-API-Key: development-key" \
  http://localhost:3001/cache/performance
```

### Reset Commands (Development)
```bash
# Reset all quotas
curl -X POST -H "X-API-Key: development-key" \
  -d '{"quotaType":"all"}' \
  http://localhost:3001/cache/quota-reset-dev

# Clear all cache
curl -X DELETE -H "X-API-Key: development-key" \
  http://localhost:3001/cache/clear

# Reset rate limit statistics
curl -X POST -H "X-API-Key: development-key" \
  http://localhost:3001/cache/rate-limit-reset-dev
```

## Getting Help

1. **Check Service Logs:** Always start with server logs for error details
2. **Use Development Tools:** Leverage built-in testing and monitoring endpoints
3. **Monitor System Resources:** Check CPU, memory, and network usage
4. **Test Incrementally:** Isolate issues by testing individual components
5. **Verify Configuration:** Double-check environment variables and configuration files

## Support Information

- **Documentation:** `/docs/API_DOCUMENTATION.md`
- **Quick Reference:** `/docs/QUICK_REFERENCE.md`
- **Development Tools:** Available at `/cache/*-dev` endpoints
- **Health Checks:** Available at `/health` and `/cache/health`