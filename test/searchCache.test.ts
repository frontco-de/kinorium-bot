import { describe, expect, it, vi } from 'vitest'
import createSearchCache from '@/helpers/searchCache'

describe('Kinorium search cache', () => {
  it('stores successful searches for five minutes under a hashed key', async () => {
    const cache = {
      match: vi.fn<Cache['match']>(),
      put: vi.fn<Cache['put']>().mockResolvedValue(undefined),
    }
    const backgroundTasks: Promise<unknown>[] = []
    const executionContext = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        backgroundTasks.push(promise)
      }),
    }
    const searchCache = createSearchCache(
      cache,
      executionContext,
      'https://example.com'
    )

    searchCache.set('Dune 2021', 'en', {
      kind: 'ok',
      movies: [
        {
          id: 123,
          mixtype: 'movie',
          name: 'Dune',
          name_orig: 'Dune',
          url: 'https://en.kinorium.com/123/',
        },
      ],
    })
    await Promise.all(backgroundTasks)

    expect(executionContext.waitUntil).toHaveBeenCalledOnce()
    expect(cache.put).toHaveBeenCalledOnce()
    const call = cache.put.mock.calls[0]
    if (!call) throw new Error('Expected cache write')
    const [key, response] = call
    const keyUrl = key instanceof Request ? key.url : String(key)
    expect(keyUrl).not.toContain('Dune')
    expect(keyUrl).toMatch(
      /^https:\/\/example\.com\/__cache\/kinorium-search\/[\da-f]{64}$/
    )
    expect(response.headers.get('Cache-Control')).toBe('max-age=300')
    await expect(response.json()).resolves.toMatchObject({ kind: 'ok' })
  })

  it('reads a cached successful search with language-specific keys', async () => {
    const cachedResult = {
      kind: 'ok',
      movies: [
        {
          id: 123,
          mixtype: 'movie',
          name: 'Dune',
          name_orig: 'Dune',
          url: 'https://en.kinorium.com/123/',
        },
      ],
    }
    const cache = {
      match: vi
        .fn<Cache['match']>()
        .mockImplementation(() => Promise.resolve(Response.json(cachedResult))),
      put: vi.fn<Cache['put']>(),
    }
    const searchCache = createSearchCache(
      cache,
      { waitUntil: vi.fn() },
      'https://example.com'
    )

    await expect(searchCache.get('Dune', 'en')).resolves.toEqual(cachedResult)
    await expect(searchCache.get('Dune', 'uk')).resolves.toEqual(cachedResult)
    const firstKey = cache.match.mock.calls[0]?.[0]
    const secondKey = cache.match.mock.calls[1]?.[0]
    if (!(firstKey instanceof Request) || !(secondKey instanceof Request)) {
      throw new Error('Expected cache request keys')
    }
    expect(firstKey.url).not.toBe(secondKey.url)
  })
})
