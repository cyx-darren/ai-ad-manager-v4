const express = require('express');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { ga4DataClient } = require('../utils/ga4DataClient');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize GA4 client (will be enhanced in phase 5.2.3)
let analyticsDataClient;

try {
  analyticsDataClient = new BetaAnalyticsDataClient({
    // Will use GOOGLE_APPLICATION_CREDENTIALS environment variable
    // or credentials from Railway secrets
  });
  logger.info('GA4 Analytics Data Client initialized successfully');
} catch (error) {
  logger.error('Failed to initialize GA4 client:', error.message);
}

/**
 * Health check for GA4 service
 */
router.get('/health', async (req, res) => {
  try {
    // Test basic connectivity (will be enhanced in phase 5.2.3)
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ga4Client: analyticsDataClient ? 'initialized' : 'failed',
      authentication: req.auth?.authenticated ? 'valid' : 'invalid'
    };
    
    logger.info('GA4 health check requested', healthStatus);
    res.json(healthStatus);
  } catch (error) {
    logger.error('GA4 health check failed:', error.message);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test GA4 authentication
 */
router.get('/test-auth', async (req, res) => {
  try {
    if (!analyticsDataClient) {
      throw new Error('GA4 client not initialized');
    }

    // This will be enhanced in phase 5.2.3 with proper OAuth testing
    logger.info('GA4 authentication test requested');
    
    res.json({
      message: 'GA4 authentication test endpoint',
      status: 'ready',
      timestamp: new Date().toISOString(),
      clientInitialized: true,
      note: 'Full authentication testing will be implemented in phase 5.2.3'
    });
  } catch (error) {
    logger.error('GA4 authentication test failed:', error.message);
    res.status(500).json({
      error: 'Authentication test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Session metrics endpoint - Phase 5.3.1 Implementation
 * GET /api/ga4/sessions/:propertyId
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)
 * - endDate: End date in YYYY-MM-DD format (optional, defaults to today)
 * - dimensions: Comma-separated list of additional dimensions (optional)
 * - limit: Maximum number of rows to return (optional, default: 100)
 */
router.get('/sessions/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, dimensions, limit } = req.query;

    logger.info('Session metrics request received', {
      propertyId,
      startDate,
      endDate,
      dimensions,
      limit,
      userId: req.auth?.user?.id
    });

    // Parse optional parameters
    const options = {};
    
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit, 10);
    if (dimensions) {
      options.dimensions = dimensions.split(',').map(d => d.trim());
    }

    // Fetch session metrics using GA4DataClient
    const sessionMetrics = await ga4DataClient.getSessionMetrics(propertyId, options);

    // Return successful response
    res.json({
      success: true,
      endpoint: 'getSessionMetrics',
      propertyId: propertyId,
      ...sessionMetrics,
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        requestTime: new Date().toISOString(),
        parametersUsed: options
      }
    });

  } catch (error) {
    logger.error('Session metrics request failed:', {
      error: error.message,
      propertyId: req.params.propertyId,
      query: req.query,
      userId: req.auth?.user?.id
    });

    // Return error response with appropriate status code
    const statusCode = error.message.includes('Parameter validation failed') ? 400 :
                      error.message.includes('Access denied') ? 403 :
                      error.message.includes('API quota exceeded') ? 429 :
                      500;

    res.status(statusCode).json({
      success: false,
      error: 'Failed to fetch session metrics',
      message: error.message,
      endpoint: 'getSessionMetrics',
      propertyId: req.params.propertyId,
      timestamp: new Date().toISOString(),
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        parametersReceived: req.query
      }
    });
  }
});

// User metrics endpoint - Phase 5.3.2 Implementation
// GET /api/ga4/users/:propertyId
//
// Query Parameters:
// - startDate: Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)
// - endDate: End date in YYYY-MM-DD format (optional, defaults to today)
// - dimensions: Comma-separated list of additional dimensions (optional)
// - limit: Maximum number of rows to return (optional, default: 100)
router.get('/users/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, dimensions, limit } = req.query;

    logger.info('User metrics request received', {
      propertyId,
      startDate,
      endDate,
      dimensions,
      limit,
      userId: req.auth?.user?.id
    });

    // Parse optional parameters
    const options = {};
    
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit, 10);
    if (dimensions) {
      options.dimensions = dimensions.split(',').map(d => d.trim());
    }

    // Fetch user metrics using GA4DataClient
    const userMetrics = await ga4DataClient.getUserMetrics(propertyId, options);

    // Return successful response
    res.json({
      success: true,
      endpoint: 'getUserMetrics',
      propertyId: propertyId,
      ...userMetrics,
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        requestTime: new Date().toISOString(),
        parametersUsed: options
      }
    });

  } catch (error) {
    logger.error('User metrics request failed:', {
      error: error.message,
      propertyId: req.params.propertyId,
      query: req.query,
      userId: req.auth?.user?.id
    });

    // Return error response with appropriate status code
    const statusCode = error.message.includes('Parameter validation failed') ? 400 :
                      error.message.includes('Access denied') ? 403 :
                      error.message.includes('API quota exceeded') ? 429 :
                      500;

    res.status(statusCode).json({
      success: false,
      error: 'Failed to fetch user metrics',
      message: error.message,
      endpoint: 'getUserMetrics',
      propertyId: req.params.propertyId,
      timestamp: new Date().toISOString(),
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        parametersReceived: req.query
      }
    });
  }
});

// Traffic source breakdown endpoint - Phase 5.3.3 Implementation
// GET /api/ga4/traffic-sources/:propertyId
//
// Query Parameters:
// - startDate: Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)
// - endDate: End date in YYYY-MM-DD format (optional, defaults to today)
// - dimensions: Comma-separated list of additional dimensions (optional)
// - limit: Maximum number of rows to return (optional, default: 100)
router.get('/traffic-sources/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, dimensions, limit } = req.query;

    logger.info('Traffic source breakdown request received', {
      propertyId,
      startDate,
      endDate,
      dimensions,
      limit,
      userId: req.auth?.user?.id
    });

    // Parse optional parameters
    const options = {};
    
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit, 10);
    if (dimensions) {
      options.dimensions = dimensions.split(',').map(d => d.trim());
    }

    // Fetch traffic source breakdown using GA4DataClient
    const trafficSourceData = await ga4DataClient.getTrafficSourceBreakdown(propertyId, options);

    // Return successful response
    res.json({
      success: true,
      endpoint: 'getTrafficSourceBreakdown',
      propertyId: propertyId,
      ...trafficSourceData,
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        requestTime: new Date().toISOString(),
        parametersUsed: options
      }
    });

  } catch (error) {
    logger.error('Traffic source breakdown request failed:', {
      error: error.message,
      propertyId: req.params.propertyId,
      query: req.query,
      userId: req.auth?.user?.id
    });

    // Return error response with appropriate status code
    const statusCode = error.message.includes('Parameter validation failed') ? 400 :
                      error.message.includes('Access denied') ? 403 :
                      error.message.includes('API quota exceeded') ? 429 :
                      500;

    res.status(statusCode).json({
      success: false,
      error: 'Failed to fetch traffic source breakdown',
      message: error.message,
      endpoint: 'getTrafficSourceBreakdown',
      propertyId: req.params.propertyId,
      timestamp: new Date().toISOString(),
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        parametersReceived: req.query
      }
    });
  }
});

// Page performance endpoint - Phase 5.3.4 Implementation
// GET /api/ga4/page-performance/:propertyId
//
// Query Parameters:
// - startDate: Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)
// - endDate: End date in YYYY-MM-DD format (optional, defaults to today)
// - dimensions: Comma-separated list of additional dimensions (optional)
// - limit: Maximum number of rows to return (optional, default: 100)
router.get('/page-performance/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, dimensions, limit } = req.query;

    logger.info('Page performance request received', {
      propertyId,
      startDate,
      endDate,
      dimensions,
      limit,
      userId: req.auth?.user?.id
    });

    // Parse optional parameters
    const options = {};
    
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit, 10);
    if (dimensions) {
      options.dimensions = dimensions.split(',').map(d => d.trim());
    }

    // Fetch page performance metrics using GA4DataClient
    const pagePerformanceData = await ga4DataClient.getPagePerformance(propertyId, options);

    // Return successful response
    res.json({
      success: true,
      endpoint: 'getPagePerformance',
      propertyId: propertyId,
      ...pagePerformanceData,
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        requestTime: new Date().toISOString(),
        parametersUsed: options
      }
    });

  } catch (error) {
    logger.error('Page performance request failed:', {
      error: error.message,
      propertyId: req.params.propertyId,
      query: req.query,
      userId: req.auth?.user?.id
    });

    // Return error response with appropriate status code
    const statusCode = error.message.includes('Parameter validation failed') ? 400 :
                      error.message.includes('Access denied') ? 403 :
                      error.message.includes('API quota exceeded') ? 429 :
                      500;

    res.status(statusCode).json({
      success: false,
      error: 'Failed to fetch page performance metrics',
      message: error.message,
      endpoint: 'getPagePerformance',
      propertyId: req.params.propertyId,
      timestamp: new Date().toISOString(),
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        parametersReceived: req.query
      }
    });
  }
});

// Conversions endpoint - Phase 5.3.5 Implementation
// GET /api/ga4/conversions/:propertyId
//
// Query Parameters:
// - startDate: Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)
// - endDate: End date in YYYY-MM-DD format (optional, defaults to today)
// - dimensions: Comma-separated list of additional dimensions (optional)
// - limit: Maximum number of rows to return (optional, default: 100)
router.get('/conversions/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate, dimensions, limit } = req.query;

    logger.info('Conversion metrics request received', {
      propertyId,
      startDate,
      endDate,
      dimensions,
      limit,
      userId: req.auth?.user?.id
    });

    // Parse optional parameters
    const options = {};
    
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit, 10);
    if (dimensions) {
      options.dimensions = dimensions.split(',').map(d => d.trim());
    }

    // Fetch conversion metrics using GA4DataClient
    const conversionData = await ga4DataClient.getConversionMetrics(propertyId, options);

    // Return successful response
    res.json({
      success: true,
      endpoint: 'getConversionMetrics',
      propertyId: propertyId,
      ...conversionData,
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        requestTime: new Date().toISOString(),
        parametersUsed: options
      }
    });

  } catch (error) {
    logger.error('Conversion metrics request failed:', {
      error: error.message,
      propertyId: req.params.propertyId,
      query: req.query,
      userId: req.auth?.user?.id
    });

    // Return error response with appropriate status code
    const statusCode = error.message.includes('Parameter validation failed') ? 400 :
                      error.message.includes('Access denied') ? 403 :
                      error.message.includes('API quota exceeded') ? 429 :
                      500;

    res.status(statusCode).json({
      success: false,
      error: 'Failed to fetch conversion metrics',
      message: error.message,
      endpoint: 'getConversionMetrics',
      propertyId: req.params.propertyId,
      timestamp: new Date().toISOString(),
      requestInfo: {
        authenticatedUser: req.auth?.user?.email || 'API Key',
        parametersReceived: req.query
      }
    });
  }
});

module.exports = router;