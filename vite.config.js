import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// UPDATED (React migration, Module 1): the existing Express backend uses an
// httpOnly session cookie (see server.js `SESSION_COOKIE`), not a bearer
// token — so cross-origin requests from the Vite dev server (localhost:5173)
// to Express (localhost:3000) would otherwise be blocked by the browser's
// same-site cookie rules unless we add CORS to the backend. Proxying /api
// through Vite's dev server instead makes every request look same-origin,
// so the cookie just works — zero backend changes required.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // WebRTC signalling channel for Test Monitoring → View Live (see
      // server.js — a plain `ws` WebSocketServer mounted at this path).
      // `ws: true` makes Vite proxy the HTTP Upgrade request too, not
      // just plain HTTP, so the same-origin session cookie still applies.
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
