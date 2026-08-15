# Contributor Reference

This document expands the strict rules in [`AGENTS.md`](../AGENTS.md). When the two conflict, `AGENTS.md` takes precedence.

## Architecture Overview

The application is a strict TypeScript Telegram bot built with grammY:

1. `src/app.ts` exposes health and authenticated Telegram webhook routes.
2. `src/helpers/bot.ts` composes grammY middleware, menus, commands, and inline-query handling for each request.
3. `src/middlewares/attachUser.ts` loads or creates a D1 user and infers an `en`, `ru`, or `uk` default from Telegram.
4. `src/middlewares/configureI18n.ts` applies the user's locale; bundled `locales/*.yaml` files supply translated content.
5. Inline queries registered through `src/helpers/bot.ts` call the Kinorium integration in `src/helpers/kinorium.ts`.
6. Search results become Telegram inline articles; expected no-result and API-error states should remain user-friendly.

## Key Files

- `wrangler.jsonc` — declares the Worker, D1 binding, public bot metadata, and required secrets.
- `migrations/` — versions the D1 schema; never rewrite an applied migration.
- `src/models/Context.ts` — defines bot-specific context properties and helpers.
- `src/models/User.ts` — stores the user's language preference.
- `src/menus/language.ts` — renders the language picker.
- `.github/workflows/workflow.yml` — compiles and lints pull requests.

## Local Development

Create `.dev.vars` from `.dev.vars.example`, then initialize local D1.

- `yarn` — install the locked dependencies.
- `yarn d1:migrate:local` — apply unapplied migrations to local D1.
- `yarn dev` — run the Worker locally with Wrangler.
- `yarn test` — run Vitest inside the Workers runtime.
- `yarn lint` — run formatting, ESLint, and type checks.
- `yarn build` — validate and bundle a deployment without publishing.

## Implementation Guidance

Prefer small, cohesive modules over utility dumping grounds. Share behavior only when doing so gives one clear source of truth. Keep network, persistence, Telegram presentation, and domain mapping separated so logic can be tested without live services. Prefer existing packages and avoid adding dependencies without a concrete need.

Wrangler resolves the `@/` source alias during bundling. Regenerate `worker-configuration.d.ts` with `yarn types` whenever bindings or compatibility settings change.

Handle expected failures explicitly. Inline queries should return useful no-result or error responses rather than leaking exceptions. Log actionable context, but never tokens, API keys, database URLs, or full Kinorium URLs containing credentials. Keep Telegram titles, descriptions, and result payloads compact.

Use `camelCase` for functions and ordinary module filenames, `PascalCase` for classes and types, and `UPPER_SNAKE_CASE` for constants. Each locale YAML file must retain a top-level `name` field used by the language menu.

## Verification Strategy

For pure mapping, validation, and error handling, use pragmatic TDD: write the smallest failing Vitest case, implement only enough to pass, then refactor. Repository tests use Cloudflare's Vitest integration so D1 and Worker behavior execute in the target runtime.

Every code change must pass `yarn lint`, `yarn test`, and `yarn build`. Manually verify affected Telegram commands or inline queries after a preview deployment, including empty input, no results, upstream errors, and timeouts when relevant.
