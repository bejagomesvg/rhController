import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 8080,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/index')) return 'react'
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/lucide-react')) return 'lucide'
          if (id.includes('node_modules/react-hot-toast')) return 'react-hot-toast'
          return undefined
        },
      },
    },
    reportCompressedSize: true,
  },
})
