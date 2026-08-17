/**
 * Usage counters.
 *
 * Both tables bucket by UTC day, so storage grows by at most two counter rows
 * plus one row per active user per day. Writes stay far below the D1 daily
 * allowance, whose exhaustion would start failing the queries the bot itself
 * depends on.
 *
 * `usage_stats` holds counts only. `user_activity` holds one row per user per
 * day they interacted, which is the smallest shape that can answer "how many
 * distinct users were active" for a window.
 */

/** `api_call` counts Kinorium requests, so cache hits are not searches. */
export type StatEvent = 'api_call' | 'sent_result'

export interface UsageCounts {
  searches: number
  sentResults: number
  users: number
}

export interface DailyUsage extends UsageCounts {
  day: string
}

export interface StatsSummary {
  windows: Record<WindowKey, UsageCounts>
  total: UsageCounts
  days: DailyUsage[]
}

interface UsageRow {
  searches?: unknown
  sent_results?: unknown
}

interface UsersRow {
  users?: unknown
}

interface DailyRow extends UsageRow, UsersRow {
  day?: unknown
}

/** `today` covers the current UTC day; the rest are trailing day windows. */
const WINDOW_DAYS = {
  today: 1,
  days7: 7,
  days30: 30,
  days365: 365,
} as const

export type WindowKey = keyof typeof WINDOW_DAYS

export const WINDOW_KEYS = Object.keys(WINDOW_DAYS) as WindowKey[]

const RECENT_DAY_LIMIT = 10
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const USAGE_SUMS = `SUM(CASE WHEN event = 'api_call' THEN count ELSE 0 END) AS searches, SUM(CASE WHEN event = 'sent_result' THEN count ELSE 0 END) AS sent_results`
const DISTINCT_USERS = 'COUNT(DISTINCT user_id) AS users'

/** Days are UTC so they align with the daily reset of Cloudflare quotas. */
export function dayBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** The oldest day a window covers, counting the current day as the first. */
export function windowStart(days: number, now: Date = new Date()): string {
  return dayBucket(new Date(now.getTime() - (days - 1) * MILLISECONDS_PER_DAY))
}

/** Aggregates over an empty table return a single row of nulls. */
function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toUsageCounts(
  usage: UsageRow | undefined,
  users: UsersRow | undefined
): UsageCounts {
  return {
    searches: toCount(usage?.searches),
    sentResults: toCount(usage?.sent_results),
    users: toCount(users?.users),
  }
}

export async function incrementUsageStat(
  db: D1Database,
  event: StatEvent,
  day: string = dayBucket()
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO usage_stats (day, event, count) VALUES (?, ?, 1) ON CONFLICT (day, event) DO UPDATE SET count = count + 1'
    )
    .bind(day, event)
    .run()
}

export async function recordUserActivity(
  db: D1Database,
  userId: number,
  day: string = dayBucket()
): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO user_activity (day, user_id) VALUES (?, ?)')
    .bind(day, userId)
    .run()
}

function mergeDailyRows(
  usageRows: DailyRow[],
  userRows: DailyRow[],
  dayLimit: number
): DailyUsage[] {
  const byDay = new Map<string, DailyUsage>()
  const upsert = (row: DailyRow, apply: (day: DailyUsage) => void) => {
    if (typeof row.day !== 'string') return
    const day = byDay.get(row.day) ?? {
      day: row.day,
      searches: 0,
      sentResults: 0,
      users: 0,
    }
    apply(day)
    byDay.set(row.day, day)
  }

  for (const row of usageRows) {
    upsert(row, (day) => {
      day.searches = toCount(row.searches)
      day.sentResults = toCount(row.sent_results)
    })
  }
  for (const row of userRows) {
    upsert(row, (day) => {
      day.users = toCount(row.users)
    })
  }

  return [...byDay.values()]
    .sort((left, right) => right.day.localeCompare(left.day))
    .slice(0, dayLimit)
}

export async function readStatsSummary(
  db: D1Database,
  dayLimit: number = RECENT_DAY_LIMIT,
  now: Date = new Date()
): Promise<StatsSummary> {
  const cutoffs = WINDOW_KEYS.map((key) => windowStart(WINDOW_DAYS[key], now))

  // The trailing statement of each batch covers all of time.
  const usageResults = await db.batch<UsageRow>([
    ...cutoffs.map((cutoff) =>
      db
        .prepare(`SELECT ${USAGE_SUMS} FROM usage_stats WHERE day >= ?`)
        .bind(cutoff)
    ),
    db.prepare(`SELECT ${USAGE_SUMS} FROM usage_stats`),
  ])
  const userResults = await db.batch<UsersRow>([
    ...cutoffs.map((cutoff) =>
      db
        .prepare(`SELECT ${DISTINCT_USERS} FROM user_activity WHERE day >= ?`)
        .bind(cutoff)
    ),
    db.prepare('SELECT COUNT(*) AS users FROM users'),
  ])
  const dailyUsage = await db
    .prepare(
      `SELECT day, ${USAGE_SUMS} FROM usage_stats GROUP BY day ORDER BY day DESC LIMIT ?`
    )
    .bind(dayLimit)
    .all<DailyRow>()
  const dailyUsers = await db
    .prepare(
      `SELECT day, ${DISTINCT_USERS} FROM user_activity GROUP BY day ORDER BY day DESC LIMIT ?`
    )
    .bind(dayLimit)
    .all<DailyRow>()

  const windows = Object.fromEntries(
    WINDOW_KEYS.map((key, index) => [
      key,
      toUsageCounts(
        usageResults[index]?.results[0],
        userResults[index]?.results[0]
      ),
    ])
  ) as Record<WindowKey, UsageCounts>

  return {
    windows,
    total: toUsageCounts(
      usageResults[WINDOW_KEYS.length]?.results[0],
      userResults[WINDOW_KEYS.length]?.results[0]
    ),
    days: mergeDailyRows(dailyUsage.results, dailyUsers.results, dayLimit),
  }
}
