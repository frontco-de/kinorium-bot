/** Keeps one user from draining the Kinorium quota with inline keystrokes. */
export default async function isWithinRateLimit(
  rateLimiter: RateLimit,
  scope: string,
  userId: number | undefined
): Promise<boolean> {
  // Updates without a sender cannot be attributed, so they are not limited.
  if (userId === undefined) return true
  const { success } = await rateLimiter.limit({ key: `${scope}:${userId}` })
  return success
}
