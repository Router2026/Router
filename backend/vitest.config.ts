import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: '../coverage/backend',
      include: ['src/lib/**'],
      exclude: [
        'src/lib/db/**',
        'src/lib/email/**',
        'src/lib/ingestion/**',
        'src/lib/notifications/**',
        'src/lib/llm/anthropic.ts',
        'src/lib/llm/ollama.ts',
        'src/lib/llm/openai.ts',
        'src/lib/location-images/**',
        'src/lib/poi/**',
        'src/lib/trip-bucket/mapbox-matrix.ts',
        'src/lib/trip-bucket/smart-build.ts',
        'src/lib/startup-check.ts',
        'src/lib/trips/trip-service.ts',
        'src/lib/public-trips/**',
      ],
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
