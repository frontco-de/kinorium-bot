/**
 * Logs a structured diagnostic event.
 *
 * Only the error's constructor name is recorded: messages can carry Telegram
 * updates, search queries, SQL, or authenticated URLs, none of which may reach
 * the logs.
 */
export default function logError(event: string, error?: unknown): void {
  const name = error instanceof Error ? error.name : undefined
  console.error(
    JSON.stringify({
      event,
      error: error === undefined ? undefined : (name ?? 'UnknownError'),
    })
  )
}
