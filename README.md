# Telegram bot starter based on [grammY](https://grammy.dev)

This project is based on https://github.com/frontco-de/kinorium-bot.

Please, enjoy this starter template for Telegram bots based on [grammY](https://grammy.dev). It includes most common middlewares, MongoDB integration, language picker and internationalization and shows basic encapsulation techniques used by me.

This fork also demonstrates an inline-mode bot flow: it takes inline query text, searches movies via the Kinorium API, and returns results back to Telegram.

# Installation and local launch

1. Clone the upstream template (or your fork): `git clone https://github.com/frontco-de/kinorium-bot`
2. Launch the [mongo database](https://www.mongodb.com/) locally
3. Create `.env` with the environment variables listed below
4. Run `npm install` in the root folder
5. Run `npm run develop`

And you should be good to go! Feel free to fork and submit pull requests. Thanks!

# Environment variables

- `TOKEN` — Telegram bot token
- `MONGO` — URL of the mongo database
- `KINORIUMAPIKEY` — Kinorium API key used for movie search

Also, please, consider looking at `.env.sample`.

# License

MIT — use for any purpose. If you redistribute, please keep attribution to https://github.com/frontco-de/kinorium-bot (and the original starter it is based on). Thanks!
