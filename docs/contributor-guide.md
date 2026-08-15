# Contributor Reference

This document expands the strict rules in [`AGENTS.md`](../AGENTS.md). When the two conflict, `AGENTS.md` takes precedence.

## Architecture Overview

The application is a strict TypeScript Telegram bot built with grammY:

1. `src/app.ts` connects to MongoDB, installs middleware and menus, registers commands, and starts the runner.
2. `src/middlewares/attachUser.ts` loads or creates the Typegoose `User`, infers an `en`, `ru`, or `uk` default from Telegram, and attaches it to the custom `Context`.
3. `src/middlewares/configureI18n.ts` applies the user's locale; `locales/*.yaml` supplies translated content and language names used by the menu.
4. Inline queries registered through `src/helpers/bot.ts` call the Kinorium integration in `src/helpers/kinorium.ts`.
5. Search results become Telegram inline articles; expected no-result and API-error states should remain user-friendly.

## Key Files

- `src/helpers/env.ts` — loads `.env` and validates runtime configuration.
- `src/helpers/startMongo.ts` — establishes the MongoDB connection.
- `src/models/Context.ts` — defines bot-specific context properties and helpers.
- `src/models/User.ts` — stores the user's language preference.
- `src/menus/language.ts` — renders the language picker.
- `.github/workflows/workflow.yml` — compiles and lints pull requests.

## Local Development

Create `.env` from `.env.sample` with `TOKEN`, `MONGO`, and `APIKEY`, then make MongoDB reachable before starting the bot.

- `yarn` — install the locked dependencies.
- `yarn dev` — watch, compile, and restart the bot.
- `yarn build-ts` — compile `src/` to ignored `dist/` output.
- `yarn distribute` — compile and launch the production entry point.
- `yarn lint` — run Prettier and ESLint with zero warnings allowed.

## Implementation Guidance

Prefer small, cohesive modules over utility dumping grounds. Share behavior only when doing so gives one clear source of truth. Keep network, persistence, Telegram presentation, and domain mapping separated so logic can be tested without live services. Prefer existing packages and avoid adding dependencies without a concrete need.

The `@/` source alias compiles for runtime through `module-alias/register`. After changing imports or module layout, validate the compiled `dist/` entry point rather than assuming TypeScript resolution alone is sufficient.

Handle expected failures explicitly. Inline queries should return useful no-result or error responses rather than leaking exceptions. Log actionable context, but never tokens, API keys, database URLs, or full Kinorium URLs containing credentials. Keep Telegram titles, descriptions, and result payloads compact.

Use `camelCase` for functions and ordinary module filenames, `PascalCase` for classes and types, and `UPPER_SNAKE_CASE` for constants. Each locale YAML file must retain a top-level `name` field used by the language menu.

## Verification Strategy

For pure mapping, validation, and error-handling logic, use pragmatic TDD: write the smallest failing behavior test, implement only enough to pass, then refactor. A test runner is not configured yet, so introducing the first tests requires a deliberate framework choice and matching package scripts.

Until then, every code change must pass `yarn build-ts` and `yarn lint`. Manually verify the affected commands or inline queries, including success, empty input, no results, upstream error, and timeout paths when relevant. Record those checks in the pull request.
