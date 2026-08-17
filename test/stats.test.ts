import usersMigration from '@migrations/0001_create_users.sql'
import migration from '@migrations/0002_create_usage_counters.sql'
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import createStatsRecorder from '@/helpers/stats'
import recordActivity from '@/middlewares/recordActivity'
import type Context from '@/models/Context'
import {
  hourBucket,
  incrementUsageStat,
  readStatsSummary,
  recordUserActivity,
  windowStart,
} from '@/models/Stats'

const NOW = new Date('2026-08-17T12:30:00.000Z')

function hoursBefore(hours: number): string {
  return hourBucket(new Date(NOW.getTime() - hours * 60 * 60 * 1000))
}

function backgroundContext() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: {
      waitUntil: vi.fn((promise: Promise<unknown>) => pending.push(promise)),
    },
    settle: () => Promise.all(pending),
  }
}

describe('usage counters', () => {
  beforeEach(async () => {
    await env.DB.exec(usersMigration)
    await env.DB.exec(migration)
    await env.DB.exec('DELETE FROM usage_stats;')
    await env.DB.exec('DELETE FROM user_activity;')
    await env.DB.exec('DELETE FROM users;')
  })

  it('buckets by UTC hour', () => {
    expect(hourBucket(NOW)).toBe('2026-08-17T12')
    expect(windowStart(24, NOW)).toBe('2026-08-16T13')
    expect(windowStart(24 * 7, NOW)).toBe('2026-08-10T13')
  })

  it('reports zeros before anything is recorded', async () => {
    const summary = await readStatsSummary(env.DB, 10, NOW)

    expect(summary.windows.hours24).toEqual({
      searches: 0,
      sentResults: 0,
      users: 0,
    })
    expect(summary.total).toEqual({ searches: 0, sentResults: 0, users: 0 })
    expect(summary.days).toEqual([])
  })

  it('accumulates repeated events into one row per hour', async () => {
    const bucket = hourBucket(NOW)
    await incrementUsageStat(env.DB, 'api_call', bucket)
    await incrementUsageStat(env.DB, 'api_call', bucket)
    await incrementUsageStat(env.DB, 'sent_result', bucket)

    const rows = await env.DB.prepare(
      'SELECT bucket, event, count FROM usage_stats ORDER BY event'
    ).all()

    expect(rows.results).toEqual([
      { bucket, event: 'api_call', count: 2 },
      { bucket, event: 'sent_result', count: 1 },
    ])
  })

  it('counts each window independently', async () => {
    await incrementUsageStat(env.DB, 'api_call', hoursBefore(1))
    await incrementUsageStat(env.DB, 'api_call', hoursBefore(30))
    await incrementUsageStat(env.DB, 'api_call', hoursBefore(24 * 10))
    await incrementUsageStat(env.DB, 'api_call', hoursBefore(24 * 100))
    await incrementUsageStat(env.DB, 'api_call', hoursBefore(24 * 400))

    const summary = await readStatsSummary(env.DB, 10, NOW)

    expect(summary.windows.hours24.searches).toBe(1)
    expect(summary.windows.days7.searches).toBe(2)
    expect(summary.windows.days30.searches).toBe(3)
    expect(summary.windows.days365.searches).toBe(4)
    expect(summary.total.searches).toBe(5)
  })

  it('counts a user once per hour and distinctly per window', async () => {
    await recordUserActivity(env.DB, 42, hourBucket(NOW))
    await recordUserActivity(env.DB, 42, hourBucket(NOW))
    await recordUserActivity(env.DB, 43, hoursBefore(2))
    await recordUserActivity(env.DB, 44, hoursBefore(24 * 20))

    const summary = await readStatsSummary(env.DB, 10, NOW)

    expect(summary.windows.hours24.users).toBe(2)
    expect(summary.windows.days30.users).toBe(3)
  })

  it('reports registered users as the all-time user count', async () => {
    await env.DB.prepare('INSERT INTO users (id, language) VALUES (?, ?)')
      .bind(42, 'en')
      .run()

    const summary = await readStatsSummary(env.DB, 10, NOW)

    expect(summary.total.users).toBe(1)
    expect(summary.windows.hours24.users).toBe(0)
  })

  it('rolls hours up into recent days, newest first', async () => {
    await incrementUsageStat(env.DB, 'api_call', '2026-08-17T09')
    await incrementUsageStat(env.DB, 'api_call', '2026-08-17T11')
    await incrementUsageStat(env.DB, 'sent_result', '2026-08-16T22')
    await recordUserActivity(env.DB, 42, '2026-08-17T09')
    await recordUserActivity(env.DB, 43, '2026-08-17T10')

    const summary = await readStatsSummary(env.DB, 10, NOW)

    expect(summary.days).toEqual([
      { day: '2026-08-17', searches: 2, sentResults: 0, users: 2 },
      { day: '2026-08-16', searches: 0, sentResults: 1, users: 0 },
    ])
  })

  it('limits the recent list to the requested day count', async () => {
    for (let day = 1; day <= 12; day += 1) {
      const date = String(day).padStart(2, '0')
      await incrementUsageStat(env.DB, 'api_call', `2026-08-${date}T10`)
    }

    const summary = await readStatsSummary(env.DB, 10, NOW)

    expect(summary.days).toHaveLength(10)
    expect(summary.days[0]?.day).toBe('2026-08-12')
  })

  it('records searches and active users in the background', async () => {
    const { ctx, settle } = backgroundContext()
    const stats = createStatsRecorder(env.DB, ctx)

    stats.record('api_call')
    stats.recordActiveUser(42)

    expect(ctx.waitUntil).toHaveBeenCalledTimes(2)
    await settle()
    const summary = await readStatsSummary(env.DB, 10, new Date())
    expect(summary.total.searches).toBe(1)
    expect(summary.windows.hours24.users).toBe(1)
  })

  it('swallows write failures', async () => {
    const { ctx, settle } = backgroundContext()
    const brokenDb = {
      prepare: () => {
        throw new Error('database unavailable')
      },
    } as unknown as D1Database
    const stats = createStatsRecorder(brokenDb, ctx)

    stats.record('sent_result')
    stats.recordActiveUser(42)

    await expect(settle()).resolves.toBeDefined()
  })

  it('marks the sender of an update active', async () => {
    const stats = { record: vi.fn(), recordActiveUser: vi.fn() }
    const next = vi.fn(() => Promise.resolve())
    const ctx = { from: { id: 42 } } as unknown as Context

    await recordActivity(stats)(ctx, next)

    expect(stats.recordActiveUser).toHaveBeenCalledWith(42)
    expect(next).toHaveBeenCalled()
  })

  it('skips updates without a sender', async () => {
    const stats = { record: vi.fn(), recordActiveUser: vi.fn() }
    const next = vi.fn(() => Promise.resolve())

    await recordActivity(stats)({} as unknown as Context, next)

    expect(stats.recordActiveUser).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})
