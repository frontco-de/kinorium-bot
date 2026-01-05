import { NextFunction } from 'grammy'
import { findOrCreateUser } from '@/models/User'
import Context from '@/models/Context'

const SUPPORTED_LOCALES = new Set(['en', 'ru', 'uk'])

function inferLocaleFromTelegram(ctx: Context): string {
  const code = ctx.from?.language_code?.trim().toLowerCase()
  const shortCode = code?.split('-')[0]
  if (shortCode && SUPPORTED_LOCALES.has(shortCode)) {
    return shortCode
  }
  return 'en'
}

export default async function attachUser(ctx: Context, next: NextFunction) {
  if (!ctx.from) {
    return next()
  }

  const user = await findOrCreateUser(ctx.from.id, inferLocaleFromTelegram(ctx))
  if (!user) {
    throw new Error('User not found')
  }
  ctx.dbuser = user
  return next()
}
