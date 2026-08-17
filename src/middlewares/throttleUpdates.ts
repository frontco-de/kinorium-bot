import { type MiddlewareFn } from 'grammy/web'
import isWithinRateLimit from '@/helpers/rateLimit'
import Context from '@/models/Context'

/**
 * Drops updates from a sender who is flooding, before anything touches D1.
 *
 * The inline limiter protects the Kinorium quota and still answers with a
 * "slow down" result, which costs a user lookup and an activity write. This
 * limit sits earlier and higher: it exists so that a script hammering commands
 * or callbacks cannot spend the daily D1 allowance the bot needs for its own
 * reads. Updates over the limit get no answer at all.
 */
export default function throttleUpdates(
  rateLimiter: RateLimit
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!(await isWithinRateLimit(rateLimiter, 'update', ctx.from?.id))) return
    return next()
  }
}
