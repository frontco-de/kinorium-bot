import { describe, expect, it, vi } from 'vitest'
import { Localizer } from '@/helpers/i18n'
import sendOptions from '@/helpers/sendOptions'
import throttleUpdates from '@/middlewares/throttleUpdates'
import Context from '@/models/Context'

function limiter(success: boolean) {
  const limit = vi.fn(() => Promise.resolve({ success }))
  return { rateLimiter: { limit } as unknown as RateLimit, limit }
}

describe('update throttling', () => {
  it('passes an update through while the sender is within the limit', async () => {
    const { rateLimiter, limit } = limiter(true)
    const next = vi.fn(() => Promise.resolve())

    await throttleUpdates(rateLimiter)(
      { from: { id: 42 } } as unknown as Context,
      next
    )

    expect(limit).toHaveBeenCalledWith({ key: 'update:42' })
    expect(next).toHaveBeenCalled()
  })

  it('drops the update before any database access when flooding', async () => {
    const { rateLimiter } = limiter(false)
    const next = vi.fn(() => Promise.resolve())

    await throttleUpdates(rateLimiter)(
      { from: { id: 42 } } as unknown as Context,
      next
    )

    expect(next).not.toHaveBeenCalled()
  })

  it('lets updates without a sender through, since they cannot be attributed', async () => {
    const { rateLimiter, limit } = limiter(false)
    const next = vi.fn(() => Promise.resolve())

    await throttleUpdates(rateLimiter)({} as unknown as Context, next)

    expect(limit).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})

describe('HTML localization', () => {
  it('escapes interpolated values but keeps template markup', () => {
    const i18n = new Localizer()

    const rendered = i18n.tHtml('help', { username: '<b>evil</b>&' })

    expect(rendered).toContain('<code>@&lt;b&gt;evil&lt;/b&gt;&amp;')
    expect(rendered).toContain('<b>How to use the bot</b>')
  })

  it('leaves plain-text messages unescaped for inline descriptions', () => {
    const i18n = new Localizer()

    const rendered = i18n.t('inline.no_results_description', {
      query: 'Tom & Jerry',
    })

    expect(rendered).toContain('Tom & Jerry')
  })
})

describe('send options', () => {
  it('replies through reply_parameters and survives a deleted message', () => {
    const options = sendOptions({
      msg: { message_id: 7 },
    } as unknown as Context)

    expect(options).toEqual({
      parse_mode: 'HTML',
      reply_parameters: {
        allow_sending_without_reply: true,
        message_id: 7,
      },
    })
  })

  it('omits reply parameters when there is no message to reply to', () => {
    expect(sendOptions({} as unknown as Context)).toEqual({
      parse_mode: 'HTML',
    })
  })
})
