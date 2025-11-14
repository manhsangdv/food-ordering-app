// api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.disable('x-powered-by');
app.use(cors());

// Lưu lại raw body để re-stream về upstream (tránh Empty reply)
app.use(
  bodyParser.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
    limit: '2mb',
  })
);

const RESTAURANT_URL = process.env.RESTAURANT_SERVICE_URL || 'http://restaurant-service:4001';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:4002';

const restreamJsonBody = (proxyReq, req) => {
  // Xóa header Expect: 100-continue (thủ phạm khiến request bị treo)
  try {
    proxyReq.setHeader('Expect', '');
  } catch {}
  const bodyData =
    req.rawBody && req.rawBody.length
      ? req.rawBody
      : req.body && Object.keys(req.body).length
      ? Buffer.from(JSON.stringify(req.body))
      : null;

  if (bodyData) {
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
};

const onProxyError = (err, req, res) => {
  console.error('[gateway] proxy error:', err.code || err.message);
  if (!res.headersSent) {
    res.status(502).json({ error: 'Bad Gateway', code: err.code || 'PROXY_ERROR' });
  }
};

app.get('/health', (_req, res) => {
  res.json({ service: 'api-gateway', status: 'healthy' });
});

// Restaurant
app.use(
  '/api/restaurants',
  createProxyMiddleware({
    target: RESTAURANT_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/restaurants': '/restaurants' },
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000,
    onProxyReq: restreamJsonBody,
    onError: onProxyError,
  })
);

// Order
app.use(
  '/api/orders',
  createProxyMiddleware({
    target: ORDER_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/orders' },
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000,
    onProxyReq: restreamJsonBody,
    onError: onProxyError,
  })
);

// Orders theo user
app.use(
  '/api/users/:userId/orders',
  createProxyMiddleware({
    target: ORDER_URL,
    changeOrigin: true,
    pathRewrite: (path) => path.replace('/api/users', '/users'),
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000,
    onProxyReq: restreamJsonBody,
    onError: onProxyError,
  })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
  console.log(`[env] RESTAURANT_URL=${RESTAURANT_URL} | ORDER_URL=${ORDER_URL}`);
});
