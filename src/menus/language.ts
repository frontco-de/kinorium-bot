import { Bot, InlineKeyboard } from 'grammy/web'
import { isSupportedLocale, locales } from '@/helpers/locales'
import Context from '@/models/Context'
import { updateUserLanguage } from '@/models/User'

const languageMenu = new InlineKeyboard()

locales.forEach(({ code, name }, index) => {
  languageMenu.text(name, `language:${code}`)
  if (index % 2 !== 0) {
    languageMenu.row()
  }
})

export function registerLanguageMenu(bot: Bot<Context>): void {
  bot.callbackQuery(/^language:(.+)$/, async (ctx) => {
    const languageCode = ctx.match[1]
    if (!isSupportedLocale(languageCode)) {
      await ctx.answerCallbackQuery()
      return
    }

    ctx.dbuser = await updateUserLanguage(ctx.db, ctx.dbuser.id, languageCode)
    ctx.i18n.locale(ctx.dbuser.language)
    await ctx.answerCallbackQuery()
    await ctx.editMessageText(ctx.i18n.t('language_selected'), {
      parse_mode: 'HTML',
      reply_markup: undefined,
    })
  })
}

export default languageMenu
