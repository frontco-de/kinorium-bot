import { webhookCallback } from 'grammy/web'
import createBot from '@/helpers/bot'

const encoder = new TextEncoder()

export async function secretsMatch(actual: string, expected: string) {
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return crypto.subtle.timingSafeEqual(actualDigest, expectedDigest)
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && ['/', '/health'].includes(url.pathname)) {
      return json({ status: 'ok', bot: env.BOT_INFO.username })
    }
    if (url.pathname !== '/webhook') return json({ error: 'Not found' }, 404)
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const webhookSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (
      webhookSecret === null ||
      !(await secretsMatch(webhookSecret, env.WEBHOOK_SECRET))
    ) {
      return json({ error: 'Unauthorized' }, 401)
    }

    try {
      const handleUpdate = webhookCallback(createBot(env), 'cloudflare-mod', {
        onTimeout: 'throw',
        // grammY repeats the check; authentication already happened above.
        secretToken: webhookSecret,
        timeoutMilliseconds: 9_000,
      })
      return await handleUpdate(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        JSON.stringify({ event: 'webhook_request_failed', error: message })
      )
      return json({ error: 'Internal server error' }, 500)
    }
  },
} satisfies ExportedHandler<CloudflareBindings>
