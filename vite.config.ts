import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://4b24-2607-fb90-ada4-c4c7-5554-1f09-ea62-6bd5.ngrok-free.app',
        changeOrigin: true,
        rewrite: (path) => '/album_query',
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add headers that might help with CORS
            proxyReq.setHeader('Origin', 'http://localhost:5173');
            proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
            proxyReq.setHeader('Content-Type', 'application/json');
            
            // Log the request details
            console.log('Proxying:', {
              from: req.url,
              to: proxyReq.path,
              method: req.method,
              headers: proxyReq.getHeaders()
            });
          });
          proxy.on('error', (err, _req, _res) => {
            console.error('Proxy error:', err);
          });
        },
        secure: false
      }
    }
  }
})
