import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensure relative paths for Electron file:// protocol
  resolve: {
    alias: {
      '@plugins': path.resolve(__dirname, 'plugins'),
      '@': path.resolve(__dirname),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  }
})