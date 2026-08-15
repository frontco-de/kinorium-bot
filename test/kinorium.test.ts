import { describe, expect, it, vi } from 'vitest'
import {
  type KinoriumSearchCache,
  searchMoviesDetailed,
} from '@/helpers/kinorium'

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
          {
            id: 124,
            mixtype: 'movie',
            name: 'Дюна: Частина друга',
            year: 2024,
          },
        ],
      })
    )
    const setCache = vi.fn<KinoriumSearchCache['set']>()
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: setCache,
    }

    await expect(
      searchMoviesDetailed('Dune 2021', 'secret', 'uk', fetcher, searchCache)
    ).resolves.toMatchObject({
      kind: 'ok',
      movies: [
        {
          id: 123,
          name: 'Дюна 2021',
          url: 'https://ua.kinorium.com/123/',
        },
        {
          id: 124,
          name: 'Дюна: Частина друга',
          name_orig: '',
          url: 'https://ua.kinorium.com/124/',
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
    expect(setCache).toHaveBeenCalledOnce()
  })

  it('returns a successful cached search without calling Kinorium', async () => {
    const cachedResult = {
      kind: 'ok' as const,
      movies: [
        {
          id: 123,
          mixtype: 'movie',
          name: 'Dune',
          name_orig: 'Dune',
          year: 2021,
          url: 'https://en.kinorium.com/123/',
        },
      ],
    }
    const setCache = vi.fn<KinoriumSearchCache['set']>()
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(cachedResult),
      set: setCache,
    }
    const fetcher = vi.fn<typeof fetch>()

    await expect(
      searchMoviesDetailed('Dune', 'secret', 'en', fetcher, searchCache)
    ).resolves.toEqual(cachedResult)
    expect(fetcher).not.toHaveBeenCalled()
    expect(setCache).not.toHaveBeenCalled()
  })

  it('classifies an expected empty response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: { code: 404, message: 'Not found' } })
      )
    const setCache = vi.fn<KinoriumSearchCache['set']>()
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: setCache,
    }

    await expect(
      searchMoviesDetailed('missing', 'secret', 'en', fetcher, searchCache)
    ).resolves.toEqual({ kind: 'no_results', movies: [] })
    expect(setCache).not.toHaveBeenCalled()
  })

  it('returns an error for an upstream server failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 500 }))
    const setCache = vi.fn<KinoriumSearchCache['set']>()
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: setCache,
    }

    await expect(
      searchMoviesDetailed('Dune', 'secret', 'en', fetcher, searchCache)
    ).resolves.toEqual({ kind: 'error', movies: [] })
    expect(setCache).not.toHaveBeenCalled()
  })

  it('returns an error for malformed data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ unexpected: true }))
    const setCache = vi.fn<KinoriumSearchCache['set']>()
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: setCache,
    }

    await expect(
      searchMoviesDetailed('Dune', 'secret', 'en', fetcher, searchCache)
    ).resolves.toEqual({ kind: 'error', movies: [] })
    expect(setCache).not.toHaveBeenCalled()
  })
})
