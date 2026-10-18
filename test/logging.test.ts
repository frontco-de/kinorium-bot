import { GrammyError } from 'grammy/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import logError from '@/helpers/logging'

function spyOnLog() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logError', () => {
  it('records the Telegram method and status code of a GrammyError', () => {
    const log = spyOnLog()
    logError(
      'telegram_update_failed',
      new GrammyError(
        'Call to answerInlineQuery failed!',
        {
          ok: false,
          error_code: 400,
          description: 'Bad Request: query is too old for secret search',
        },
        'answerInlineQuery',
        {}
      )
    )

    const line = String(log.mock.calls[0]?.[0])
    expect(JSON.parse(line)).toEqual({
      event: 'telegram_update_failed',
      error: 'GrammyError',
      method: 'answerInlineQuery',
      code: 400,
    })
    expect(line).not.toContain('secret search')
    expect(line).not.toContain('Call to')
  })

  it('ignores method-like fields on other errors', () => {
    const log = spyOnLog()
    logError(
      'x',
      Object.assign(new TypeError('boom'), { method: 'm', error_code: 1 })
    )

    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      event: 'x',
      error: 'TypeError',
    })
  })
})
