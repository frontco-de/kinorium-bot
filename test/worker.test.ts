import {
  createExecutionContext,
  env,
  SELF,
  waitOnExecutionContext,
} from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
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
})
