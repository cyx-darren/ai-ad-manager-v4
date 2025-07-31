# 🚀 GA4 API Service - Production Deployment Guide

> **Phase 5.2.5: Environment Variables & Security Configuration**  
> Complete guide for deploying the GA4 API Service to Railway with production-ready security.

## 📋 Pre-Deployment Checklist

### ✅ Prerequisites
- [ ] Railway account with billing enabled
- [ ] Google Cloud Platform project with GA4 Data API enabled
- [ ] Supabase project with OAuth 2.0 configured
- [ ] Google Analytics 4 property with read access
- [ ] Service account JSON file with GA4 permissions

### ✅ Local Validation
```bash
# 1. Validate environment configuration
npm run env:check

# 2. Run security checks
npm run security:check

# 3. Test service locally
npm run validate
```

---

## 🔧 Railway Deployment Setup

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Link to Railway Project
```bash
# If project exists:
railway link ravishing-passion

# If creating new project:
railway create ga4-api-service
```

### 3. Configure Environment Variables

**Required Production Variables:**
```bash
# Core Configuration
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set LOG_LEVEL=info

# API Security
railway variables set GA4_API_KEY="your-secure-32-char-api-key-here"

# Supabase Configuration
railway variables set SUPABASE_URL="https://your-project.supabase.co"
railway variables set SUPABASE_ANON_KEY="your-supabase-anon-key"

# Service URLs & CORS
railway variables set GA4_SERVICE_URL="https://your-service.railway.app"
railway variables set ALLOWED_ORIGINS="https://your-frontend.com,https://your-admin.com"

# OAuth Configuration
railway variables set OAUTH_REDIRECT_URLS="https://your-frontend.com/auth/callback"
railway variables set GOOGLE_OAUTH_SCOPES="https://www.googleapis.com/auth/analytics.readonly"

# Google Cloud Service Account
railway variables set GOOGLE_APPLICATION_CREDENTIALS="./ga4-service-account.json"
```

**Optional Performance Variables:**
```bash
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway variables set TOKEN_REFRESH_BUFFER_MS=300000
railway variables set MAX_TOKEN_REFRESH_RETRIES=3
railway variables set TOKEN_CACHE_TTL_MS=120000
```

### 4. Upload Service Account File
```bash
# Method 1: Via Railway dashboard (Recommended)
# 1. Go to Railway dashboard → Your project → Variables
# 2. Upload ga4-service-account.json as a file variable
# 3. Set GOOGLE_APPLICATION_CREDENTIALS to the file path

# Method 2: Via CLI (if supported)
railway variables set --file ga4-service-account.json
```

---

## 🚀 Deployment Process

### Automated Deployment (Recommended)
```bash
# Run the comprehensive deployment script
npm run deploy:production

# Or run manually:
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Manual Deployment
```bash
# 1. Validate local environment
npm run validate

# 2. Run security checks
npm run security:check

# 3. Deploy to Railway
railway up

# 4. Monitor deployment
railway logs --follow

# 5. Test deployment
curl https://your-service.railway.app/health
```

---

## 🔒 Security Configuration

### Production Security Checklist
- [ ] **Strong API Keys**: Use 32+ character random keys
- [ ] **HTTPS Only**: All URLs must use HTTPS
- [ ] **CORS Configured**: Only allow your frontend domains
- [ ] **No Debug Logs**: Set LOG_LEVEL=info in production
- [ ] **Service Account**: Properly uploaded and secured
- [ ] **Rate Limiting**: Enabled and configured
- [ ] **Error Handling**: Comprehensive error middleware
- [ ] **Monitoring**: Alerts configured for errors and uptime

### Security Validation
```bash
# Run comprehensive security check
node scripts/security-check.js

# Expected output for production:
# ✅ Security Score: 95+/100
# ✅ 0 CRITICAL issues
# ✅ Ready for deployment
```

---

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Check service status
railway status

# View real-time logs
railway logs --follow

# Check specific log timeframe
railway logs --since 1h
```

### Key Endpoints to Monitor
- **Health Check**: `https://your-service.railway.app/health`
- **Auth Status**: `https://your-service.railway.app/auth/status`
- **Token Health**: `https://your-service.railway.app/auth/token/health`

### Performance Metrics
```bash
# Service metrics
curl https://your-service.railway.app/health

# Expected response:
{
  "status": "healthy",
  "features": {
    "oauth2": true,
    "tokenRefresh": true,
    "autoRefresh": true,
    "tokenCache": true
  }
}
```

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### 1. Authentication Failures
```bash
# Check OAuth configuration
curl https://your-service.railway.app/auth/status

# Verify Supabase settings
railway variables get SUPABASE_URL
railway variables get SUPABASE_ANON_KEY
```

#### 2. GA4 API Connection Issues
```bash
# Test service account
railway variables get GOOGLE_APPLICATION_CREDENTIALS

# Check GA4 endpoint
curl -H "X-API-Key: your-api-key" https://your-service.railway.app/api/ga4/health
```

#### 3. Rate Limiting Issues
```bash
# Check rate limit configuration
railway variables get RATE_LIMIT_MAX_REQUESTS
railway variables get RATE_LIMIT_WINDOW_MS

# Monitor rate limit headers in responses
curl -I https://your-service.railway.app/api/ga4/health
```

#### 4. Token Management Issues
```bash
# Check token health
curl -H "Authorization: Bearer your-jwt-token" \
  https://your-service.railway.app/auth/token/health

# Clear token cache
curl -X DELETE https://your-service.railway.app/auth/cache
```

### Emergency Procedures

#### Rollback Deployment
```bash
# View deployment history
railway deployments

# Rollback to previous version
railway rollback <deployment-id>
```

#### Security Incident Response
```bash
# 1. Immediately rotate API keys
railway variables set GA4_API_KEY="new-secure-key"

# 2. Clear all token caches
curl -X DELETE https://your-service.railway.app/auth/cache

# 3. Review logs for suspicious activity
railway logs --since 24h | grep "ERROR\|WARN"

# 4. Update CORS if needed
railway variables set ALLOWED_ORIGINS="https://new-domain.com"
```

---

## 📈 Scaling & Performance

### Auto-scaling Configuration
The service includes auto-scaling configuration in `railway.json`:
- **Min Instances**: 1
- **Max Instances**: 5
- **CPU Target**: 70%
- **Memory Target**: 80%

### Performance Optimization
- **Token Caching**: 2-minute TTL reduces API calls
- **Rate Limiting**: Protects against abuse
- **Connection Pooling**: Efficient database connections
- **Health Checks**: 30-second timeout for reliability

---

## 🔄 Maintenance Schedule

### Weekly Tasks
- [ ] Review logs for errors or warnings
- [ ] Check security metrics and alerts
- [ ] Verify all endpoints are responding correctly
- [ ] Monitor token refresh rates and failures

### Monthly Tasks
- [ ] Rotate API keys and secrets
- [ ] Update dependencies (`npm audit`)
- [ ] Review and update CORS origins
- [ ] Check Railway usage and billing

### Quarterly Tasks
- [ ] Security audit and penetration testing
- [ ] Performance review and optimization
- [ ] Disaster recovery testing
- [ ] Documentation updates

---

## 📞 Support & Resources

### Documentation Links
- [Railway Documentation](https://docs.railway.app/)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)

### Service Architecture
```
Internet → Railway Load Balancer → GA4 API Service
                                      ↓
                                 Authentication Layer
                                      ↓
                                 Rate Limiting & Security
                                      ↓
                                 GA4 Data API / Supabase
```

### Contact Information
- **Primary Contact**: Development Team
- **Emergency Contact**: DevOps Team
- **Monitoring**: Railway Dashboard + Custom Alerts

---

**🎉 Deployment Complete!**

Your GA4 API Service is now running in production with:
- ✅ OAuth 2.0 Authentication (Supabase)
- ✅ Token Management & Auto-refresh
- ✅ Rate Limiting & Security Headers
- ✅ Comprehensive Error Handling
- ✅ Health Monitoring & Alerts
- ✅ Auto-scaling & Performance Optimization

**Next Steps**: Proceed with **Subtask 5.3** - Implement Core GA4 Data Fetching Functions