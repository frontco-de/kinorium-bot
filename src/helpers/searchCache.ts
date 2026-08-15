import {
  isKinoriumMovieWithUrl,
  type KinoriumSearchCache,
  type KinoriumSearchResult,
} from '@/helpers/kinorium'
import { type SupportedLocale } from '@/helpers/locales'
import logError from '@/helpers/logging'

const CACHE_TTL_SECONDS = 5 * 60
const encoder = new TextEncoder()

type CacheStore = Pick<Cache, 'match' | 'put'>
type BackgroundContext = Pick<ExecutionContext, 'waitUntil'>
type SuccessfulSearchResult = Extract<KinoriumSearchResult, { kind: 'ok' }>

function isSuccessfulSearchResult(
  value: unknown
): value is SuccessfulSearchResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (
    result.kind === 'ok' &&
    Array.isArray(result.movies) &&
    result.movies.every(isKinoriumMovieWithUrl)
  )
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
      logError('kinorium_search_cache_read_failed', error)
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
      write().catch((error: unknown) => {
        logError('kinorium_search_cache_write_failed', error)
      })
    )
  }

  return { get, set }
}
