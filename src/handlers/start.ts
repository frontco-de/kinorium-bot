import sendOptions from '@/helpers/sendOptions'
import Context from '@/models/Context'

export default function handleStart(ctx: Context) {
  return ctx.reply(
    ctx.i18n.t('start', { username: ctx.me.username }),
    sendOptions(ctx)
  )
}
