import { GrammyError } from 'grammy/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import answerInlineQuery from '@/helpers/inlineAnswer'

function telegramError(code: number, description: string) {
  return new GrammyError(
    'Call to answerInlineQuery failed!',
    { ok: false, error_code: code, description },
    'answerInlineQuery',
    {}
  )
}

function contextRejecting(error: unknown) {
  return { answerInlineQuery: vi.fn().mockRejectedValue(error) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('answerInlineQuery', () => {
  it('passes the results to Telegram with a short personal cache', async () => {
    const ctx = { answerInlineQuery: vi.fn().mockResolvedValue(true) }

    await expect(answerInlineQuery(ctx, [])).resolves.toBe(true)

    expect(ctx.answerInlineQuery).toHaveBeenCalledWith([], {
      cache_time: 5,
      is_personal: true,
    })
  })

  it('lets a placeholder answer skip the cache so a retry reaches the bot', async () => {
    const ctx = { answerInlineQuery: vi.fn().mockResolvedValue(true) }

    await answerInlineQuery(ctx, [], { cacheTimeSeconds: 0 })

    expect(ctx.answerInlineQuery).toHaveBeenCalledWith([], {
      cache_time: 0,
      is_personal: true,
    })
  })

  it('swallows and logs an answer that arrived after the query expired', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ctx = contextRejecting(
      telegramError(
        400,
        'Bad Request: query is too old and response timeout expired or query ID is invalid'
      )
    )

    await expect(answerInlineQuery(ctx, [], { waitedMs: 6_400 })).resolves.toBe(
      false
    )

    const line = String(log.mock.calls[0]?.[0])
    expect(JSON.parse(line)).toEqual({
      event: 'inline_query_expired',
      error: 'GrammyError',
      method: 'answerInlineQuery',
      code: 400,
      ms: 6_400,
    })
    expect(line).not.toContain('too old')
  })

  it('rethrows other Telegram rejections so real bugs still alert', async () => {
    const error = telegramError(400, 'Bad Request: RESULT_ID_DUPLICATE')

    await expect(answerInlineQuery(contextRejecting(error), [])).rejects.toBe(
      error
    )
  })

  it('rethrows errors that are not Telegram API errors', async () => {
    const error = new TypeError('boom')

    await expect(answerInlineQuery(contextRejecting(error), [])).rejects.toBe(
      error
    )
  })
})
