// api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const RESTAURANT_URL = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:4001';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:4002';

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'api-gateway', status: 'healthy' });
});

// Proxy: Restaurant Service
app.use(
  '/api/restaurants',
  createProxyMiddleware({
    target: RESTAURANT_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/restaurants': '/restaurants' },
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000,
  })
);

// Proxy: Order Service
app.use(
  '/api/orders',
  createProxyMiddleware({
    target: ORDER_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/orders' },
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000,
  })
);

// Proxy: Orders theo user
app.use(
  '/api/users/:userId/orders',
  createProxyMiddleware({
    target: ORDER_URL,
    changeOrigin: true,
    pathRewrite: (path) => path.replace('/api/users', '/users'),
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000,
  })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
});
