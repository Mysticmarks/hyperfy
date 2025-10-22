import { defineConfig } from 'vitest/config'

const reporters = process.env.VITEST_JSON_REPORT
  ? ['default', ['json', { outputFile: process.env.VITEST_JSON_REPORT }]]
  : ['default']

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
    isolate: true,
  },
})
