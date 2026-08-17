import alertsMigration from '@migrations/0004_create_alerts.sql'
import { env } from 'cloudflare:workers'
import { type Api } from 'grammy/web'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import parseAdminId from '@/helpers/admin'
import createAdminAlerter from '@/helpers/alerts'
import claimAlert from '@/models/Alerts'

const ADMIN_ID = 42

function background() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
    settle: () => Promise.all(pending),
  }
}

function fakeApi() {
  const sendMessage = vi.fn(() => Promise.resolve())
  return { api: { sendMessage } as unknown as Api, sendMessage }
}

describe('admin id parsing', () => {
  it('accepts plain digits only', () => {
    expect(parseAdminId('42')).toBe(42)
    expect(parseAdminId(' 42\n')).toBe(42)
  })

  it('rejects values Number() would silently reinterpret', () => {
    for (const value of ['0x2a', '1e3', '42.0', '-42', '0', '', '  ', '4 2']) {
      expect(parseAdminId(value)).toBeUndefined()
    }
    expect(parseAdminId(undefined)).toBeUndefined()
  })
})

describe('admin alerts', () => {
  beforeAll(async () => {
    await env.DB.exec(alertsMigration)
  })

  beforeEach(async () => {
    await env.DB.exec('DELETE FROM alerts;')
  })

  it('claims an event once per day', async () => {
    await expect(claimAlert(env.DB, 'boom', '2026-08-17')).resolves.toBe(true)
    await expect(claimAlert(env.DB, 'boom', '2026-08-17')).resolves.toBe(false)
    await expect(claimAlert(env.DB, 'boom', '2026-08-18')).resolves.toBe(true)
    await expect(claimAlert(env.DB, 'other', '2026-08-17')).resolves.toBe(true)
  })

  it('messages the admin once for repeated failures', async () => {
    const { ctx, settle } = background()
    const { api, sendMessage } = fakeApi()
    const alerts = createAdminAlerter(api, env.DB, String(ADMIN_ID), ctx)

    alerts.alert('telegram_update_failed', new TypeError('secret detail'))
    alerts.alert('telegram_update_failed', new TypeError('secret detail'))
    await settle()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    const [chatId, text] = sendMessage.mock.calls[0] as unknown as [
      number,
      string,
    ]
    expect(chatId).toBe(ADMIN_ID)
    // Event name and error constructor only: no message, no update contents.
    expect(text).toBe('⚠️ kinorium-bot: telegram_update_failed (TypeError)')
    expect(text).not.toContain('secret detail')
  })

  it('stays inert when no admin is configured', async () => {
    const { ctx, settle } = background()
    const { api, sendMessage } = fakeApi()

    createAdminAlerter(api, env.DB, undefined, ctx).alert('boom')
    createAdminAlerter(api, env.DB, 'not-an-id', ctx).alert('boom')
    await settle()

    expect(sendMessage).not.toHaveBeenCalled()
    const rows = await env.DB.prepare('SELECT COUNT(*) AS rows FROM alerts')
      .first<{ rows: number }>()
      .then((row) => row?.rows)
    expect(rows).toBe(0)
  })

  it('swallows a failing notification instead of looping', async () => {
    const { ctx, settle } = background()
    const sendMessage = vi.fn(() => Promise.reject(new Error('403')))
    const api = { sendMessage } as unknown as Api

    createAdminAlerter(api, env.DB, String(ADMIN_ID), ctx).alert('boom')

    await expect(settle()).resolves.toBeDefined()
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
