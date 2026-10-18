import { GrammyError } from 'grammy/web'

type LogDetails = Record<string, number | string | undefined>

/**
 * A `GrammyError` names the Telegram method that failed and the status Telegram
 * answered with. Both come from fixed vocabularies; the `description` next to
 * them can echo user input and is deliberately skipped.
 */
function describeApiFailure(error: unknown): LogDetails {
  if (!(error instanceof GrammyError)) return {}
  return { method: error.method, code: error.error_code }
}

/**
 * Logs a structured diagnostic event.
 *
 * Only the error's constructor name is recorded: messages can carry Telegram
 * updates, search queries, SQL, or authenticated URLs, none of which may reach
 * the logs. `details` is for fixed vocabularies only (update kinds, API method
 * names), never for anything a user typed.
 */
export default function logError(
  event: string,
  error?: unknown,
  details: LogDetails = {}
): void {
  const name = error instanceof Error ? error.name : undefined
  console.error(
    JSON.stringify({
      event,
      error: error === undefined ? undefined : (name ?? 'UnknownError'),
      ...describeApiFailure(error),
      ...details,
    })
  )
}
