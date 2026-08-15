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
