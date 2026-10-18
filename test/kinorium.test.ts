import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type DeferredSearch,
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

  it('reports one API call per upstream request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ movie_list: [] }))
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn<KinoriumSearchCache['set']>(),
    }
    const onApiCall = vi.fn()

    await searchMoviesDetailed(
      'Dune',
      'secret',
      'en',
      fetcher,
      searchCache,
      onApiCall
    )

    expect(onApiCall).toHaveBeenCalledOnce()
  })

  it('does not report an API call for a cache hit', async () => {
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue({ kind: 'ok', movies: [] }),
      set: vi.fn<KinoriumSearchCache['set']>(),
    }
    const onApiCall = vi.fn()

    await searchMoviesDetailed(
      'Dune',
      'secret',
      'en',
      vi.fn<typeof fetch>(),
      searchCache,
      onApiCall
    )

    expect(onApiCall).not.toHaveBeenCalled()
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

  it('normalizes loosely typed records and drops unusable ones', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        movie_list: [
          {
            id: '123',
            mixtype: 'tvseries',
            name: 'Futurama',
            name_orig: 'Futurama',
            year: '1999',
            year_serial_b: '1999',
            isSerial: 1,
            poster: 'https://kinorium.com/{$image_size_id}/poster.jpg',
          },
          // No usable title.
          { id: 124, mixtype: 'movie' },
          // No usable id.
          { id: 'not-a-number', name: 'Broken' },
          // Not a record.
          'nonsense',
        ],
      })
    )
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn(),
    }

    await expect(
      searchMoviesDetailed('Futurama', 'secret', 'en', fetcher, searchCache)
    ).resolves.toEqual({
      kind: 'ok',
      movies: [
        {
          id: 123,
          mixtype: 'tvseries',
          name: 'Futurama',
          name_orig: 'Futurama',
          url: 'https://en.kinorium.com/123/',
          year: 1999,
          year_serial_b: 1999,
          year_serial_e: undefined,
          isSerial: true,
          poster: 'https://kinorium.com/{$image_size_id}/poster.jpg',
        },
      ],
    })
  })

  it('drops poster URLs that Telegram must not fetch', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        movie_list: [
          {
            id: 125,
            mixtype: 'movie',
            name: 'Dune',
            name_orig: 'Dune',
            poster: 'javascript:alert(1)',
          },
          {
            id: 126,
            mixtype: 'movie',
            name: 'Dune II',
            name_orig: 'Dune II',
            poster: { unexpected: true },
          },
        ],
      })
    )
    const searchCache: KinoriumSearchCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn(),
    }

    const result = await searchMoviesDetailed(
      'Dune',
      'secret',
      'en',
      fetcher,
      searchCache
    )

    expect(result.movies.map((movie) => movie.poster)).toEqual([
      undefined,
      undefined,
    ])
  })

  describe('timing diagnostics', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    function spyOnLog() {
      return vi.spyOn(console, 'error').mockImplementation(() => undefined)
    }

    function loggedEvents(log: ReturnType<typeof spyOnLog>) {
      return log.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)
    }

    function respondAfter(ms: number, response: () => Response) {
      return vi.fn<typeof fetch>().mockImplementation(() => {
        vi.advanceTimersByTime(ms)
        return Promise.resolve(response())
      })
    }

    it('logs only the duration of a slow successful search', async () => {
      vi.useFakeTimers()
      const log = spyOnLog()
      const fetcher = respondAfter(3_500, () =>
        Response.json({ movie_list: [] })
      )

      await searchMoviesDetailed('private query', 'secret', 'en', fetcher)

      expect(loggedEvents(log)).toEqual([
        { event: 'kinorium_search_slow', ms: 3_500 },
      ])
      expect(JSON.stringify(log.mock.calls)).not.toContain('private query')
    })

    it('stays quiet for a fast successful search', async () => {
      vi.useFakeTimers()
      const log = spyOnLog()
      const fetcher = respondAfter(200, () => Response.json({ movie_list: [] }))

      await searchMoviesDetailed('dune', 'secret', 'en', fetcher)

      expect(log).not.toHaveBeenCalled()
    })

    it('logs the duration and status of an HTTP failure', async () => {
      vi.useFakeTimers()
      const log = spyOnLog()
      const fetcher = respondAfter(900, () => new Response('', { status: 429 }))

      await searchMoviesDetailed('dune', 'secret', 'en', fetcher)

      expect(loggedEvents(log)).toEqual([
        {
          event: 'kinorium_search_failed',
          error: 'Error',
          ms: 900,
          status: 429,
        },
      ])
    })

    it('logs the duration of a request that never answered', async () => {
      vi.useFakeTimers()
      const log = spyOnLog()
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          })
      )

      const search = searchMoviesDetailed('dune', 'secret', 'en', fetcher)
      await vi.advanceTimersByTimeAsync(7_000)
      await search

      expect(loggedEvents(log)).toEqual([
        { event: 'kinorium_search_failed', error: 'AbortError', ms: 7_000 },
      ])
    })
  })

  describe('deferred search', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    const movieList = {
      movie_list: [{ id: 7, mixtype: 'movie', name: 'Dune' }],
    }

    function deferredSearch() {
      const waitUntil = vi.fn<DeferredSearch['waitUntil']>()
      return { deadlineMs: 4_000, waitUntil }
    }

    function cacheSpy() {
      const set = vi.fn<KinoriumSearchCache['set']>()
      const searchCache: KinoriumSearchCache = {
        get: vi.fn().mockResolvedValue(undefined),
        set,
      }
      return { searchCache, set }
    }

    function slowFetcher(ms: number, body: unknown) {
      return vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(Response.json(body)), ms)
          })
      )
    }

    it('answers normally when Kinorium beats the deadline', async () => {
      vi.useFakeTimers()
      const deferred = deferredSearch()
      const search = searchMoviesDetailed(
        'dune',
        'secret',
        'en',
        slowFetcher(1_000, movieList),
        undefined,
        undefined,
        deferred
      )
      await vi.advanceTimersByTimeAsync(1_000)

      await expect(search).resolves.toMatchObject({ kind: 'ok' })
      expect(deferred.waitUntil).not.toHaveBeenCalled()
    })

    it('reports pending at the deadline and finishes in the background', async () => {
      vi.useFakeTimers()
      const deferred = deferredSearch()
      const { searchCache, set } = cacheSpy()
      const search = searchMoviesDetailed(
        'dune',
        'secret',
        'en',
        slowFetcher(9_000, movieList),
        searchCache,
        undefined,
        deferred
      )
      await vi.advanceTimersByTimeAsync(4_000)

      await expect(search).resolves.toEqual({ kind: 'pending', movies: [] })
      expect(deferred.waitUntil).toHaveBeenCalledTimes(1)
      expect(set).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(5_000)
      await deferred.waitUntil.mock.calls[0]?.[0]
      expect(set).toHaveBeenCalledWith(
        'dune',
        'en',
        expect.objectContaining({ kind: 'ok' })
      )
    })

    it('lets the background fetch outlive the foreground timeout', async () => {
      vi.useFakeTimers()
      const deferred = deferredSearch()
      const search = searchMoviesDetailed(
        'dune',
        'secret',
        'en',
        slowFetcher(12_000, movieList),
        undefined,
        undefined,
        deferred
      )
      await vi.advanceTimersByTimeAsync(4_000)
      await search

      await vi.advanceTimersByTimeAsync(8_000)
      await expect(
        deferred.waitUntil.mock.calls[0]?.[0]
      ).resolves.toMatchObject({ kind: 'ok' })
    })

    it('still gives up on a request that never answers', async () => {
      vi.useFakeTimers()
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const deferred = deferredSearch()
      const hung = vi.fn<typeof fetch>().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          })
      )
      const search = searchMoviesDetailed(
        'dune',
        'secret',
        'en',
        hung,
        undefined,
        undefined,
        deferred
      )
      await vi.advanceTimersByTimeAsync(4_000)
      await search
      await vi.advanceTimersByTimeAsync(16_000)
      await deferred.waitUntil.mock.calls.at(-1)?.[0]

      expect(
        log.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)
      ).toContainEqual({
        event: 'kinorium_search_failed',
        error: 'AbortError',
        ms: 20_000,
      })
    })

    it('waits for the full answer when no deferral is configured', async () => {
      vi.useFakeTimers()
      const search = searchMoviesDetailed(
        'dune',
        'secret',
        'en',
        slowFetcher(6_000, movieList)
      )
      await vi.advanceTimersByTimeAsync(6_000)

      await expect(search).resolves.toMatchObject({ kind: 'ok' })
    })
  })
})
