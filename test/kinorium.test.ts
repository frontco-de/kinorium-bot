import { describe, expect, it, vi } from 'vitest'
import { searchMoviesDetailed } from '@/helpers/kinorium'

describe('Kinorium search', () => {
  it('maps movies to public Kinorium URLs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        movie_list: [
          {
            id: 123,
            mixtype: 'movie',
            name: 'Дюна&#160;2021',
            name_orig: 'Dune',
            year: 2021,
          },
        ],
      })
    )

    await expect(
      searchMoviesDetailed('Dune 2021', 'secret', 'uk', fetcher)
    ).resolves.toMatchObject({
      kind: 'ok',
      movies: [
        {
          id: 123,
          name: 'Дюна 2021',
          url: 'https://ua.kinorium.com/123/',
        },
      ],
    })
    expect(fetcher).toHaveBeenCalledOnce()
    const call = fetcher.mock.calls[0]
    if (!call) throw new Error('Expected Kinorium fetch call')
    expect(call[0]).toBe(
      'https://db.kinorium.com/search/?apikey=secret&q=Dune%202021&lng=ua'
    )
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('classifies an expected empty response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: { code: 404, message: 'Not found' } })
      )

    await expect(
      searchMoviesDetailed('missing', 'secret', 'en', fetcher)
    ).resolves.toEqual({ kind: 'no_results', movies: [] })
  })

  it('returns an error for malformed data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ unexpected: true }))

    await expect(
      searchMoviesDetailed('Dune', 'secret', 'en', fetcher)
    ).resolves.toEqual({ kind: 'error', movies: [] })
  })
})
