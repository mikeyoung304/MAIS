import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

// Vite automatically exposes VITE_* environment variables to import.meta.env
// No need to manually define them
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve workspace packages to their built index files
      // Must use .js extension for ESM modules
      '@macon/contracts': path.resolve(__dirname, '../packages/contracts/dist/index.js'),
      '@macon/shared': path.resolve(__dirname, '../packages/shared/dist/index.js'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    rollupOptions: {
      input: {
        // Main application entry point
        main: resolve(__dirname, 'index.html'),
        // Widget entry point for iframe embedding
        widget: resolve(__dirname, 'widget.html'),
      },
      output: {
        // Organize output by entry point
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'widget') {
            return 'widget/assets/[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: (chunkInfo) => {
          // Check if chunk is used by widget
          if (chunkInfo.moduleIds.some((id) => id.includes('widget'))) {
            return 'widget/assets/[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        assetFileNames: (assetInfo) => {
          // Check if asset is used by widget (widget.html or widget-main.tsx)
          if (
            assetInfo.name &&
            (assetInfo.name.includes('widget') || assetInfo.name === 'widget.html')
          ) {
            return 'widget/assets/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },
});
