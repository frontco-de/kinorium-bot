import {
  createExecutionContext,
  env,
  SELF,
  waitOnExecutionContext,
} from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { secretsMatch } from '@/app'

type IncomingRequest = Parameters<typeof worker.fetch>[0]

function webhookRequest(secret?: string): IncomingRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (secret !== undefined) {
    headers['X-Telegram-Bot-Api-Secret-Token'] = secret
  }
  return new Request('https://example.com/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({ update_id: 0 }),
  })
}

function startCommandRequest(): IncomingRequest {
  return new Request('https://example.com/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 1, type: 'private' },
        from: { id: 1, is_bot: false, first_name: 'Test' },
        text: '/start',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    }),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Worker HTTP interface', () => {
  it('compares webhook secrets without exposing their length', async () => {
    await expect(secretsMatch('secret', 'secret')).resolves.toBe(true)
    await expect(secretsMatch('short', 'longer-secret')).resolves.toBe(false)
  })

  it('reports health without exposing secrets', async () => {
    const response = await SELF.fetch('https://example.com/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      bot: env.BOT_INFO.username,
    })
  })

  it('rejects unknown paths', async () => {
    const response = await SELF.fetch('https://example.com/missing')
    expect(response.status).toBe(404)
  })

  it('requires POST for the webhook', async () => {
    const response = await SELF.fetch('https://example.com/webhook')
    expect(response.status).toBe(405)
  })

  it('rejects a webhook without the configured secret', async () => {
    const response = await SELF.fetch('https://example.com/webhook', {
      method: 'POST',
    })
    expect(response.status).toBe(401)
  })

  it('rejects a webhook carrying the wrong secret', async () => {
    const executionContext = createExecutionContext()
    const response = await worker.fetch(
      webhookRequest('not-the-webhook-secret'),
      env,
      executionContext
    )
    await waitOnExecutionContext(executionContext)

    expect(response.status).toBe(401)
  })

  it('refuses to authenticate when no secret is configured', async () => {
    const executionContext = createExecutionContext()
    const response = await worker.fetch(
      // A forgotten `wrangler secret` must not turn the literal "undefined"
      // into a valid credential.
      webhookRequest('undefined'),
      { ...env, WEBHOOK_SECRET: undefined as unknown as string },
      executionContext
    )
    await waitOnExecutionContext(executionContext)

    expect(response.status).toBe(500)
  })

  it('accepts a webhook with the configured secret', async () => {
    const response = await SELF.fetch('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': env.WEBHOOK_SECRET,
      },
      body: JSON.stringify({ update_id: 0 }),
    })

    expect(response.status).toBe(200)
  })

  it('answers 200 and logs the real error when a handler fails', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const executionContext = createExecutionContext()
    const response = await worker.fetch(
      startCommandRequest(),
      // No database makes the first middleware that touches it throw.
      {
        ...env,
        ADMIN_ID: undefined as unknown as string,
        DB: undefined as unknown as D1Database,
      },
      executionContext
    )
    await waitOnExecutionContext(executionContext)

    // A 500 would make Telegram redeliver the failing update indefinitely.
    expect(response.status).toBe(200)
    const events = logs.mock.calls.map(
      ([line]) => JSON.parse(String(line)) as unknown
    )
    expect(events).toEqual([
      {
        event: 'telegram_update_failed',
        error: 'TypeError',
        update: 'message',
      },
    ])
  })
})
