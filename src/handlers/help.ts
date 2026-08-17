import sendOptions from '@/helpers/sendOptions'
import Context from '@/models/Context'

export default function handleHelp(ctx: Context) {
  return ctx.reply(
    ctx.i18n.tHtml('help', { username: ctx.me.username }),
    sendOptions(ctx)
  )
}
