import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Ensure relative paths for Electron file:// protocol
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
})
