import { describe, expect, it } from 'vitest'
import { Localizer } from '@/helpers/i18n'

describe('localizer', () => {
  it('loads bundled translations and interpolates values', () => {
    const localizer = new Localizer()
    localizer.locale('uk')

    expect(
      localizer.t('inline.no_results_description', { query: 'Дюна' })
    ).toBe('Нічого не знайдено за “Дюна”')
  })

  it('falls back to English and then to the key', () => {
    const localizer = new Localizer()

    expect(localizer.t('help')).toContain('This bot')
    expect(localizer.t('missing.key')).toBe('missing.key')
  })
})
