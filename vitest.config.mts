import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: {
          TOKEN: '123456789:test-token',
          APIKEY: 'test-api-key',
          WEBHOOK_SECRET: 'test-webhook-secret',
          ADMIN_ID: '42',
        },
      },
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@locales': new URL('./locales', import.meta.url).pathname,
      '@migrations': new URL('./migrations', import.meta.url).pathname,
    },
  },
})
