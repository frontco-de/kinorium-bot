import { dayBucket } from '@/models/Stats'

/**
 * Claims the right to send one alert for an event on a UTC day.
 *
 * A broken dependency fails on every update, so alerts need a throttle that
 * survives across isolates. The primary key does it: only the insert that
 * creates the row reports a change, and every later attempt that day is a
 * no-op.
 */
export default async function claimAlert(
  db: D1Database,
  event: string,
  day: string = dayBucket()
): Promise<boolean> {
  const result = await db
    .prepare('INSERT OR IGNORE INTO alerts (day, event) VALUES (?, ?)')
    .bind(day, event)
    .run()
  return result.meta.changes === 1
}
