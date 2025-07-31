// Simple test server to verify API connection logic
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Enable CORS for all origins (development only)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Info'],
  credentials: true
}));

app.use(express.json());

// Main health endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ Received request on /api/health from:', req.get('origin') || 'unknown origin');
  res.json({
    status: 'healthy',
    service: 'GA4 API Service (Test)',
    timestamp: new Date().toISOString(),
    message: 'Test server running successfully'
  });
});

// GA4 health endpoint
app.get('/api/ga4/health', (req, res) => {
  console.log('🔧 Received request on /api/ga4/health from:', req.get('origin') || 'unknown origin');
  res.json({
    status: 'healthy',
    service: 'GA4 Service',
    timestamp: new Date().toISOString(),
    ga4Client: 'test-mode'
  });
});

// Mock GA4 endpoints
app.get('/api/ga4/sessions/:propertyId', (req, res) => {
  res.json({
    success: true,
    data: {
      sessions: 8200,
      users: 6150,
      pageviews: 24680,
      bounceRate: 42.3,
      avgSessionDuration: 185,
      timeSeries: [
        { date: '2024-01-15', sessions: 1200, users: 950, pageviews: 3600 },
        { date: '2024-01-16', sessions: 1150, users: 890, pageviews: 3450 }
      ]
    }
  });
});

app.get('/api/ga4/traffic-sources/:propertyId', (req, res) => {
  res.json({
    success: true,
    data: [
      { source: 'google', medium: 'organic', sessions: 2850, users: 2200, percentage: 34.8 },
      { source: '(direct)', medium: '(none)', sessions: 1650, users: 1280, percentage: 20.1 }
    ]
  });
});

app.get('/api/ga4/page-performance/:propertyId', (req, res) => {
  res.json({
    success: true,
    data: [
      { pagePath: '/', pageviews: 5240, uniquePageviews: 4680, avgTimeOnPage: 145, bounceRate: 38.2 }
    ]
  });
});

app.get('/api/ga4/conversions/:propertyId', (req, res) => {
  res.json({
    success: true,
    data: [
      { conversionName: 'Purchase', conversions: 186, conversionRate: 2.27, conversionValue: 28650 }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`✅ Test GA4 API Service running on port ${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 GA4 Health: http://localhost:${PORT}/api/ga4/health`);
});