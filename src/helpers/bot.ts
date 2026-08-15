import { Bot, InlineQueryResultBuilder as R } from 'grammy/web'
import sendHelp from '@/handlers/help'
import handleLanguage from '@/handlers/language'
import sendStart from '@/handlers/start'
import localize from '@/helpers/i18n'
import buildInlineMovieResultId from '@/helpers/inlineResult'
import {
  type KinoriumSearchCache,
  searchMoviesDetailed,
} from '@/helpers/kinorium'
import { buildMoviePresentation } from '@/helpers/moviePresentation'
import { registerLanguageMenu } from '@/menus/language'
import attachUser from '@/middlewares/attachUser'
import configureI18n from '@/middlewares/configureI18n'
import Context from '@/models/Context'

const INLINE_QUERY_CACHE_TIME_SECONDS = 5

function registerInlineQueryHandlers(
  bot: Bot<Context>,
  apiKey: string,
  searchCache: KinoriumSearchCache
): void {
  // When user types: @YourBot hello
  bot.inlineQuery(/.*/, async (ctx) => {
    try {
      const searchText = ctx.inlineQuery.query || ''

      // If query is empty, return empty results without making API request
      if (!searchText.trim()) {
        await ctx.answerInlineQuery([], {
          cache_time: INLINE_QUERY_CACHE_TIME_SECONDS,
          is_personal: true,
        })
        return
      }

      const searchResult = await searchMoviesDetailed(
        searchText,
        apiKey,
        ctx.dbuser.language,
        fetch,
        searchCache
      )

      if (searchResult.kind === 'error') {
        const title = ctx.i18n.t('inline.api_error_title')
        const description = ctx.i18n.t('inline.api_error_description')
        const text = ctx.i18n.t('inline.api_error_message')
        await ctx.answerInlineQuery(
          [R.article('api-error', title, { description }).text(text)],
          {
            cache_time: INLINE_QUERY_CACHE_TIME_SECONDS,
            is_personal: true,
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
            cache_time: INLINE_QUERY_CACHE_TIME_SECONDS,
            is_personal: true,
          }
        )
        return
      }

      const movies = searchResult.movies
      const labels = {
        movie: ctx.i18n.t('inline.movie'),
        tvSeries: ctx.i18n.t('inline.tv_series'),
      }

      // Create results based on movies
      const results = movies.slice(0, 10).map((movie) => {
        const presentation = buildMoviePresentation(
          movie,
          ctx.dbuser.language,
          labels
        )

        // Build article options
        const articleOptions: {
          description: string
          thumbnail_url?: string
        } = {
          description: presentation.description,
        }

        // Add poster thumbnail if available
        if (movie.poster) {
          // Replace {$image_size_id} with actual size (200px is good for thumbnails)
          const thumbnailUrl = movie.poster.replace('{$image_size_id}', '200')
          articleOptions.thumbnail_url = thumbnailUrl
        }

        return R.article(
          buildInlineMovieResultId(ctx.inlineQuery.id, movie.id),
          presentation.title,
          articleOptions
        ).text(presentation.message, { parse_mode: 'HTML' })
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
        cache_time: INLINE_QUERY_CACHE_TIME_SECONDS,
        is_personal: true,
      })
    } catch (error) {
      const errorType = error instanceof Error ? error.name : 'UnknownError'
      console.error(
        JSON.stringify({ event: 'inline_query_failed', error: errorType })
      )
      // Send empty results on error
      await ctx.answerInlineQuery([], {
        cache_time: INLINE_QUERY_CACHE_TIME_SECONDS,
        is_personal: true,
      })
    }
  })
}

export default function createBot(
  env: CloudflareBindings,
  searchCache: KinoriumSearchCache
): Bot<Context> {
  const bot = new Bot<Context>(env.TOKEN, {
    ContextConstructor: Context,
    botInfo: env.BOT_INFO,
  })

  bot.use(attachUser(env.DB))
  bot.use(localize)
  bot.use(configureI18n)
  registerLanguageMenu(bot)
  registerInlineQueryHandlers(bot, env.APIKEY, searchCache)
  bot.command('start', sendStart)
  bot.command('help', sendHelp)
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
