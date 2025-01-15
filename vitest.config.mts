import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
      ]
    },
  },
})
