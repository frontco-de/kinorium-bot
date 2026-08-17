import { webhookCallback } from 'grammy/web'
import createBot from '@/helpers/bot'
import logError from '@/helpers/logging'
import createSearchCache from '@/helpers/searchCache'
import createStatsRecorder from '@/helpers/stats'

const encoder = new TextEncoder()

export async function secretsMatch(actual: string, expected: string) {
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return crypto.subtle.timingSafeEqual(actualDigest, expectedDigest)
}

/**
 * Bindings are typed as `string`, but a forgotten `wrangler secret` leaves the
 * value undefined at runtime. Without this guard the comparison would hash the
 * literal `"undefined"` and accept a request carrying that header value.
 */
function isConfiguredSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length > 0
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && ['/', '/health'].includes(url.pathname)) {
      return json({ status: 'ok', bot: env.BOT_INFO.username })
    }
    if (url.pathname !== '/webhook') return json({ error: 'Not found' }, 404)
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }
    if (!isConfiguredSecret(env.WEBHOOK_SECRET)) {
      logError('webhook_secret_missing')
      return json({ error: 'Internal server error' }, 500)
    }

    const webhookSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (
      webhookSecret === null ||
      !(await secretsMatch(webhookSecret, env.WEBHOOK_SECRET))
    ) {
      return json({ error: 'Unauthorized' }, 401)
    }

    try {
      const searchCache = createSearchCache(caches.default, ctx, url.origin)
      const stats = createStatsRecorder(env.DB, ctx)
      const handleUpdate = webhookCallback(
        createBot(env, searchCache, stats),
        'cloudflare-mod',
        {
          onTimeout: 'throw',
          // grammY repeats the check against the configured secret, so the
          // authentication above stays independently verifiable.
          secretToken: env.WEBHOOK_SECRET,
          timeoutMilliseconds: 9_000,
        }
      )
      return await handleUpdate(request)
    } catch (error) {
      logError('webhook_request_failed', error)
      return json({ error: 'Internal server error' }, 500)
    }
  },
} satisfies ExportedHandler<CloudflareBindings>
