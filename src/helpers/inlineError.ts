import { InlineQueryResultBuilder as R } from 'grammy/web'
import { type Localizer } from '@/helpers/i18n'

export type InlineErrorKind = 'api' | 'rate_limit' | 'unexpected'

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
