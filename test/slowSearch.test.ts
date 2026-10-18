import usersMigration from '@migrations/0001_create_users.sql'
import countersMigration from '@migrations/0002_create_usage_counters.sql'
import dailyMigration from '@migrations/0003_daily_usage_counters.sql'
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import worker from '@/app'
import buildInlineMovieResultId from '@/helpers/inlineResult'

type IncomingRequest = Parameters<typeof worker.fetch>[0]

interface InlineAnswer {
  results: { id: string }[]
  cache_time: number
}

const MOVIE_RESPONSE = {
  movie_list: [{ id: 321, mixtype: 'movie', name: 'Dune', year: 2021 }],
}

function inlineQueryRequest(query: string, updateId: number): IncomingRequest {
  return new Request('https://example.com/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      update_id: updateId,
      inline_query: {
        id: `query-${updateId}`,
        from: {
          id: 77,
          is_bot: false,
          first_name: 'Test',
          language_code: 'en',
        },
        query,
        offset: '',
      },
    }),
  })
}

/**
 * Stands in for Kinorium and Telegram. Kinorium answers only when the test
 * calls `releaseKinorium`, so the test decides how slow the search is.
 */
function stubNetwork() {
  const answers: InlineAnswer[] = []
  let kinoriumCalls = 0
  let release: (body: unknown) => void = () => undefined
  const pendingKinorium = new Promise<unknown>((resolve) => {
    release = resolve
  })

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.startsWith('https://db.kinorium.com/')) {
        kinoriumCalls += 1
        return pendingKinorium.then((body) => Response.json(body))
      }
      const body = typeof init?.body === 'string' ? init.body : '{}'
      answers.push(JSON.parse(body) as InlineAnswer)
      return Promise.resolve(Response.json({ ok: true, result: true }))
    })
  )

  return {
    answers,
    kinoriumCalls: () => kinoriumCalls,
    releaseKinorium: release,
  }
}

async function deliver(request: IncomingRequest, bindings = env) {
  const executionContext = createExecutionContext()
  const response = await worker.fetch(request, bindings, executionContext)
  await waitOnExecutionContext(executionContext)
  return response
}

describe('slow Kinorium search', () => {
  beforeAll(async () => {
    await env.DB.exec(usersMigration)
    await env.DB.exec(countersMigration)
    await env.DB.exec(dailyMigration)
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('answers "still searching", then serves the finished search from cache', async () => {
    const network = stubNetwork()
    const executionContext = createExecutionContext()
    const firstDelivery = worker.fetch(
      inlineQueryRequest('dune slow', 1),
      { ...env, SLOW_SEARCH_FALLBACK: 'true' },
      executionContext
    )
    await vi.waitFor(() => {
      expect(network.kinoriumCalls()).toBe(1)
    })
    await vi.advanceTimersByTimeAsync(4_000)

    expect((await firstDelivery).status).toBe(200)
    expect(network.answers[0]).toMatchObject({
      results: [{ id: 'searching' }],
      cache_time: 0,
    })

    network.releaseKinorium(MOVIE_RESPONSE)
    await waitOnExecutionContext(executionContext)

    await deliver(inlineQueryRequest('dune slow', 2), {
      ...env,
      SLOW_SEARCH_FALLBACK: 'true',
    })
    expect(network.kinoriumCalls()).toBe(1)
    expect(network.answers).toHaveLength(2)
    expect(network.answers[1]?.results[0]?.id).toBe(
      buildInlineMovieResultId('query-2', 321)
    )
  })

  it('shows "No results" on the retry instead of searching forever', async () => {
    const network = stubNetwork()
    const executionContext = createExecutionContext()
    const firstDelivery = worker.fetch(
      inlineQueryRequest('zzzz nothing', 4),
      { ...env, SLOW_SEARCH_FALLBACK: 'true' },
      executionContext
    )
    await vi.waitFor(() => {
      expect(network.kinoriumCalls()).toBe(1)
    })
    await vi.advanceTimersByTimeAsync(4_000)
    await firstDelivery

    network.releaseKinorium({ error: { code: 404, message: 'Not found' } })
    await waitOnExecutionContext(executionContext)

    await deliver(inlineQueryRequest('zzzz nothing', 5), {
      ...env,
      SLOW_SEARCH_FALLBACK: 'true',
    })
    expect(network.kinoriumCalls()).toBe(1)
    expect(network.answers).toHaveLength(2)
    expect(network.answers[1]?.results[0]?.id).toBe('no-results')
  })

  it('keeps waiting for Kinorium when the flag is off', async () => {
    const network = stubNetwork()
    const executionContext = createExecutionContext()
    const delivery = worker.fetch(
      inlineQueryRequest('dune flagoff', 3),
      { ...env, SLOW_SEARCH_FALLBACK: 'false' as 'true' },
      executionContext
    )
    await vi.waitFor(() => {
      expect(network.kinoriumCalls()).toBe(1)
    })
    await vi.advanceTimersByTimeAsync(4_500)
    expect(network.answers).toEqual([])

    network.releaseKinorium(MOVIE_RESPONSE)
    expect((await delivery).status).toBe(200)
    await waitOnExecutionContext(executionContext)
    expect(network.answers).toHaveLength(1)
    expect(network.answers[0]?.results[0]?.id).toBe(
      buildInlineMovieResultId('query-3', 321)
    )
  })
})
