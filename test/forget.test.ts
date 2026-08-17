import usersMigration from '@migrations/0001_create_users.sql'
import countersMigration from '@migrations/0002_create_usage_counters.sql'
import dailyMigration from '@migrations/0003_daily_usage_counters.sql'
import { env } from 'cloudflare:workers'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import forgetMe from '@/handlers/forget'
import { Localizer } from '@/helpers/i18n'
import Context from '@/models/Context'
import { findUser } from '@/models/User'

const USER_ID = 4242

function forgetContext() {
  const i18n = new Localizer()
  const replies: string[] = []
  const ctx = {
    from: { id: USER_ID },
    chat: { id: USER_ID, type: 'private' },
    msg: { message_id: 7 },
    db: env.DB,
    i18n,
    reply: (text: string) => {
      replies.push(text)
      return Promise.resolve()
    },
  } as unknown as Context
  return { ctx, replies }
}

describe('forget command', () => {
  beforeAll(async () => {
    await env.DB.exec(usersMigration)
    await env.DB.exec(countersMigration)
    await env.DB.exec(dailyMigration)
  })

  beforeEach(async () => {
    await env.DB.exec('DELETE FROM users;')
    await env.DB.exec('DELETE FROM user_activity;')
    await env.DB.exec('DELETE FROM usage_stats;')
  })

  it('erases the account row and every activity row of the sender', async () => {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, language) VALUES (?, ?)').bind(
        USER_ID,
        'en'
      ),
      env.DB.prepare('INSERT INTO users (id, language) VALUES (?, ?)').bind(
        999,
        'en'
      ),
      env.DB.prepare(
        'INSERT INTO user_activity (day, user_id) VALUES (?, ?)'
      ).bind('2026-08-16', USER_ID),
      env.DB.prepare(
        'INSERT INTO user_activity (day, user_id) VALUES (?, ?)'
      ).bind('2026-08-17', USER_ID),
      env.DB.prepare(
        'INSERT INTO user_activity (day, user_id) VALUES (?, ?)'
      ).bind('2026-08-17', 999),
      env.DB.prepare(
        'INSERT INTO usage_stats (day, event, count) VALUES (?, ?, ?)'
      ).bind('2026-08-17', 'api_call', 5),
    ])
    const { ctx, replies } = forgetContext()

    await forgetMe(ctx)

    await expect(findUser(env.DB, USER_ID)).resolves.toBeNull()
    const activity = await env.DB.prepare(
      'SELECT user_id FROM user_activity'
    ).all<{ user_id: number }>()
    const counters = await env.DB.prepare(
      'SELECT count FROM usage_stats'
    ).first<{ count: number }>()

    // Only the sender is erased, and aggregate counters stay correct.
    expect(activity.results).toEqual([{ user_id: 999 }])
    await expect(findUser(env.DB, 999)).resolves.not.toBeNull()
    expect(counters?.count).toBe(5)
    expect(replies[0]).toContain('Your data has been deleted.')
    expect(replies[0]).toContain('activity records: 2')
  })

  it('reports zero records when nothing was stored', async () => {
    const { ctx, replies } = forgetContext()

    await forgetMe(ctx)

    expect(replies[0]).toContain('activity records: 0')
  })

  it('ignores an update without a sender', async () => {
    const reply = vi.fn()
    await forgetMe({ reply } as unknown as Context)
    expect(reply).not.toHaveBeenCalled()
  })
})
