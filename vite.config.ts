import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Heavy libs first
            if (id.includes('three') || id.includes('cannon-es') || id.includes('matter-js')) return 'three';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('framer-motion') || id.includes('gsap')) return 'animations';
            if (id.includes('ai') || id.includes('@ai-sdk')) return 'ai';
            
            // Core
            if (id.includes('react') || id.includes('react-router-dom') || id.includes('zustand')) return 'vendor';
            
            // UI
            if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind') || 
                id.includes('@headlessui') || id.includes('react-use')) {
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

