const { createProxyMiddleware } = require('http-proxy-middleware');

const API_PROXY_TARGET =
  process.env.REACT_APP_API_PROXY_TARGET || 'https://localhost:7178';

module.exports = function(app) {
  app.use(
    createProxyMiddleware({
      target: API_PROXY_TARGET,
      changeOrigin: true,
      secure: false,
      pathFilter: ['/api/**', '/images/**', '/uploads/**'],
      on: {
        proxyReq: function(proxyReq) {
          proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
        },
      },
    })
  );
};
