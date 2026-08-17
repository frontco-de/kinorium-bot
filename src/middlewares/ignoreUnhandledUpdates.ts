import { type MiddlewareFn } from 'grammy/web'
import Context from '@/models/Context'

/**
 * Drops updates no handler answers.
 *
 * Telegram delivers every group message while BotFather privacy mode is off,
 * and each delivery would otherwise create or read a D1 user row for a sender
 * who never interacted with the bot.
 */
export default function ignoreUnhandledUpdates(
  commands: string[]
): MiddlewareFn<Context> {
  return (ctx, next) => {
    const isHandled =
      ctx.inlineQuery !== undefined ||
      ctx.chosenInlineResult !== undefined ||
      ctx.callbackQuery !== undefined ||
      ctx.hasCommand(commands)
    if (!isHandled) return
    return next()
  }
}
