import usersMigration from '@migrations/0001_create_users.sql'
import hourlyMigration from '@migrations/0002_create_usage_counters.sql'
import dailyMigration from '@migrations/0003_daily_usage_counters.sql'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { readStatsSummary } from '@/models/Stats'

/**
 * `0003` narrows the hourly counters from `0002` to one row per day. The
 * production tables were empty when it ran, but the aggregation has to be
 * correct for any database that already collected hours.
 */
describe('daily counter migration', () => {
  it('aggregates hourly rows into one row per day', async () => {
    await env.DB.exec(usersMigration)
    await env.DB.exec(hourlyMigration)
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO usage_stats (bucket, event, count) VALUES ('2026-08-17T09', 'api_call', 3)"
      ),
      env.DB.prepare(
        "INSERT INTO usage_stats (bucket, event, count) VALUES ('2026-08-17T11', 'api_call', 4)"
      ),
      env.DB.prepare(
        "INSERT INTO usage_stats (bucket, event, count) VALUES ('2026-08-17T11', 'sent_result', 2)"
      ),
      env.DB.prepare(
        "INSERT INTO usage_stats (bucket, event, count) VALUES ('2026-08-16T23', 'api_call', 5)"
      ),
      env.DB.prepare(
        "INSERT INTO user_activity (bucket, user_id) VALUES ('2026-08-17T09', 42)"
      ),
      env.DB.prepare(
        "INSERT INTO user_activity (bucket, user_id) VALUES ('2026-08-17T13', 42)"
      ),
      env.DB.prepare(
        "INSERT INTO user_activity (bucket, user_id) VALUES ('2026-08-17T13', 43)"
      ),
    ])

    await env.DB.exec(dailyMigration)

    const usage = await env.DB.prepare(
      'SELECT day, event, count FROM usage_stats ORDER BY day DESC, event'
    ).all()
    const activity = await env.DB.prepare(
      'SELECT day, user_id FROM user_activity ORDER BY user_id'
    ).all()

    expect(usage.results).toEqual([
      { day: '2026-08-17', event: 'api_call', count: 7 },
      { day: '2026-08-17', event: 'sent_result', count: 2 },
      { day: '2026-08-16', event: 'api_call', count: 5 },
    ])
    expect(activity.results).toEqual([
      { day: '2026-08-17', user_id: 42 },
      { day: '2026-08-17', user_id: 43 },
    ])
    await expect(
      readStatsSummary(env.DB, 10, new Date('2026-08-17T14:00:00.000Z'))
    ).resolves.toMatchObject({
      windows: { today: { searches: 7, sentResults: 2, users: 2 } },
      total: { searches: 12, sentResults: 2 },
    })
  })
})
