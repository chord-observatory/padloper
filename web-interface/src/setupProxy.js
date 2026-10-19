const { createProxyMiddleware } = require('http-proxy-middleware');

// Dev-only request proxying for `react-scripts start` (CRA dev server on 4301).
// In production these routes are handled by nginx (see nginx.conf); this file
// is NOT included in the production build. It lets the SPA reach the Flask
// backend (4300) when running locally without Docker/nginx. Override the
// target with API_URL. Without the authenticating proxy, set
// PADLOPER_DEV_USER for the backend to act as a fixed user.
const API_TARGET = `${process.env.API_URL || "http://127.0.0.1"}:4300`;

module.exports = function(app) {
  // --- Flask backend (/api) ---
  app.use(
    '/api',
    createProxyMiddleware({
      target: API_TARGET,
      changeOrigin: true,
    })
  );
  // Support running the SPA under a base path during local dev
  app.use(
    '/padloper/api',
    createProxyMiddleware({
      target: API_TARGET,
      changeOrigin: true,
      pathRewrite: { '^/padloper': '' },
    })
  );
};
