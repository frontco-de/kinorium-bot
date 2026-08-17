import logError from '@/helpers/logging'
import {
  incrementUsageStat,
  recordUserActivity,
  type StatEvent,
} from '@/models/Stats'

type BackgroundContext = Pick<ExecutionContext, 'waitUntil'>

export interface StatsRecorder {
  record(event: StatEvent): void
  recordActiveUser(userId: number): void
}

/**
 * Counting must never delay or fail an answer to Telegram, so writes run in the
 * background and failures are logged instead of reaching the handler.
 */
export default function createStatsRecorder(
  db: D1Database,
  ctx: BackgroundContext
): StatsRecorder {
  const inBackground = (write: Promise<void>, event: string) => {
    ctx.waitUntil(
      write.catch((error: unknown) => {
        logError(event, error)
      })
    )
  }

  return {
    record(event) {
      inBackground(incrementUsageStat(db, event), 'stats_write_failed')
    },
    recordActiveUser(userId) {
      inBackground(recordUserActivity(db, userId), 'user_activity_write_failed')
    },
  }
}
