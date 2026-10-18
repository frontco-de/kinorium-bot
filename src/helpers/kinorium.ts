import { type SupportedLocale } from '@/helpers/locales'
import logError from '@/helpers/logging'

/** A search result after validation, ready for presentation. */
export interface KinoriumMovieWithUrl {
  id: number
  mixtype: string
  name: string
  name_orig: string
  url: string
  // Explicit `undefined` because validation yields a value for every field,
  // present or not, and `exactOptionalPropertyTypes` distinguishes the two.
  year?: number | undefined
  year_serial_b?: number | undefined
  year_serial_e?: number | undefined
  isSerial?: boolean | undefined
  poster?: string | undefined
}

interface KinoriumError {
  code: number
  message: string
}

const REQUEST_TIMEOUT_MS = 7_000
// With a deferred search nobody waits for the fetch, so it may run for as long
// as the platform keeps the Worker alive after the response (`waitUntil`).
const BACKGROUND_REQUEST_TIMEOUT_MS = 20_000
// Searches slower than this are logged so latency from the Worker is visible.
const SLOW_SEARCH_MS = 3_000
const KINORIUM_LOCALES: Record<SupportedLocale, 'en' | 'ru' | 'ua'> = {
  en: 'en',
  ru: 'ru',
  uk: 'ua',
}
const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  timeoutMs: number,
  init?: RequestInit
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetcher(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function decodeHtmlEntities(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(
    /&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi,
    (entity, code: string) => {
      if (!code.startsWith('#')) {
        return HTML_ENTITIES[code.toLowerCase()] ?? entity
      }

      const hexadecimal = code[1]?.toLowerCase() === 'x'
      const codePoint = Number.parseInt(
        code.slice(hexadecimal ? 2 : 1),
        hexadecimal ? 16 : 10
      )
      if (
        !Number.isInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return entity
      }
      return String.fromCodePoint(codePoint).replace(/\u00a0/g, ' ')
    }
  )
}

/**
 * Kinorium is untyped JSON, so ids and years may arrive as numeric strings.
 * Coercing keeps them usable while rejecting anything that is not a number.
 */
function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Serial flags have been observed as booleans and as 0/1 numbers. */
function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return undefined
}

/**
 * Poster URLs are forwarded to Telegram as thumbnails, so only absolute HTTPS
 * URLs from the upstream response are accepted.
 */
function toPosterUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    return new URL(value).protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

function getKinoriumMovieUrl(id: number, language: SupportedLocale) {
  return `https://${KINORIUM_LOCALES[language]}.kinorium.com/${id}/`
}

/**
 * Validates one untrusted search record. Records without a usable id or title
 * are dropped rather than partially rendered.
 */
function toMovieWithUrl(
  value: unknown,
  language: SupportedLocale
): KinoriumMovieWithUrl | undefined {
  if (!isRecord(value)) return undefined

  const id = toOptionalNumber(value.id)
  if (id === undefined || !Number.isInteger(id) || id <= 0) return undefined

  const name = decodeHtmlEntities(value.name)
  const nameOriginal = decodeHtmlEntities(value.name_orig)
  if (name.length === 0 && nameOriginal.length === 0) return undefined

  return {
    id,
    mixtype: typeof value.mixtype === 'string' ? value.mixtype : '',
    name,
    name_orig: nameOriginal,
    url: getKinoriumMovieUrl(id, language),
    year: toOptionalNumber(value.year),
    year_serial_b: toOptionalNumber(value.year_serial_b),
    year_serial_e: toOptionalNumber(value.year_serial_e),
    isSerial: toOptionalBoolean(value.isSerial),
    poster: toPosterUrl(value.poster),
  }
}

function toMoviesWithUrls(
  movies: unknown[],
  language: SupportedLocale
): KinoriumMovieWithUrl[] {
  return movies
    .map((movie) => toMovieWithUrl(movie, language))
    .filter((movie): movie is KinoriumMovieWithUrl => movie !== undefined)
}

/** Validates a movie restored from the cache, which stores this exact shape. */
export function isKinoriumMovieWithUrl(
  value: unknown
): value is KinoriumMovieWithUrl {
  if (!isRecord(value)) return false
  const isOptionalNumber = (field: unknown) =>
    field === undefined || typeof field === 'number'
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

type KinoriumSearchResult =
  | { kind: 'ok'; movies: KinoriumMovieWithUrl[] }
  | { kind: 'no_results'; movies: [] }
  | { kind: 'error'; movies: [] }
  // The deadline passed; the search keeps running and fills the cache.
  | { kind: 'pending'; movies: [] }

/**
 * Lets a slow search outlive the caller's patience. Telegram stops accepting an
 * answer a few seconds after the user types, but Kinorium sometimes needs
 * longer: past `deadlineMs` the caller gets `pending` while the fetch finishes
 * in the background and lands in the search cache for the user's retry.
 */
export interface DeferredSearch {
  deadlineMs: number
  waitUntil(promise: Promise<unknown>): void
}

export interface KinoriumSearchCache {
  get(
    query: string,
    language: SupportedLocale
  ): Promise<KinoriumSearchResult | undefined>
  set(
    query: string,
    language: SupportedLocale,
    result: Extract<KinoriumSearchResult, { kind: 'ok' }>
  ): void
}

function toKinoriumError(value: unknown): KinoriumError | undefined {
  if (!isRecord(value)) return undefined
  const code = typeof value.code === 'number' ? value.code : 0
  const message = typeof value.message === 'string' ? value.message : ''
  return { code, message }
}

function isNoResultsError(error: KinoriumError): boolean {
  if (error.code === 404) {
    return true
  }
  const message = error.message.toLowerCase()
  return (
    message.includes('no results') ||
    message.includes('nothing found') ||
    message.includes('not found') ||
    message.includes('не найден') ||
    message.includes('ничего') ||
    message.includes('нічого')
  )
}

async function runSearch(
  query: string,
  apiKey: string,
  language: SupportedLocale,
  fetcher: Fetcher,
  searchCache: KinoriumSearchCache | undefined,
  onApiCall: (() => void) | undefined,
  timeoutMs: number
): Promise<KinoriumSearchResult> {
  let startedAt: number | undefined
  let status: number | undefined
  try {
    const cachedResult = await searchCache?.get(query, language)
    if (cachedResult !== undefined) return cachedResult

    const cleanApiKey = apiKey.replace(/&q$/, '').trim()

    // Encode the query for URL
    const encodedQuery = encodeURIComponent(query)

    // Build the API URL
    const encodedApiKey = encodeURIComponent(cleanApiKey)
    const kinoriumLocale = KINORIUM_LOCALES[language]
    const url = `https://db.kinorium.com/search/?apikey=${encodedApiKey}&q=${encodedQuery}&lng=${kinoriumLocale}`

    onApiCall?.()
    startedAt = Date.now()
    const response = await fetchWithTimeout(fetcher, url, timeoutMs)
    status = response.status

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: unknown = await response.json()
    // Measured after the body: the abort timer stops once headers arrive, so a
    // stalled body would otherwise look like a fast search.
    const elapsed = Date.now() - startedAt
    if (elapsed > SLOW_SEARCH_MS) {
      logError('kinorium_search_slow', undefined, { ms: elapsed })
    }
    if (!isRecord(data)) {
      throw new Error('Kinorium returned an invalid response')
    }

    if (data.error !== undefined && data.error !== null) {
      const error = toKinoriumError(data.error)
      if (error && isNoResultsError(error)) {
        return { kind: 'no_results', movies: [] }
      }
      return { kind: 'error', movies: [] }
    }

    if (!Array.isArray(data.movie_list)) {
      throw new Error('Kinorium response is missing movie_list')
    }
    const searchResult = {
      kind: 'ok',
      movies: toMoviesWithUrls(data.movie_list, language),
    } satisfies KinoriumSearchResult
    if (searchResult.movies.length > 0) {
      searchCache?.set(query, language, searchResult)
    }
    return searchResult
  } catch (error) {
    logError('kinorium_search_failed', error, {
      ms: startedAt === undefined ? undefined : Date.now() - startedAt,
      status,
    })
    return { kind: 'error', movies: [] }
  }
}

/**
 * Search for movies using the Kinorium API
 * @param query - Search query string
 * @param onApiCall - Called once per upstream request, so cache hits are not
 * counted as searches
 * @param deferred - When set, a search slower than its deadline resolves as
 * `pending` and completes in the background
 * @returns Promise with result kind + movies
 */
export async function searchMoviesDetailed(
  query: string,
  apiKey: string,
  language: SupportedLocale,
  fetcher: Fetcher = fetch,
  searchCache?: KinoriumSearchCache,
  onApiCall?: () => void,
  deferred?: DeferredSearch
): Promise<KinoriumSearchResult> {
  if (deferred === undefined) {
    return runSearch(
      query,
      apiKey,
      language,
      fetcher,
      searchCache,
      onApiCall,
      REQUEST_TIMEOUT_MS
    )
  }

  const search = runSearch(
    query,
    apiKey,
    language,
    fetcher,
    searchCache,
    onApiCall,
    BACKGROUND_REQUEST_TIMEOUT_MS
  )
  let deadlineId: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<'deadline'>((resolve) => {
    deadlineId = setTimeout(() => {
      resolve('deadline')
    }, deferred.deadlineMs)
  })
  try {
    const winner = await Promise.race([search, deadline])
    if (winner !== 'deadline') return winner
    deferred.waitUntil(search)
    return { kind: 'pending', movies: [] }
  } finally {
    if (deadlineId !== undefined) clearTimeout(deadlineId)
  }
}

export type { Fetcher, KinoriumSearchResult }
