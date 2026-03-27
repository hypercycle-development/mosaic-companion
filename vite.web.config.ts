import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web build config - runs app in browser with MetaMask support
// Uses web.html which includes the electronAPI stub for localStorage-based persistence
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true, // Listen on all addresses for network access
  },
  // Use web.html as the entry point (includes electronAPI stub)
  publicDir: 'public',
})