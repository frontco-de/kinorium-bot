import { describe, expect, it } from 'vitest'
import { Localizer } from '@/helpers/i18n'

describe('localizer', () => {
  it('loads bundled translations and interpolates values', () => {
    const localizer = new Localizer()
    localizer.locale('uk')

    expect(
      localizer.t('inline.no_results_description', { query: 'Дюна' })
    ).toBe('Нічого не знайдено за “Дюна”')
    expect(localizer.t('start', { username: 'kinorium_bot' })).toContain(
      '<code>@kinorium_bot Dune 2026</code>'
    )
  })

  it('falls back to English and then to the key', () => {
    const localizer = new Localizer()

    expect(localizer.t('help', { username: 'kinorium_bot' })).toContain(
      '<b>How to use the bot</b>'
    )
    expect(localizer.t('missing.key')).toBe('missing.key')
  })
})
