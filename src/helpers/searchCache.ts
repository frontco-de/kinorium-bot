import {
  isKinoriumMovieWithUrl,
  type KinoriumSearchCache,
  type KinoriumSearchResult,
} from '@/helpers/kinorium'
import { type SupportedLocale } from '@/helpers/locales'
import logError from '@/helpers/logging'

const CACHE_TTL_SECONDS = 5 * 60
// Short, so a newly indexed title is not hidden for long behind a cached miss.
const NO_RESULTS_TTL_SECONDS = 60
const encoder = new TextEncoder()

type CacheStore = Pick<Cache, 'match' | 'put'>
type BackgroundContext = Pick<ExecutionContext, 'waitUntil'>
type CacheableSearchResult = Extract<
  KinoriumSearchResult,
  { kind: 'ok' | 'no_results' }
>
type SuccessfulSearchResult = Extract<KinoriumSearchResult, { kind: 'ok' }>

function isSuccessfulSearchResult(
  value: Record<string, unknown>
): value is SuccessfulSearchResult {
  return (
    value.kind === 'ok' &&
    Array.isArray(value.movies) &&
    value.movies.every(isKinoriumMovieWithUrl)
  )
}

function isCacheableSearchResult(
  value: unknown
): value is CacheableSearchResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  if (result.kind === 'no_results') {
    return Array.isArray(result.movies) && result.movies.length === 0
  }
  return isSuccessfulSearchResult(result)
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
      return isCacheableSearchResult(value) ? value : undefined
    } catch (error) {
      logError('kinorium_search_cache_read_failed', error)
      return undefined
    }
  }

  function set(
    query: string,
    language: SupportedLocale,
    result: CacheableSearchResult
  ): void {
    const ttlSeconds =
      result.kind === 'ok' ? CACHE_TTL_SECONDS : NO_RESULTS_TTL_SECONDS
    const write = async () => {
      const key = await cacheKey(query, language)
      const response = Response.json(result, {
        headers: { 'Cache-Control': `max-age=${ttlSeconds}` },
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
