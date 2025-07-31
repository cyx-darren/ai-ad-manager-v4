const express = require('express');
const app = express();
const PORT = 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'GA4 service is running', port: PORT });
});

app.get('/', (req, res) => {
  res.json({ message: 'GA4 API Service Test', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Test GA4 service running on port ${PORT}`);
});
