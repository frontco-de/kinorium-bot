import { type NextFunction } from 'grammy/web'
import { locales, type SupportedLocale } from '@/helpers/locales'
import type Context from '@/models/Context'

type InterpolationValues = Record<string, string | number>
type Transform = (value: string | number) => string

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

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

function escapeHtml(value: string | number): string {
  return String(value).replace(
    /[&<>"]/g,
    (character) => HTML_ESCAPES[character] ?? character
  )
}

export class Localizer {
  private language: SupportedLocale = 'en'

  locale(language?: SupportedLocale): SupportedLocale {
    if (language) this.language = language
    return this.language
  }

  /** Renders a message for plain text: inline descriptions and alert texts. */
  t(key: string, values: InterpolationValues = {}): string {
    return this.render(key, values, String)
  }

  /**
   * Renders a message for `parse_mode: 'HTML'`, escaping interpolated values.
   * Locale templates carry the markup and stay unescaped; values never do.
   */
  tHtml(key: string, values: InterpolationValues = {}): string {
    return this.render(key, values, escapeHtml)
  }

  private render(
    key: string,
    values: InterpolationValues,
    transform: Transform
  ): string {
    const template =
      resolveMessage(this.language, key) ?? resolveMessage('en', key) ?? key
    return Object.entries(values).reduce(
      (message, [name, value]) =>
        message.split(`\${${name}}`).join(transform(value)),
      template
    )
  }
}

export default function localize(ctx: Context, next: NextFunction) {
  ctx.i18n = new Localizer()
  return next()
}
