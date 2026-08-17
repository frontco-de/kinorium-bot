import usersMigration from '@migrations/0001_create_users.sql'
import migration from '@migrations/0002_create_usage_counters.sql'
import { env } from 'cloudflare:workers'
import { type Update, type UserFromGetMe } from 'grammy/types'
import { Api } from 'grammy/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import createSendStats from '@/handlers/stats'
import { Localizer } from '@/helpers/i18n'
import Context from '@/models/Context'
import {
  hourBucket,
  incrementUsageStat,
  recordUserActivity,
} from '@/models/Stats'

const ADMIN_ID = 42
const botInfo = {
  id: 1,
  is_bot: true,
  first_name: 'KinoriumBot',
  username: 'kinorium_bot',
} as UserFromGetMe

function statsContext(senderId: number): Context {
  const update = {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: senderId, type: 'private' },
      from: { id: senderId, is_bot: false, first_name: 'Sender' },
      text: '/stats',
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  } as unknown as Update
  const ctx = new Context(update, new Api('123456789:test-token'), botInfo)
  ctx.i18n = new Localizer()
  return ctx
}

function spyOnReply(ctx: Context) {
  return vi
    .spyOn(ctx, 'reply')
    .mockImplementation(() => Promise.resolve({} as never))
}

describe('stats command', () => {
  beforeEach(async () => {
    await env.DB.exec(usersMigration)
    await env.DB.exec(migration)
    await env.DB.exec('DELETE FROM usage_stats;')
    await env.DB.exec('DELETE FROM user_activity;')
  })

  it('answers the configured admin with every window and recent days', async () => {
    const bucket = hourBucket()
    await incrementUsageStat(env.DB, 'api_call', bucket)
    await incrementUsageStat(env.DB, 'sent_result', bucket)
    await recordUserActivity(env.DB, 7, bucket)
    const ctx = statsContext(ADMIN_ID)
    const reply = spyOnReply(ctx)

    await createSendStats(env.DB, String(ADMIN_ID))(ctx)

    expect(reply).toHaveBeenCalledTimes(1)
    const message = reply.mock.calls[0]?.[0] ?? ''
    expect(message).toContain('Usage statistics')
    expect(message).toContain(
      'Last 24 h — searches: 1, sent: 1, active users: 1'
    )
    expect(message).toContain('Last 7 days —')
    expect(message).toContain('Last 30 days —')
    expect(message).toContain('Last 365 days —')
    expect(message).toContain('All time —')
    expect(message).toContain('Recent days (searches / sent / active users):')
    expect(message).toContain(`${bucket.slice(0, 10)}: 1 / 1 / 1`)
  })

  it('reports an empty database without day lines', async () => {
    const ctx = statsContext(ADMIN_ID)
    const reply = spyOnReply(ctx)

    await createSendStats(env.DB, String(ADMIN_ID))(ctx)

    const message = reply.mock.calls[0]?.[0] ?? ''
    expect(message).toContain('Nothing recorded yet.')
    expect(message).not.toContain('Recent days')
  })

  it('ignores every other account', async () => {
    const ctx = statsContext(ADMIN_ID + 1)
    const reply = spyOnReply(ctx)

    await createSendStats(env.DB, String(ADMIN_ID))(ctx)

    expect(reply).not.toHaveBeenCalled()
  })

  it('answers nobody while ADMIN_ID is unset or unusable', async () => {
    for (const adminId of [undefined, '', 'not-a-number', '0', '-1']) {
      const ctx = statsContext(ADMIN_ID)
      const reply = spyOnReply(ctx)

      await createSendStats(env.DB, adminId)(ctx)

      expect(reply).not.toHaveBeenCalled()
    }
  })

  it('uses the language of the requester', async () => {
    const ctx = statsContext(ADMIN_ID)
    ctx.i18n.locale('ru')
    const reply = spyOnReply(ctx)

    await createSendStats(env.DB, String(ADMIN_ID))(ctx)

    expect(reply.mock.calls[0]?.[0]).toContain('Статистика использования')
  })
})
