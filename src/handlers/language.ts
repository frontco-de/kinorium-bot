import sendOptions from '@/helpers/sendOptions'
import languageMenu from '@/menus/language'
import Context from '@/models/Context'

export default function handleLanguage(ctx: Context) {
  return ctx.replyWithLocalization('language', {
    ...sendOptions(ctx),
    reply_markup: languageMenu,
  })
}
