import { describe, expect, it } from 'vitest'
import buildInlineMovieResultId from '@/helpers/inlineResult'

describe('inline result identifiers', () => {
  it('uses different result IDs for different inline queries', () => {
    expect(buildInlineMovieResultId('query-1', 150802)).not.toBe(
      buildInlineMovieResultId('query-2', 150802)
    )
  })

  it('stays within the Telegram result ID limit', () => {
    expect(
      buildInlineMovieResultId('q'.repeat(100), Number.MAX_SAFE_INTEGER).length
    ).toBeLessThanOrEqual(64)
  })
})
