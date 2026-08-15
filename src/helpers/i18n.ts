import { type NextFunction } from 'grammy/web'
import { locales, type SupportedLocale } from '@/helpers/locales'
import type Context from '@/models/Context'

type InterpolationValues = Record<string, string | number>

const messagesByLocale = new Map(
  locales.map(({ code, messages }) => [code, messages])
)

function resolveMessage(
  language: SupportedLocale,
  key: string
): string | undefined {
  let value: unknown = messagesByLocale.get(language)
  for (const segment of key.split('.')) {
    if (typeof value !== 'object' || value === null || !(segment in value)) {
      return undefined
    }
    value = (value as Record<string, unknown>)[segment]
  }
  return typeof value === 'string' ? value : undefined
}

export class Localizer {
  private language: SupportedLocale = 'en'

  locale(language?: SupportedLocale): SupportedLocale {
    if (language) this.language = language
    return this.language
  }

  t(key: string, values: InterpolationValues = {}): string {
    const template =
      resolveMessage(this.language, key) ?? resolveMessage('en', key) ?? key
    return Object.entries(values).reduce(
      (message, [name, value]) =>
        message.split(`\${${name}}`).join(String(value)),
      template
    )
  }
}

export default function localize(ctx: Context, next: NextFunction) {
  ctx.i18n = new Localizer()
  return next()
}
