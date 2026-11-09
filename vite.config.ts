import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 相对路径，确保离线与本地 macOS App 加载正常
  server: {
    port: 5173,
    host: true
  }
})
