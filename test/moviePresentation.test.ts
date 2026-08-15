import { describe, expect, it } from 'vitest'
import { buildMoviePresentation } from '@/helpers/moviePresentation'

describe('movie presentation', () => {
  it('uses the original title as the English title', () => {
    expect(
      buildMoviePresentation(
        {
          id: 150802,
          mixtype: 'movie',
          name: 'Терминатор 3: Восстание машин',
          name_orig: 'Terminator 3: Rise of the Machines',
          year: 2003,
          url: 'https://en.kinorium.com/150802/',
        },
        'en',
        { movie: 'Movie', tvSeries: 'TV series' }
      )
    ).toEqual({
      title: 'Terminator 3: Rise of the Machines',
      description: 'Movie (2003)',
      message:
        'Movie <a href="https://en.kinorium.com/150802/">«Terminator 3: Rise of the Machines»</a> (2003)',
    })
  })

  it('includes a different original title and an open-ended series year', () => {
    expect(
      buildMoviePresentation(
        {
          id: 774825,
          mixtype: 'movie',
          name: 'Останні з нас',
          name_orig: 'The Last of Us',
          year_serial_b: 2023,
          isSerial: true,
          url: 'https://ua.kinorium.com/774825/',
        },
        'uk',
        { movie: 'Фільм', tvSeries: 'Серіал' }
      )
    ).toEqual({
      title: 'Останні з нас',
      description: 'Серіал (2023–…)',
      message:
        'Серіал <a href="https://ua.kinorium.com/774825/">«Останні з нас»</a> (2023–…, The Last of Us)',
    })
  })

  it('escapes Telegram HTML after decoding movie titles', () => {
    expect(
      buildMoviePresentation(
        {
          id: 1,
          mixtype: 'movie',
          name: 'Tom & Jerry <Again>',
          name_orig: 'Tom & Jerry <Again>',
          year: 2026,
          url: 'https://en.kinorium.com/1/',
        },
        'en',
        { movie: 'Movie', tvSeries: 'TV series' }
      ).message
    ).toBe(
      'Movie <a href="https://en.kinorium.com/1/">«Tom &amp; Jerry &lt;Again&gt;»</a> (2026)'
    )
  })

  it('escapes a different original title inside the details', () => {
    expect(
      buildMoviePresentation(
        {
          id: 1,
          mixtype: 'movie',
          name: 'Том і Джеррі',
          name_orig: 'Tom & Jerry <Again>',
          year: 2026,
          url: 'https://ua.kinorium.com/1/',
        },
        'uk',
        { movie: 'Фільм', tvSeries: 'Серіал' }
      ).message
    ).toBe(
      'Фільм <a href="https://ua.kinorium.com/1/">«Том і Джеррі»</a> (2026, Tom &amp; Jerry &lt;Again&gt;)'
    )
  })
})
