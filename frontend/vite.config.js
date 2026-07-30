import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8000'
  const apiPrefix = env.VITE_API_PREFIX || '/api'
  const hostRaw = env.VITE_HOST !== undefined ? env.VITE_HOST : true
  const host = hostRaw === true || hostRaw === 'true' ? true
              : hostRaw === false || hostRaw === 'false' ? false
              : hostRaw
  return {
    plugins: [react()],
    server: {
      host,
      port: 3000,
      strictPort: false,
      proxy: {
        [apiPrefix]: {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${apiPrefix}`), ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1024,
    },
  }
})
