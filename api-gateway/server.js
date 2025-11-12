// api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());
// Vẫn giữ JSON để các route /health hoặc route nội bộ khác dùng,
// nhưng với proxy POST/PUT ta sẽ re-stream body bằng onProxyReq.
app.use(express.json());

const RESTAURANT_URL = process.env.RESTAURANT_SERVICE_URL || 'http://restaurant-service:4001';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:4002';

// helper: re-stream JSON body (fix "Empty reply from server")
function restreamJsonBody(proxyReq, req) {
  if (!req.body || !Object.keys(req.body).length) return;
  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

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
    onProxyReq: (proxyReq, req) => restreamJsonBody(proxyReq, req),
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
    onProxyReq: (proxyReq, req) => restreamJsonBody(proxyReq, req),
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
    onProxyReq: (proxyReq, req) => restreamJsonBody(proxyReq, req),
  })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
});
