import { type SupportedLocale } from '@/helpers/locales'

export interface KinoriumMovie {
  id: number
  mixtype: string
  name?: string
  name_orig?: string
  year?: number
  year_serial_b?: number
  year_serial_e?: number
  isSerial?: boolean
  poster?: string
}

type KinoriumMovieWithUrl = Omit<KinoriumMovie, 'name' | 'name_orig'> & {
  name: string
  name_orig: string
  url: string
}

interface KinoriumResponse {
  movie_list: KinoriumMovie[]
  error?: {
    code: number
    message: string
  }
}

const REQUEST_TIMEOUT_MS = 7_000
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

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  init?: RequestInit
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
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

export function getKinoriumMovieUrl(
  id: number | string,
  language: SupportedLocale
) {
  return `https://${KINORIUM_LOCALES[language]}.kinorium.com/${id}/`
}

export function addKinoriumMovieUrls(
  movies: KinoriumMovie[],
  language: SupportedLocale
): KinoriumMovieWithUrl[] {
  return movies
    .map((movie) => ({
      ...movie,
      name: decodeHtmlEntities(movie.name),
      name_orig: decodeHtmlEntities(movie.name_orig),
      url: getKinoriumMovieUrl(movie.id, language),
    }))
    .filter((movie) => movie.name.length > 0 || movie.name_orig.length > 0)
}

type KinoriumSearchResult =
  | { kind: 'ok'; movies: KinoriumMovieWithUrl[] }
  | { kind: 'no_results'; movies: [] }
  | { kind: 'error'; movies: [] }

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

function isNoResultsError(
  error: NonNullable<KinoriumResponse['error']>
): boolean {
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

/**
 * Search for movies using the Kinorium API
 * @param query - Search query string
 * @returns Promise with result kind + movies
 */
export async function searchMoviesDetailed(
  query: string,
  apiKey: string,
  language: SupportedLocale,
  fetcher: Fetcher = fetch,
  searchCache?: KinoriumSearchCache
): Promise<KinoriumSearchResult> {
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

    const response = await fetchWithTimeout(fetcher, url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: unknown = await response.json()
    if (typeof data !== 'object' || data === null) {
      throw new Error('Kinorium returned an invalid response')
    }
    const result = data as Partial<KinoriumResponse>

    if (result.error) {
      if (isNoResultsError(result.error)) {
        return { kind: 'no_results', movies: [] }
      }
      return { kind: 'error', movies: [] }
    }

    if (!Array.isArray(result.movie_list)) {
      throw new Error('Kinorium response is missing movie_list')
    }
    const searchResult = {
      kind: 'ok',
      movies: addKinoriumMovieUrls(result.movie_list, language),
    } satisfies KinoriumSearchResult
    if (searchResult.movies.length > 0) {
      searchCache?.set(query, language, searchResult)
    }
    return searchResult
  } catch (error) {
    const errorType = error instanceof Error ? error.name : 'UnknownError'
    console.error(
      JSON.stringify({ event: 'kinorium_search_failed', error: errorType })
    )
    return { kind: 'error', movies: [] }
  }
}

export async function searchMovies(
  query: string,
  apiKey: string,
  language: SupportedLocale,
  fetcher: Fetcher = fetch
): Promise<KinoriumMovieWithUrl[]> {
  const result = await searchMoviesDetailed(query, apiKey, language, fetcher)
  return result.movies
}

export type {
  Fetcher,
  KinoriumMovieWithUrl,
  KinoriumResponse,
  KinoriumSearchResult,
}
