import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import isWithinRateLimit from '@/helpers/rateLimit'

function fakeRateLimiter(success: boolean) {
  return {
    limit: vi.fn<RateLimit['limit']>().mockResolvedValue({ success }),
  }
}

describe('inline query rate limit', () => {
  it('scopes the limit to the requesting user', async () => {
    const rateLimiter = fakeRateLimiter(true)

    await expect(isWithinRateLimit(rateLimiter, 'inline', 42)).resolves.toBe(
      true
    )
    expect(rateLimiter.limit).toHaveBeenCalledWith({ key: 'inline:42' })
  })

  it('reports an exhausted limit', async () => {
    const rateLimiter = fakeRateLimiter(false)

    await expect(isWithinRateLimit(rateLimiter, 'inline', 42)).resolves.toBe(
      false
    )
  })

  it('skips updates without a sender', async () => {
    const rateLimiter = fakeRateLimiter(false)

    await expect(
      isWithinRateLimit(rateLimiter, 'inline', undefined)
    ).resolves.toBe(true)
    expect(rateLimiter.limit).not.toHaveBeenCalled()
  })

  it('uses the configured Worker binding', async () => {
    await expect(
      isWithinRateLimit(env.INLINE_RATE_LIMITER, 'inline', 42)
    ).resolves.toBe(true)
  })
})
