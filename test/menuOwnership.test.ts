import { type Update, type UserFromGetMe } from 'grammy/types'
import { Api } from 'grammy/web'
import { describe, expect, it } from 'vitest'
import isMenuOwner from '@/menus/ownership'
import Context from '@/models/Context'

const botInfo = {
  id: 1,
  is_bot: true,
  first_name: 'KinoriumBot',
  username: 'kinorium_bot',
} as UserFromGetMe
const owner = { id: 42, is_bot: false, first_name: 'Owner' }
const bystander = { id: 43, is_bot: false, first_name: 'Bystander' }

function callbackContext(
  presser: typeof owner,
  chat: { id: number; type: 'group' | 'private'; title?: string },
  requester?: typeof owner
): Context {
  const update = {
    update_id: 1,
    callback_query: {
      id: 'c1',
      from: presser,
      chat_instance: '1',
      data: 'language:en',
      message: {
        message_id: 2,
        date: 0,
        chat,
        from: { id: 1, is_bot: true, first_name: 'KinoriumBot' },
        text: 'Please, select the language.',
        reply_to_message: requester
          ? { message_id: 1, date: 0, chat, from: requester, text: '/language' }
          : undefined,
      },
    },
  } as unknown as Update

  return new Context(update, new Api('123456789:test-token'), botInfo)
}

describe('menu ownership', () => {
  it('accepts the user whose command opened the menu', () => {
    const ctx = callbackContext(owner, { id: -100, type: 'group' }, owner)

    expect(isMenuOwner(ctx)).toBe(true)
  })

  it('rejects another group member pressing the same menu', () => {
    const ctx = callbackContext(bystander, { id: -100, type: 'group' }, owner)

    expect(isMenuOwner(ctx)).toBe(false)
  })

  it('accepts any press in a private chat', () => {
    const ctx = callbackContext(owner, { id: 42, type: 'private' })

    expect(isMenuOwner(ctx)).toBe(true)
  })

  it('accepts the press when ownership cannot be determined', () => {
    const ctx = callbackContext(bystander, { id: -100, type: 'group' })

    expect(isMenuOwner(ctx)).toBe(true)
  })
})
