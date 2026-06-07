import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: mode === 'admin' ? 'dist-admin' : 'dist',
  },
  esbuild: {
    jsxInject: `import React from 'react'`
  }
}))
