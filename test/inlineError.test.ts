import { describe, expect, it } from 'vitest'
import { Localizer } from '@/helpers/i18n'
import buildInlineErrorResult, {
  type InlineErrorKind,
} from '@/helpers/inlineError'
import { type SupportedLocale } from '@/helpers/locales'

interface ExpectedErrorResult {
  locale: SupportedLocale
  kind: InlineErrorKind
  id: string
  title: string
  description: string
  message: string
}

const expectedResults: ExpectedErrorResult[] = [
  {
    locale: 'en',
    kind: 'api',
    id: 'api-error',
    title: 'Service unavailable',
    description: "Can't reach Kinorium",
    message:
      'Kinorium is temporarily unavailable. Please try again in a minute.',
  },
  {
    locale: 'ru',
    kind: 'api',
    id: 'api-error',
    title: 'Сервис недоступен',
    description: 'Нет ответа от Kinorium',
    message: 'Kinorium временно недоступен. Попробуйте ещё раз через минуту.',
  },
  {
    locale: 'uk',
    kind: 'api',
    id: 'api-error',
    title: 'Сервіс недоступний',
    description: 'Немає відповіді від Kinorium',
    message: 'Kinorium тимчасово недоступний. Спробуйте ще раз за хвилину.',
  },
  {
    locale: 'en',
    kind: 'unexpected',
    id: 'unexpected-error',
    title: 'Something went wrong',
    description: 'The search could not be completed',
    message:
      'Something went wrong while searching. Please try again in a moment.',
  },
  {
    locale: 'ru',
    kind: 'unexpected',
    id: 'unexpected-error',
    title: 'Что-то пошло не так',
    description: 'Не удалось выполнить поиск',
    message:
      'Во время поиска что-то пошло не так. Попробуйте ещё раз через минуту.',
  },
  {
    locale: 'uk',
    kind: 'unexpected',
    id: 'unexpected-error',
    title: 'Щось пішло не так',
    description: 'Не вдалося виконати пошук',
    message: 'Під час пошуку щось пішло не так. Спробуйте ще раз за хвилину.',
  },
  {
    locale: 'en',
    kind: 'rate_limit',
    id: 'rate-limit-error',
    title: 'Too many searches',
    description: 'Please slow down for a moment',
    message:
      'Too many searches in a short time. Please wait a moment and try again.',
  },
  {
    locale: 'ru',
    kind: 'rate_limit',
    id: 'rate-limit-error',
    title: 'Слишком много запросов',
    description: 'Пожалуйста, немного подождите',
    message:
      'Слишком много запросов за короткое время. Подождите немного и попробуйте снова.',
  },
  {
    locale: 'uk',
    kind: 'rate_limit',
    id: 'rate-limit-error',
    title: 'Занадто багато запитів',
    description: 'Будь ласка, трохи зачекайте',
    message:
      'Занадто багато запитів за короткий час. Зачекайте трохи й спробуйте знову.',
  },
]

describe('inline error result', () => {
  it.each(expectedResults)(
    'builds the $kind result in $locale',
    ({ locale, kind, id, title, description, message }) => {
      const localizer = new Localizer()
      localizer.locale(locale)

      expect(buildInlineErrorResult(localizer, kind)).toMatchObject({
        type: 'article',
        id,
        title,
        description,
        input_message_content: {
          message_text: message,
        },
      })
    }
  )
})
