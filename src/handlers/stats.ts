import logError from '@/helpers/logging'
import sendOptions from '@/helpers/sendOptions'
import Context from '@/models/Context'
import {
  readStatsSummary,
  type StatsSummary,
  type UsageCounts,
  WINDOW_KEYS,
} from '@/models/Stats'

function parseAdminId(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const id = Number(value.trim())
  return Number.isInteger(id) && id > 0 ? id : undefined
}

function countValues(counts: UsageCounts) {
  return {
    searches: counts.searches,
    sent: counts.sentResults,
    users: counts.users,
  }
}

function formatSummary(ctx: Context, summary: StatsSummary): string {
  const lines = [ctx.i18n.t('stats.title')]
  for (const key of WINDOW_KEYS) {
    lines.push(
      ctx.i18n.t(`stats.window_${key}`, countValues(summary.windows[key]))
    )
  }
  lines.push(ctx.i18n.t('stats.total', countValues(summary.total)))

  if (summary.days.length === 0) {
    lines.push('', ctx.i18n.t('stats.empty'))
    return lines.join('\n')
  }

  lines.push('', ctx.i18n.t('stats.recent'))
  for (const day of summary.days) {
    lines.push(ctx.i18n.t('stats.day', { ...countValues(day), day: day.day }))
  }
  return lines.join('\n')
}

/**
 * Answers only the account in `ADMIN_ID`. Anyone else is ignored without a
 * reply, so the command does not advertise that it exists.
 */
export default function createSendStats(
  db: D1Database,
  adminId: string | undefined
) {
  const admin = parseAdminId(adminId)

  return async (ctx: Context) => {
    if (admin === undefined) {
      logError('stats_admin_not_configured')
      return
    }
    if (ctx.from?.id !== admin) return

    const summary = await readStatsSummary(db)
    await ctx.reply(formatSummary(ctx, summary), sendOptions(ctx))
  }
}
