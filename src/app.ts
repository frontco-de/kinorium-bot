import { webhookCallback } from 'grammy'
import createBot from '@/helpers/bot'

const encoder = new TextEncoder()

export async function secretsMatch(actual: string | null, expected: string) {
  if (actual === null) return false
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const actualBytes = new Uint8Array(actualDigest)
  const expectedBytes = new Uint8Array(expectedDigest)
  let difference = 0
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
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

    const authorized = await secretsMatch(
      request.headers.get('X-Telegram-Bot-Api-Secret-Token'),
      env.WEBHOOK_SECRET
    )
    if (!authorized) return json({ error: 'Unauthorized' }, 401)

    try {
      const handleUpdate = webhookCallback(createBot(env), 'cloudflare-mod', {
        onTimeout: 'throw',
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
