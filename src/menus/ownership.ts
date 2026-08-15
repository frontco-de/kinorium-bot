import Context from '@/models/Context'

/**
 * Decides whether the user pressing a menu button owns that menu.
 *
 * Menus are sent as replies to the command that opened them, so in group chats
 * the owner is the author of the replied-to message. Without this check any
 * member could press another member's buttons and rewrite that message.
 * Ownership is assumed when it cannot be determined, which keeps private chats
 * and menus whose original message is gone working as before.
 */
export default function isMenuOwner(ctx: Context): boolean {
  const message = ctx.callbackQuery?.message
  if (message === undefined || message.chat.type === 'private') return true

  const requesterId =
    'reply_to_message' in message
      ? message.reply_to_message?.from?.id
      : undefined
  if (requesterId === undefined) return true
  return requesterId === ctx.from?.id
}
