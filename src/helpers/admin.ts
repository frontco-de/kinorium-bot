/**
 * Parses the `ADMIN_ID` secret.
 *
 * Only plain digits are accepted: `Number()` would also read `0x2a` and `1e3`,
 * so a typo could silently authorize an id nobody intended.
 */
export default function parseAdminId(
  value: string | undefined
): number | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return undefined
  const id = Number(trimmed)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}
