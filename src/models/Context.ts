import { Context as BaseContext } from 'grammy'
import { type Localizer } from '@/helpers/i18n'
import { type User } from '@/models/User'

class Context extends BaseContext {
  i18n!: Localizer
  db!: D1Database
  dbuser!: User

  replyWithLocalization: this['reply'] = (text, other, ...rest) => {
    text = this.i18n.t(text)
    return this.reply(text, other, ...rest)
  }
}

export default Context
