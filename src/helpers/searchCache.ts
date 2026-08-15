import {
  type KinoriumMovieWithUrl,
  type KinoriumSearchCache,
  type KinoriumSearchResult,
} from '@/helpers/kinorium'
import { type SupportedLocale } from '@/helpers/locales'

const CACHE_TTL_SECONDS = 5 * 60
const encoder = new TextEncoder()

type CacheStore = Pick<Cache, 'match' | 'put'>
type BackgroundContext = Pick<ExecutionContext, 'waitUntil'>
type SuccessfulSearchResult = Extract<KinoriumSearchResult, { kind: 'ok' }>

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMovie(value: unknown): value is KinoriumMovieWithUrl {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.mixtype === 'string' &&
    typeof value.name === 'string' &&
    typeof value.name_orig === 'string' &&
    typeof value.url === 'string' &&
    isOptionalNumber(value.year) &&
    isOptionalNumber(value.year_serial_b) &&
    isOptionalNumber(value.year_serial_e) &&
    (value.isSerial === undefined || typeof value.isSerial === 'boolean') &&
    (value.poster === undefined || typeof value.poster === 'string')
  )
}

function isSuccessfulSearchResult(
  value: unknown
): value is SuccessfulSearchResult {
  if (!isRecord(value)) return false
  return (
    value.kind === 'ok' &&
    Array.isArray(value.movies) &&
    value.movies.every(isMovie)
  )
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError'
}

async function hashSearch(query: string, language: SupportedLocale) {
  const input = encoder.encode(`${language}\n${query.trim()}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export default function createSearchCache(
  cache: CacheStore,
  ctx: BackgroundContext,
  origin: string
): KinoriumSearchCache {
  const cacheOrigin = new URL(origin).origin

  async function cacheKey(query: string, language: SupportedLocale) {
    const digest = await hashSearch(query, language)
    return new Request(`${cacheOrigin}/__cache/kinorium-search/${digest}`)
  }

  async function get(
    query: string,
    language: SupportedLocale
  ): Promise<KinoriumSearchResult | undefined> {
    try {
      const response = await cache.match(await cacheKey(query, language))
      if (response === undefined) return undefined
      const value: unknown = await response.json()
      return isSuccessfulSearchResult(value) ? value : undefined
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'kinorium_search_cache_read_failed',
          error: errorType(error),
        })
      )
      return undefined
    }
  }

  function set(
    query: string,
    language: SupportedLocale,
    result: SuccessfulSearchResult
  ): void {
    const write = async () => {
      const key = await cacheKey(query, language)
      const response = Response.json(result, {
        headers: { 'Cache-Control': `max-age=${CACHE_TTL_SECONDS}` },
      })
      await cache.put(key, response)
    }
    ctx.waitUntil(
      write().catch((error) => {
        console.error(
          JSON.stringify({
            event: 'kinorium_search_cache_write_failed',
            error: errorType(error),
          })
        )
      })
    )
  }

  return { get, set }
}
