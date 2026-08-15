# Kinorium Bot

A multilingual Telegram bot for finding movies and TV shows through the Kinorium API. The bot works in Telegram inline mode and returns up to ten matching titles with release information, poster thumbnails when available, and links to Kinorium.

The project is written in strict TypeScript and uses [grammY](https://grammy.dev), MongoDB with Typegoose, and YAML-based localization for English, Russian, and Ukrainian.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- Yarn Classic
- A running MongoDB instance
- A Telegram bot token
- A Kinorium API key

## Getting Started

```sh
git clone https://github.com/frontco-de/kinorium-bot.git
cd kinorium-bot
nvm use
yarn
cp .env.sample .env
```

Set the required values in `.env`:

```dotenv
TOKEN=YOUR_TELEGRAM_BOT_TOKEN
MONGO=mongodb://localhost:27017/test
APIKEY=YOUR_KINORIUM_API_KEY
```

Start MongoDB, then run the bot in watch mode:

```sh
yarn dev
```

## Using the Bot

In any Telegram chat, type the bot username followed by a movie or series title:

```text
@your_bot_username Dune 2021
```

Select a result to send its title, type, release year, and Kinorium link. The bot also supports:

- `/start` and `/help` — show help.
- `/language` — choose the interface language.

## Development Commands

- `yarn dev` — watch TypeScript files and restart after successful compilation.
- `yarn build-ts` — compile source files into `dist/`.
- `yarn distribute` — compile and run the built application.
- `yarn lint` — check formatting and lint rules with zero warnings allowed.

Automated tests are not configured yet. Before submitting a change, run `yarn build-ts` and `yarn lint`, then manually verify the affected Telegram flow. See the [contributor reference](docs/contributor-guide.md) for architecture, conventions, and verification guidance.

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for Telegram setup, production secrets, long-polling deployment with systemd, verification, updates, and rollback guidance.

## License

Released under the [MIT License](LICENSE).
