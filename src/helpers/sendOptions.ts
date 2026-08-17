import Context from '@/models/Context'

interface SendOptions {
  parse_mode: 'HTML'
  reply_parameters?: {
    allow_sending_without_reply: true
    message_id: number
  }
}

/**
 * `reply_parameters` replaced `reply_to_message_id` in Bot API 7.0.
 * `allow_sending_without_reply` keeps the answer going out when the message it
 * replies to has since been deleted.
 */
export default function sendOptions(ctx: Context): SendOptions {
  const messageId = ctx.msg?.message_id
  if (messageId === undefined) return { parse_mode: 'HTML' }
  return {
    parse_mode: 'HTML',
    reply_parameters: {
      allow_sending_without_reply: true,
      message_id: messageId,
    },
  }
}
