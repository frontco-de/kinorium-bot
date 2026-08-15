import { type MiddlewareFn } from 'grammy/web'
import { isSupportedLocale, type SupportedLocale } from '@/helpers/locales'
import Context from '@/models/Context'
import { findOrCreateUser } from '@/models/User'

function inferLocaleFromTelegram(ctx: Context): SupportedLocale {
  const code = ctx.from?.language_code?.trim().toLowerCase()
  const shortCode = code?.split('-')[0]
  if (shortCode && isSupportedLocale(shortCode)) {
    return shortCode
  }
  return 'en'
}

export default function createAttachUser(
  db: D1Database
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    ctx.db = db
    if (!ctx.from) return next()

    ctx.dbuser = await findOrCreateUser(
      db,
      ctx.from.id,
      inferLocaleFromTelegram(ctx)
    )
    return next()
  }
}
