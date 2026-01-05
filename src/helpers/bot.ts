import { Bot, InlineQueryResultBuilder as R } from 'grammy'
import { searchMoviesDetailed } from '@/helpers/kinorium'
import Context from '@/models/Context'
import env from '@/helpers/env'

export const bot = new Bot<Context>(env.TOKEN, {
  ContextConstructor: Context,
})

const INLINE_QUERY_CACHE_TIME_SECONDS = 600

export function registerInlineQueryHandlers() {
  // When user types: @YourBot hello
  bot.inlineQuery(/.*/, async (ctx) => {
    try {
      const searchText = ctx.inlineQuery.query || ''

      // If query is empty, return empty results without making API request
      if (!searchText.trim()) {
        await ctx.answerInlineQuery([], { cache_time: 30 })
        return
      }

      // Log the search text for debugging
      console.log('Received inline query:', searchText)
      console.log('From user:', ctx.from?.username || ctx.from?.id)

      const searchResult = await searchMoviesDetailed(searchText)

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

      // Log the movie list
      console.log('Movies found:', movies.length)
      console.log('Movie list:', JSON.stringify(movies, null, 2))

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

export default bot
