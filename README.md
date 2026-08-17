# Kinorium Bot

A multilingual Telegram bot for finding movies and TV shows through the Kinorium API. The bot works in Telegram inline mode and returns up to ten matching titles with localized names and links, release information, and poster thumbnails when available.

The running instance is [@kinorium_bot](https://t.me/kinorium_bot). The instructions below cover running your own.

The project is written in strict TypeScript and uses [grammY](https://grammy.dev), a Cloudflare Worker webhook, D1 persistence, and YAML localization for English, Russian, and Ukrainian.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- Corepack (provides the pinned Yarn 4.9.1 version)
- A free Cloudflare account
- A Telegram bot token
- A Kinorium API key

## Getting Started

```sh
git clone https://github.com/frontco-de/kinorium-bot.git
cd kinorium-bot
nvm use
corepack enable
yarn
cp .env.example .env
```

Set the required values in `.env` and generate a separate random webhook secret:

```dotenv
TOKEN=YOUR_TELEGRAM_BOT_TOKEN
APIKEY=YOUR_KINORIUM_API_KEY
WEBHOOK_SECRET=GENERATE_A_RANDOM_SECRET
ADMIN_ID=YOUR_TELEGRAM_USER_ID
```

Initialize the local D1 database and run the Worker:

```sh
yarn d1:migrate:local
yarn dev
```

The local health endpoint is `http://localhost:8787/health`. Telegram cannot send updates to localhost without a public tunnel, so automated tests are the default local verification path.

## Using the Bot

In any Telegram chat, type the bot username followed by a movie or series title. Use [@kinorium_bot](https://t.me/kinorium_bot) for the hosted instance, or your own username when self-hosting:

```text
@kinorium_bot Dune 2026
```

Select a result to send a compact localized message such as:

```text
TV series «Futurama» (1999–…, Futurama)
```

The quoted title links to the English, Russian, or Ukrainian Kinorium site selected by the user's bot language. A different original title follows the year; an ellipsis marks an ongoing series. The bot also supports:

- `/start` — show a short inline-search example.
- `/help` — show detailed usage instructions.
- `/language` — choose the interface language.

`/stats` reports usage to the account named in `ADMIN_ID` and stays silent for everyone else. It covers the trailing 24 hours, 7 days, 30 days, and 365 days, then all-time totals and up to ten recent days, counting Kinorium requests (so cached searches are excluded), results users selected, and distinct active users. Stored data is counts plus, for active-user math, which hours a user id interacted — never queries.

Messages that are not one of these commands are ignored, so group conversations never reach the database. In a group, only the member who sent `/language` can use the buttons that command produces. Each user may run up to 30 inline searches per minute per Cloudflare location; beyond that the bot answers with a short "slow down" result instead of calling Kinorium.

Telegram privately caches completed inline answers for five seconds. The Worker separately caches successful, non-empty Kinorium searches for five minutes, so a successful answer can be up to five minutes old. Empty results and upstream errors remain uncached, so temporary failures and newly indexed titles are not retained as misses.

Cloudflare guarantees functional Cache API operations for Workers on custom domains, and cache entries never leave the data center that wrote them. On a `workers.dev` deployment treat the five-minute search cache as best effort: expect low hit rates, and attach a custom domain if the cache needs to matter.

## Development Commands

- `yarn dev` — run the Worker and local D1 database with Wrangler.
- `yarn test` — run unit and Worker integration tests in the Workers runtime.
- `yarn lint` — check formatting, ESLint rules, and TypeScript types.
- `yarn build` — create a local Wrangler deployment bundle without publishing it.
- `yarn types` — regenerate Worker binding and runtime types after config changes.
- `yarn validate` — run every check required before deployment.
- `yarn release:dry-run` — preview the next SemVer release and changelog.

See the [contributor reference](docs/contributor-guide.md) for architecture and verification guidance.

## Releases

Releases derive their version and changelog from Conventional Commits. See [docs/RELEASE.md](docs/RELEASE.md) for the initial tag decision and release procedure.

## Deployment

See [docs/DEPLOY.md](docs/DEPLOY.md) for Cloudflare authentication, D1 migration, secrets, webhook registration, verification, and rollback.

## License

Released under the [MIT License](LICENSE).
