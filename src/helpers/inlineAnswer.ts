import { GrammyError } from 'grammy/web'
import type buildInlineErrorResult from '@/helpers/inlineError'
import logError from '@/helpers/logging'
import type Context from '@/models/Context'

const INLINE_QUERY_CACHE_TIME_SECONDS = 5

interface AnswerOptions {
  /** Seconds Telegram may reuse this answer; `0` makes the next keystroke or retry reach the bot. */
  cacheTimeSeconds?: number
  /** Milliseconds since the Worker received the update; logged when the answer is late. */
  waitedMs?: number
}

export type InlineResult = ReturnType<typeof buildInlineErrorResult>

// Telegram stops accepting answers shortly after the user types. The wording
// is matched only to recognise the case, never logged: descriptions can echo
// user input.
const EXPIRED_QUERY = /query is too old|query ID is invalid/i

function isExpiredQuery(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 400 &&
    EXPIRED_QUERY.test(error.description)
  )
}

/**
 * Answers an inline query and reports whether Telegram accepted it. An answer
 * that arrives after Telegram closed the query cannot be delivered and is not a
 * bug, so it is logged without raising an admin alert; every other failure
 * still propagates.
 */
export default async function answerInlineQuery(
  ctx: Pick<Context, 'answerInlineQuery'>,
  results: InlineResult[],
  {
    cacheTimeSeconds = INLINE_QUERY_CACHE_TIME_SECONDS,
    waitedMs,
  }: AnswerOptions = {}
): Promise<boolean> {
  try {
    await ctx.answerInlineQuery(results, {
      cache_time: cacheTimeSeconds,
      is_personal: true,
    })
    return true
  } catch (error) {
    if (!isExpiredQuery(error)) throw error
    logError('inline_query_expired', error, { ms: waitedMs })
    return false
  }
}
