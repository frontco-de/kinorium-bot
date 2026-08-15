import sendOptions from '@/helpers/sendOptions'
import Context from '@/models/Context'

export default function handleHelp(ctx: Context) {
  return ctx.replyWithLocalization('help', sendOptions(ctx))
}
