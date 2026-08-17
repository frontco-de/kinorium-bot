import { type MiddlewareFn } from 'grammy/web'
import { type StatsRecorder } from '@/helpers/stats'
import Context from '@/models/Context'

/**
 * Marks the sender active for the current hour. Repeated updates within the
 * same hour are ignored by the database, so an inline search that fires one
 * update per keystroke still counts its author once.
 */
export default function recordActivity(
  stats: StatsRecorder
): MiddlewareFn<Context> {
  return (ctx, next) => {
    if (ctx.from !== undefined) stats.recordActiveUser(ctx.from.id)
    return next()
  }
}
