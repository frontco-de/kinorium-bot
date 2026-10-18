import { InlineQueryResultBuilder as R } from 'grammy/web'
import { type Localizer } from '@/helpers/i18n'

// `searching` is not a failure: the search is still running and the user is
// asked to retry once it has filled the cache.
export type InlineErrorKind = 'api' | 'rate_limit' | 'searching' | 'unexpected'

const ERROR_RESULT_CONFIG: Record<
  InlineErrorKind,
  { id: string; translationKey: string }
> = {
  api: {
    id: 'api-error',
    translationKey: 'inline.api_error',
  },
  rate_limit: {
    id: 'rate-limit-error',
    translationKey: 'inline.rate_limit_error',
  },
  searching: {
    id: 'searching',
    translationKey: 'inline.searching',
  },
  unexpected: {
    id: 'unexpected-error',
    translationKey: 'inline.unexpected_error',
  },
}

export default function buildInlineErrorResult(
  localizer: Localizer,
  kind: InlineErrorKind
) {
  const { id, translationKey } = ERROR_RESULT_CONFIG[kind]
  const title = localizer.t(`${translationKey}_title`)
  const description = localizer.t(`${translationKey}_description`)
  const message = localizer.t(`${translationKey}_message`)

  return R.article(id, title, { description }).text(message)
}
