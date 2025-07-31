const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'GA4 API Service (Simplified)',
    port: PORT
  });
});

// Basic API endpoints
app.get('/api/ga4/test', (req, res) => {
  res.json({
    message: 'GA4 API Service is running',
    note: 'This is a simplified version for testing'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GA4 API Service (Simplified) running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Test endpoint: http://localhost:${PORT}/api/ga4/test`);
});