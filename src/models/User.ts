import { type SupportedLocale, isSupportedLocale } from '@/helpers/locales'

export interface User {
  id: number
  language: SupportedLocale
}

interface UserRow {
  id: number
  language: string
}

function toUser(row: UserRow | null): User | null {
  if (row === null) return null
  if (!isSupportedLocale(row.language)) {
    throw new Error(`Unsupported locale stored for user ${row.id}`)
  }
  return { id: row.id, language: row.language }
}

export async function findUser(
  db: D1Database,
  id: number
): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, language FROM users WHERE id = ? LIMIT 1')
    .bind(id)
    .first<UserRow>()
  return toUser(row)
}

export async function findOrCreateUser(
  db: D1Database,
  id: number,
  defaultLanguage: SupportedLocale = 'en'
): Promise<User> {
  const existing = await findUser(db, id)
  if (existing) return existing

  await db
    .prepare('INSERT OR IGNORE INTO users (id, language) VALUES (?, ?)')
    .bind(id, defaultLanguage)
    .run()

  const user = await findUser(db, id)
  if (!user) throw new Error(`Unable to create user ${id}`)
  return user
}

export async function updateUserLanguage(
  db: D1Database,
  id: number,
  language: SupportedLocale
): Promise<User> {
  const result = await db
    .prepare(
      'UPDATE users SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
    .bind(language, id)
    .run()

  if (result.meta.changes !== 1) throw new Error(`User ${id} not found`)
  return { id, language }
}

/**
 * Removes every row that identifies a user: the account row and its activity
 * days. Usage counters hold no user data and stay untouched, so the totals
 * remain correct after an erasure.
 */
export async function deleteUser(
  db: D1Database,
  id: number
): Promise<{ activityDays: number }> {
  const [activity] = await db.batch([
    db.prepare('DELETE FROM user_activity WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ])
  return { activityDays: activity?.meta.changes ?? 0 }
}
