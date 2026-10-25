import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const proxy = {
  '/api': {
    target: process.env.AGENT_BACKEND_URL || 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api/, ''),
    timeout: 3_600_000,
    proxyTimeout: 3_600_000,
  },
};
export default defineConfig({ plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy }, build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } } });
