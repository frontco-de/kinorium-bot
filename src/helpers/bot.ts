import { Bot, InlineQueryResultBuilder as R } from 'grammy/web'
import sendHelp from '@/handlers/help'
import handleLanguage from '@/handlers/language'
import localize from '@/helpers/i18n'
import { searchMoviesDetailed } from '@/helpers/kinorium'
import { registerLanguageMenu } from '@/menus/language'
import attachUser from '@/middlewares/attachUser'
import configureI18n from '@/middlewares/configureI18n'
import Context from '@/models/Context'

const INLINE_QUERY_CACHE_TIME_SECONDS = 600

function registerInlineQueryHandlers(bot: Bot<Context>, apiKey: string): void {
  // When user types: @YourBot hello
  bot.inlineQuery(/.*/, async (ctx) => {
    try {
      const searchText = ctx.inlineQuery.query || ''

      // If query is empty, return empty results without making API request
      if (!searchText.trim()) {
        await ctx.answerInlineQuery([], { cache_time: 30 })
        return
      }

      const searchResult = await searchMoviesDetailed(searchText, apiKey)

      if (searchResult.kind === 'error') {
        const title = ctx.i18n.t('inline.api_error_title')
        const description = ctx.i18n.t('inline.api_error_description')
        const text = ctx.i18n.t('inline.api_error_message')
        await ctx.answerInlineQuery(
          [R.article('api-error', title, { description }).text(text)],
          {
            cache_time: 30,
          }
        )
        return
      }

      if (searchResult.kind === 'no_results') {
        const title = ctx.i18n.t('inline.no_results_title')
        const description = ctx.i18n.t('inline.no_results_description', {
          query: searchText,
        })
        const text = ctx.i18n.t('inline.no_results_message', {
          query: searchText,
        })
        await ctx.answerInlineQuery(
          [R.article('no-results', title, { description }).text(text)],
          {
            cache_time: 30,
          }
        )
        return
      }

      const movies = searchResult.movies
      const hasMovies = movies.length > 0

      // Create results based on movies
      const results = movies.slice(0, 10).map((movie) => {
        const title = movie.name_orig || movie.name
        const typeLabel = movie.isSerial ? 'TV-show' : movie.mixtype
        const hasSerialYearRange =
          Boolean(movie.isSerial) &&
          typeof movie.year_serial_b === 'number' &&
          typeof movie.year_serial_e === 'number'
        const yearText = hasSerialYearRange
          ? `${movie.year_serial_b}—${movie.year_serial_e}`
          : String(movie.year || movie.year_serial_b || '')
        const description = `${typeLabel}${yearText ? ` (${yearText})` : ''}`
        const text = `Title: ${title}\nOriginal: ${movie.name}\nType: ${typeLabel}${
          yearText
            ? `\n${hasSerialYearRange ? 'Years' : 'Year'}: ${yearText}`
            : ''
        }`
        const textWithLink = `${text}\nLink: ${movie.url}`

        // Build article options
        const articleOptions: {
          description: string
          thumbnail_url?: string
        } = {
          description,
        }

        // Add poster thumbnail if available
        if (movie.poster) {
          // Replace {$image_size_id} with actual size (200px is good for thumbnails)
          const thumbnailUrl = movie.poster.replace('{$image_size_id}', '200')
          articleOptions.thumbnail_url = thumbnailUrl
        }

        return R.article(`movie-${movie.id}`, title, articleOptions).text(
          textWithLink
        )
      })

      // If no movies found, provide a default result
      if (results.length === 0) {
        const title = ctx.i18n.t('inline.no_results_title')
        const description = ctx.i18n.t('inline.no_results_description', {
          query: searchText,
        })
        const text = ctx.i18n.t('inline.no_results_message', {
          query: searchText,
        })
        results.push(R.article('no-results', title, { description }).text(text))
      }

      await ctx.answerInlineQuery(results, {
        cache_time: hasMovies ? INLINE_QUERY_CACHE_TIME_SECONDS : 30,
      })
    } catch (error) {
      console.error('Error handling inline query:', error)
      // Send empty results on error
      await ctx.answerInlineQuery([], { cache_time: 30 })
    }
  })
}

export default function createBot(env: CloudflareBindings): Bot<Context> {
  const bot = new Bot<Context>(env.TOKEN, {
    ContextConstructor: Context,
    botInfo: env.BOT_INFO,
  })

  bot.use(attachUser(env.DB))
  bot.use(localize)
  bot.use(configureI18n)
  registerLanguageMenu(bot)
  registerInlineQueryHandlers(bot, env.APIKEY)
  bot.command(['help', 'start'], sendHelp)
  bot.command('language', handleLanguage)
  bot.catch((error) => {
    const message =
      error.error instanceof Error ? error.error.message : String(error.error)
    console.error(
      JSON.stringify({ event: 'telegram_update_failed', error: message })
    )
    throw error
  })

  return bot
}
