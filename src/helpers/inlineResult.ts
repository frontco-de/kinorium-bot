const INLINE_QUERY_ID_SUFFIX_LENGTH = 32

export default function buildInlineMovieResultId(
  inlineQueryId: string,
  movieId: number
): string {
  const querySuffix = inlineQueryId.slice(-INLINE_QUERY_ID_SUFFIX_LENGTH)
  return `movie-${movieId}-${querySuffix}`
}
