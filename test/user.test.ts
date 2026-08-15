import migration from '@migrations/0001_create_users.sql'
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { findOrCreateUser, findUser, updateUserLanguage } from '@/models/User'

describe('user repository', () => {
  beforeEach(async () => {
    await env.DB.exec(migration)
    await env.DB.exec('DELETE FROM users;')
  })

  it('creates a user with the Telegram locale', async () => {
    await expect(findOrCreateUser(env.DB, 42, 'uk')).resolves.toEqual({
      id: 42,
      language: 'uk',
    })
  })

  it('preserves the saved locale when the user returns', async () => {
    await findOrCreateUser(env.DB, 42, 'ru')

    await expect(findOrCreateUser(env.DB, 42, 'uk')).resolves.toEqual({
      id: 42,
      language: 'ru',
    })
  })

  it('updates a saved language', async () => {
    await findOrCreateUser(env.DB, 42)

    await expect(updateUserLanguage(env.DB, 42, 'ru')).resolves.toEqual({
      id: 42,
      language: 'ru',
    })
    await expect(findUser(env.DB, 42)).resolves.toEqual({
      id: 42,
      language: 'ru',
    })
  })
})
