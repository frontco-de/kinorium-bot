import { type Api } from 'grammy/web'
import parseAdminId from '@/helpers/admin'
import logError from '@/helpers/logging'
import claimAlert from '@/models/Alerts'

type BackgroundContext = Pick<ExecutionContext, 'waitUntil'>

export interface AdminAlerter {
  alert(event: string, error?: unknown): void
}

/**
 * Messages the admin account when the bot fails.
 *
 * Alerts carry the event name and the error constructor name only, exactly like
 * the logs: an error message can contain an update, a search query, or an
 * authenticated URL, none of which may reach a chat. Sending runs in the
 * background and never retries, so a failing notification cannot amplify the
 * failure it reports.
 */
export default function createAdminAlerter(
  api: Api,
  db: D1Database,
  adminId: string | undefined,
  ctx: BackgroundContext
): AdminAlerter {
  const admin = parseAdminId(adminId)
  if (admin === undefined) return { alert: () => undefined }

  const send = async (event: string, error?: unknown) => {
    if (!(await claimAlert(db, event))) return
    const name = error instanceof Error ? error.name : undefined
    const detail = name === undefined ? '' : ` (${name})`
    await api.sendMessage(admin, `⚠️ kinorium-bot: ${event}${detail}`)
  }

  return {
    alert(event, error) {
      ctx.waitUntil(
        send(event, error).catch(() => {
          // Reporting a failed report would be the start of a loop.
          logError('admin_alert_failed')
        })
      )
    },
  }
}
