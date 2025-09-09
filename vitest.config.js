import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/vitest.setup.js']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'public/assets'),
      '@config': resolve(__dirname, 'src/config'),
      '@scenes': resolve(__dirname, 'src/scenes'),
      '@utils': resolve(__dirname, 'src/utils')
    }
  }
})