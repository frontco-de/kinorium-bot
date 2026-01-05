import env from '@/helpers/env'

interface KinoriumMovie {
  id: number
  mixtype: string
  name: string
  name_orig: string
  year?: number
  year_serial_b?: number
  year_serial_e?: number
  isSerial?: boolean
  poster?: string
}

type KinoriumMovieWithUrl = KinoriumMovie & { url: string }

interface KinoriumResponse {
  movie_list: KinoriumMovie[]
  error?: {
    code: number
    message: string
  }
}

const REQUEST_TIMEOUT_MS = 7_000

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export function getKinoriumMovieUrl(id: number | string) {
  return `https://kinorium.com/${id}/`
}

export function addKinoriumMovieUrls(movies: KinoriumMovie[]): KinoriumMovieWithUrl[] {
  return movies.map((movie) => ({
    ...movie,
    url: getKinoriumMovieUrl(movie.id),
  }))
}

type KinoriumSearchResult =
  | { kind: 'ok'; movies: KinoriumMovieWithUrl[] }
  | { kind: 'no_results'; movies: [] }
  | { kind: 'error'; movies: [] }

function isNoResultsError(error: NonNullable<KinoriumResponse['error']>): boolean {
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
export async function searchMoviesDetailed(query: string): Promise<KinoriumSearchResult> {
  try {
    // Clean the API key (remove any trailing &q if present)
    const apiKey = env.APIKEY.replace(/&q$/, '').trim()

    // Encode the query for URL
    const encodedQuery = encodeURIComponent(query)

    // Build the API URL
    const url = `https://db.kinorium.com/search/?apikey=${apiKey}&q=${encodedQuery}`

    console.log('Making request to Kinorium API')

    // Make the request
    const response = await fetchWithTimeout(url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = (await response.json()) as KinoriumResponse

    // Check for API errors
    if (data.error) {
      console.error('Kinorium API error:', data.error)
      if (isNoResultsError(data.error)) {
        return { kind: 'no_results', movies: [] }
      }
      return { kind: 'error', movies: [] }
    }

    // Return the movie list
    return { kind: 'ok', movies: addKinoriumMovieUrls(data.movie_list || []) }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error searching Kinorium API:', errorMessage)
    return { kind: 'error', movies: [] }
  }
}

export async function searchMovies(query: string): Promise<KinoriumMovieWithUrl[]> {
  const result = await searchMoviesDetailed(query)
  return result.movies
}

export type { KinoriumMovie, KinoriumMovieWithUrl, KinoriumResponse, KinoriumSearchResult }
