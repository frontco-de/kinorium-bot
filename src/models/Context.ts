import { Context as BaseContext } from 'grammy'
import { DocumentType } from '@typegoose/typegoose'
import { User } from '@/models/User'
import type { I18nContext } from '@grammyjs/i18n'

class Context extends BaseContext {
  readonly i18n!: I18nContext
  dbuser!: DocumentType<User>

  replyWithLocalization: this['reply'] = (text, other, ...rest) => {
    text = this.i18n.t(text)
    return this.reply(text, other, ...rest)
  }
}

export default Context
