import { type KinoriumMovieWithUrl } from '@/helpers/kinorium'
import { type SupportedLocale } from '@/helpers/locales'

export interface MovieLabels {
  movie: string
  present: string
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

function formatYear(movie: KinoriumMovieWithUrl, presentLabel: string): string {
  if (!movie.isSerial) return String(movie.year ?? '')

  const start = movie.year_serial_b ?? movie.year
  if (start === undefined) return ''
  if (movie.year_serial_e === undefined) return `${start}–${presentLabel}`
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
  return `<a href="${escapeTelegramHtml(url)}">${escapeTelegramHtml(title)}</a>`
}

export function buildMoviePresentation(
  movie: KinoriumMovieWithUrl,
  language: SupportedLocale,
  labels: MovieLabels
): MoviePresentation {
  const title = selectTitle(movie, language).trim()
  const originalTitle = movie.name_orig.trim()
  const type = movie.isSerial ? labels.tvSeries : labels.movie
  const year = formatYear(movie, labels.present)
  const yearSuffix = year ? ` (${year})` : ''
  const titleLinks = [title, originalTitle]
    .filter(
      (value, index, titles) =>
        value.length > 0 &&
        titles.findIndex(
          (candidate) => candidate.toLowerCase() === value.toLowerCase()
        ) === index
    )
    .map((value) => linkedTitle(value, movie.url))
    .join(' / ')

  return {
    title,
    description: `${type}${yearSuffix}`,
    message: `${type} ${titleLinks}${yearSuffix}`,
  }
}
