import english from '@locales/en.yaml'
import russian from '@locales/ru.yaml'
import ukrainian from '@locales/uk.yaml'
import { load } from 'js-yaml'

export const SUPPORTED_LOCALES = ['en', 'ru', 'uk'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

interface LocaleDefinition {
  code: SupportedLocale
  messages: Record<string, unknown>
  name: string
}

const localeSources: Record<SupportedLocale, string> = {
  en: english,
  ru: russian,
  uk: ukrainian,
}

function parseLocale(code: SupportedLocale, source: string): LocaleDefinition {
  const messages = load(source)
  if (
    typeof messages !== 'object' ||
    messages === null ||
    !('name' in messages) ||
    typeof messages.name !== 'string'
  ) {
    throw new Error(`Locale ${code} must define a name`)
  }

  return {
    code,
    messages: messages as Record<string, unknown>,
    name: messages.name,
  }
}

export const locales = SUPPORTED_LOCALES.map((code) =>
  parseLocale(code, localeSources[code])
)

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value)
}
