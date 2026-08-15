import { type Update, type UserFromGetMe } from 'grammy/types'
import { Api } from 'grammy/web'
import { describe, expect, it, vi } from 'vitest'
import ignoreUnhandledUpdates from '@/middlewares/ignoreUnhandledUpdates'
import Context from '@/models/Context'

const COMMANDS = ['help', 'language', 'start']
const botInfo = {
  id: 1,
  is_bot: true,
  first_name: 'KinoriumBot',
  username: 'kinorium_bot',
} as UserFromGetMe
const sender = { id: 42, is_bot: false, first_name: 'Test' }
const groupChat = { id: -100, type: 'group' as const, title: 'Group' }

function buildContext(update: Partial<Update>): Context {
  return new Context(
    { update_id: 1, ...update },
    new Api('123456789:test-token'),
    botInfo
  )
}

function messageUpdate(text: string, isCommand: boolean): Partial<Update> {
  return {
    message: {
      message_id: 1,
      date: 0,
      chat: groupChat,
      from: sender,
      text,
      entities: isCommand
        ? [{ type: 'bot_command' as const, offset: 0, length: text.length }]
        : undefined,
    },
  }
}

async function run(update: Partial<Update>) {
  const next = vi.fn(() => Promise.resolve())
  await ignoreUnhandledUpdates(COMMANDS)(buildContext(update), next)
  return next
}

describe('unhandled update filter', () => {
  it('passes commands to the handlers', async () => {
    await expect(run(messageUpdate('/start', true))).resolves.toHaveBeenCalled()
  })

  it('passes inline queries to the handlers', async () => {
    const update = {
      inline_query: { id: 'q1', from: sender, query: 'Dune', offset: '' },
    }

    await expect(run(update)).resolves.toHaveBeenCalled()
  })

  it('passes callback queries to the handlers', async () => {
    const update = {
      callback_query: {
        id: 'c1',
        from: sender,
        chat_instance: '1',
        data: 'language:en',
      },
    }

    await expect(run(update)).resolves.toHaveBeenCalled()
  })

  it('drops group chatter before it reaches the database', async () => {
    await expect(
      run(messageUpdate('just talking in a group', false))
    ).resolves.not.toHaveBeenCalled()
  })

  it('drops commands the bot does not register', async () => {
    await expect(
      run(messageUpdate('/unknown', true))
    ).resolves.not.toHaveBeenCalled()
  })
})
