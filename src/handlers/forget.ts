import sendOptions from '@/helpers/sendOptions'
import Context from '@/models/Context'
import { deleteUser } from '@/models/User'

/**
 * Erases the sender's own stored data.
 *
 * Self-service by design: Telegram has already proven who the sender is, so no
 * argument, no admin involvement, and no identity check are needed. There is
 * deliberately no way to erase somebody else.
 */
export default async function forgetMe(ctx: Context) {
  if (ctx.from === undefined) return

  const { activityDays } = await deleteUser(ctx.db, ctx.from.id)
  await ctx.reply(
    ctx.i18n.tHtml('forget', { days: activityDays }),
    sendOptions(ctx)
  )
}
