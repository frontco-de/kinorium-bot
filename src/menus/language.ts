import { Menu } from '@grammyjs/menu'
import { locales, type SupportedLocale } from '@/helpers/locales'
import Context from '@/models/Context'
import { updateUserLanguage } from '@/models/User'

const setLanguage = (languageCode: SupportedLocale) => async (ctx: Context) => {
  ctx.dbuser = await updateUserLanguage(ctx.db, ctx.dbuser.id, languageCode)
  ctx.i18n.locale(ctx.dbuser.language)
  return ctx.editMessageText(ctx.i18n.t('language_selected'), {
    parse_mode: 'HTML',
    reply_markup: undefined,
  })
}

const languageMenu = new Menu<Context>('language')

locales.forEach(({ code, name }, index) => {
  languageMenu.text(name, setLanguage(code))
  if (index % 2 != 0) {
    languageMenu.row()
  }
})

export default languageMenu
