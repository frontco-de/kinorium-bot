import { type KinoriumMovieWithUrl } from '@/helpers/kinorium'
import { type SupportedLocale } from '@/helpers/locales'

export interface MovieLabels {
  movie: string
  tvSeries: string
}

export interface MoviePresentation {
  description: string
  message: string
  title: string
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatYear(movie: KinoriumMovieWithUrl): string {
  if (!movie.isSerial) return String(movie.year ?? '')

  const start = movie.year_serial_b ?? movie.year
  if (start === undefined) return ''
  if (movie.year_serial_e === undefined) return `${start}–…`
  if (movie.year_serial_e === start) return String(start)
  return `${start}–${movie.year_serial_e}`
}

function selectTitle(
  movie: KinoriumMovieWithUrl,
  language: SupportedLocale
): string {
  if (language === 'en') return movie.name_orig || movie.name
  return movie.name || movie.name_orig
}

function linkedTitle(title: string, url: string): string {
  return `<a href="${escapeTelegramHtml(url)}">«${escapeTelegramHtml(title)}»</a>`
}

export function buildMoviePresentation(
  movie: KinoriumMovieWithUrl,
  language: SupportedLocale,
  labels: MovieLabels
): MoviePresentation {
  const title = selectTitle(movie, language).trim()
  const originalTitle = movie.name_orig.trim()
  const type = movie.isSerial ? labels.tvSeries : labels.movie
  const year = formatYear(movie)
  const hasDifferentOriginalTitle =
    originalTitle.length > 0 &&
    originalTitle.toLowerCase() !== title.toLowerCase()
  const details = [
    year,
    hasDifferentOriginalTitle ? escapeTelegramHtml(originalTitle) : '',
  ].filter(Boolean)
  const detailsSuffix = details.length > 0 ? ` (${details.join(', ')})` : ''

  return {
    title,
    description: `${type}${year ? ` (${year})` : ''}`,
    message: `${type} ${linkedTitle(title, movie.url)}${detailsSuffix}`,
  }
}
