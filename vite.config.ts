import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** Prevent clickjacking: block embedding this app in third-party iframes (HTTP headers are the reliable fix). */
const antiClickjackingHeaders = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
} as const;

export default defineConfig({
   base: '/',
  plugins: [react()],
  server: {
    headers: antiClickjackingHeaders,
  },
  preview: {
    headers: antiClickjackingHeaders,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts';
            if (id.includes('react') || id.includes('react-router-dom') || id.includes('zustand')) return 'vendor';
            if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind') || id.includes('xlsx')) {
              return 'ui-vendor';
            }
          }
          return null;
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

