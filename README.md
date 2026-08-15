# Kinorium Bot

A multilingual Telegram bot for finding movies and TV shows through the Kinorium API. The bot works in Telegram inline mode and returns up to ten matching titles with release information, poster thumbnails when available, and links to Kinorium.

The project is written in strict TypeScript and uses [grammY](https://grammy.dev), a Cloudflare Worker webhook, D1 persistence, and YAML localization for English, Russian, and Ukrainian.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- Yarn Classic
- A free Cloudflare account
- A Telegram bot token
- A Kinorium API key

## Getting Started

```sh
git clone https://github.com/frontco-de/kinorium-bot.git
cd kinorium-bot
nvm use
yarn
cp .env.example .env
```

Set the required values in `.env` and generate a separate random webhook secret:

```dotenv
TOKEN=YOUR_TELEGRAM_BOT_TOKEN
APIKEY=YOUR_KINORIUM_API_KEY
WEBHOOK_SECRET=GENERATE_A_RANDOM_SECRET
```

Initialize the local D1 database and run the Worker:

```sh
yarn d1:migrate:local
yarn dev
```

The local health endpoint is `http://localhost:8787/health`. Telegram cannot send updates to localhost without a public tunnel, so automated tests are the default local verification path.

## Using the Bot

In any Telegram chat, type the bot username followed by a movie or series title:

```text
@your_bot_username Dune 2021
```

Select a result to send its title, type, release year, and Kinorium link. The bot also supports:

- `/start` and `/help` — show help.
- `/language` — choose the interface language.

## Development Commands

- `yarn dev` — run the Worker and local D1 database with Wrangler.
- `yarn test` — run unit and Worker integration tests in the Workers runtime.
- `yarn lint` — check formatting, ESLint rules, and TypeScript types.
- `yarn build` — create a local Wrangler deployment bundle without publishing it.
- `yarn types` — regenerate Worker binding and runtime types after config changes.

See the [contributor reference](docs/contributor-guide.md) for architecture and verification guidance.

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for Cloudflare authentication, D1 migration, secrets, webhook registration, verification, and rollback.

## License

Released under the [MIT License](LICENSE).
