import 'module-alias/register'
import 'reflect-metadata'
import 'source-map-support/register'

import { ignoreOld } from 'grammy-middlewares'
import { run, sequentialize } from '@grammyjs/runner'
import Context from '@/models/Context'
import attachUser from '@/middlewares/attachUser'
import bot, { registerInlineQueryHandlers } from '@/helpers/bot'
import configureI18n from '@/middlewares/configureI18n'
import handleLanguage from '@/handlers/language'
import i18n from '@/helpers/i18n'
import languageMenu from '@/menus/language'
import sendHelp from '@/handlers/help'
import startMongo from '@/helpers/startMongo'

function getConcurrencyKey(ctx: Context) {
  return ctx.chat?.id?.toString() ?? ctx.from?.id?.toString() ?? ctx.update.update_id.toString()
}

async function runApp() {
  console.log('Starting app...')
  // Mongo
  await startMongo()
  console.log('Mongo connected')
  bot
    // Middlewares
    .use(sequentialize(getConcurrencyKey))
    .use(ignoreOld())
    // Log all updates for debugging
    .use((ctx, next) => {
      if (ctx.inlineQuery) {
        console.log('DEBUG: Inline query received:', ctx.inlineQuery.query)
      }
      return next()
    })
    .use(attachUser)
    .use(i18n.middleware())
    .use(configureI18n)
    // Menus
    .use(languageMenu)
  // Commands
  registerInlineQueryHandlers()
  bot.command(['help', 'start'], sendHelp)
  bot.command('language', handleLanguage)
  // Errors
  bot.catch(console.error)
  // Start bot
  await bot.init()
  run(bot)
  console.info(`Bot ${bot.botInfo.username} is up and running`)
}

void runApp()
