import { SELF } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { secretsMatch } from '@/app'

describe('Worker HTTP interface', () => {
  it('compares webhook secrets without exposing their length', async () => {
    await expect(secretsMatch('secret', 'secret')).resolves.toBe(true)
    await expect(secretsMatch('short', 'longer-secret')).resolves.toBe(false)
  })

  it('reports health without exposing secrets', async () => {
    const response = await SELF.fetch('https://example.com/health')

    expect(response.status).toBe(200)
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
