import { Bot, InlineQueryResultBuilder as R } from 'grammy/web'
import sendHelp from '@/handlers/help'
import handleLanguage from '@/handlers/language'
import sendStart from '@/handlers/start'
import createSendStats from '@/handlers/stats'
import localize from '@/helpers/i18n'
import buildInlineErrorResult from '@/helpers/inlineError'
import buildInlineMovieResultId from '@/helpers/inlineResult'
import {
  type KinoriumMovieWithUrl,
  type KinoriumSearchCache,
  searchMoviesDetailed,
} from '@/helpers/kinorium'
import { type SupportedLocale } from '@/helpers/locales'
import logError from '@/helpers/logging'
import {
  buildMoviePresentation,
  type MovieLabels,
} from '@/helpers/moviePresentation'
import isWithinRateLimit from '@/helpers/rateLimit'
import { type StatsRecorder } from '@/helpers/stats'
import { registerLanguageMenu } from '@/menus/language'
import attachUser from '@/middlewares/attachUser'
import configureI18n from '@/middlewares/configureI18n'
import ignoreUnhandledUpdates from '@/middlewares/ignoreUnhandledUpdates'
import recordActivity from '@/middlewares/recordActivity'
import Context from '@/models/Context'

const INLINE_QUERY_CACHE_TIME_SECONDS = 5
const INLINE_RESULT_LIMIT = 10
const POSTER_THUMBNAIL_SIZE = '200'

function buildCommandHandlers(env: CloudflareBindings) {
  return {
    help: sendHelp,
    language: handleLanguage,
    start: sendStart,
    stats: createSendStats(env.DB, env.ADMIN_ID),
  }
}

type InlineResult = ReturnType<typeof buildInlineErrorResult>

function answerInlineQuery(ctx: Context, results: InlineResult[]) {
  return ctx.answerInlineQuery(results, {
    cache_time: INLINE_QUERY_CACHE_TIME_SECONDS,
    is_personal: true,
  })
}

function buildNoResultsResult(ctx: Context, query: string): InlineResult {
  return R.article('no-results', ctx.i18n.t('inline.no_results_title'), {
    description: ctx.i18n.t('inline.no_results_description', { query }),
  }).text(ctx.i18n.t('inline.no_results_message', { query }))
}

function buildMovieResult(
  movie: KinoriumMovieWithUrl,
  language: SupportedLocale,
  labels: MovieLabels,
  inlineQueryId: string
): InlineResult {
  const presentation = buildMoviePresentation(movie, language, labels)
  const articleOptions: { description: string; thumbnail_url?: string } = {
    description: presentation.description,
  }
  if (movie.poster) {
    articleOptions.thumbnail_url = movie.poster.replace(
      '{$image_size_id}',
      POSTER_THUMBNAIL_SIZE
    )
  }

  return R.article(
    buildInlineMovieResultId(inlineQueryId, movie.id),
    presentation.title,
    articleOptions
  ).text(presentation.message, { parse_mode: 'HTML' })
}

function registerInlineQueryHandlers(
  bot: Bot<Context>,
  apiKey: string,
  rateLimiter: RateLimit,
  searchCache: KinoriumSearchCache,
  stats: StatsRecorder
): void {
  // When user types: @YourBot hello
  bot.inlineQuery(/.*/, async (ctx) => {
    try {
      const searchText = ctx.inlineQuery.query.trim()

      // Empty queries never reach Kinorium.
      if (searchText.length === 0) {
        await answerInlineQuery(ctx, [])
        return
      }

      if (!(await isWithinRateLimit(rateLimiter, 'inline', ctx.from?.id))) {
        await answerInlineQuery(ctx, [
          buildInlineErrorResult(ctx.i18n, 'rate_limit'),
        ])
        return
      }

      const searchResult = await searchMoviesDetailed(
        searchText,
        apiKey,
        ctx.dbuser.language,
        fetch,
        searchCache,
        () => {
          stats.record('api_call')
        }
      )

      if (searchResult.kind === 'error') {
        await answerInlineQuery(ctx, [buildInlineErrorResult(ctx.i18n, 'api')])
        return
      }

      const labels = {
        movie: ctx.i18n.t('inline.movie'),
        tvSeries: ctx.i18n.t('inline.tv_series'),
      }
      const results = searchResult.movies
        .slice(0, INLINE_RESULT_LIMIT)
        .map((movie) =>
          buildMovieResult(
            movie,
            ctx.dbuser.language,
            labels,
            ctx.inlineQuery.id
          )
        )

      await answerInlineQuery(
        ctx,
        results.length > 0 ? results : [buildNoResultsResult(ctx, searchText)]
      )
    } catch (error) {
      logError('inline_query_failed', error)
      await answerInlineQuery(ctx, [
        buildInlineErrorResult(ctx.i18n, 'unexpected'),
      ])
    }
  })
}

export default function createBot(
  env: CloudflareBindings,
  searchCache: KinoriumSearchCache,
  stats: StatsRecorder
): Bot<Context> {
  const bot = new Bot<Context>(env.TOKEN, {
    ContextConstructor: Context,
    botInfo: env.BOT_INFO,
  })
  const commandHandlers = buildCommandHandlers(env)

  bot.use(ignoreUnhandledUpdates(Object.keys(commandHandlers)))
  bot.use(attachUser(env.DB))
  bot.use(recordActivity(stats))
  bot.use(localize)
  bot.use(configureI18n)
  registerLanguageMenu(bot)
  registerInlineQueryHandlers(
    bot,
    env.APIKEY,
    env.INLINE_RATE_LIMITER,
    searchCache,
    stats
  )
  // Telegram only sends this update while inline feedback is enabled in
  // BotFather; see docs/DEPLOY.md.
  bot.on('chosen_inline_result', () => {
    stats.record('sent_result')
  })
  for (const [command, handler] of Object.entries(commandHandlers)) {
    bot.command(command, handler)
  }
  bot.catch((error) => {
    // Swallowed on purpose: rethrowing makes the webhook answer 500, and
    // Telegram then redelivers the same update ahead of every later one.
    logError('telegram_update_failed', error.error)
  })

  return bot
}
