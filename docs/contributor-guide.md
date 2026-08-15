# Contributor Reference

This document expands the strict rules in [`AGENTS.md`](../AGENTS.md). When the two conflict, `AGENTS.md` takes precedence.

## Architecture Overview

The application is a strict TypeScript Telegram bot built with grammY:

1. `src/app.ts` exposes health and authenticated Telegram webhook routes. It refuses to authenticate when `WEBHOOK_SECRET` is unset, so a missing secret can never be matched by a header value.
2. `src/helpers/bot.ts` composes grammY middleware, menus, commands, and inline-query handling for each request.
3. `src/middlewares/ignoreUnhandledUpdates.ts` drops updates no handler answers, keeping group chatter out of D1.
4. `src/middlewares/attachUser.ts` loads or creates a D1 user and infers an `en`, `ru`, or `uk` default from Telegram.
5. `src/middlewares/configureI18n.ts` applies the user's locale; bundled `locales/*.yaml` files supply translated content.
6. Inline queries registered through `src/helpers/bot.ts` check the per-user rate limit in `src/helpers/rateLimit.ts`, then consult `src/helpers/searchCache.ts`, then call the Kinorium integration in `src/helpers/kinorium.ts` on a miss. The integration validates every untrusted record, decodes HTML entities, tolerates missing original titles, and discards records with no usable id or title.
7. `src/helpers/moviePresentation.ts` formats localized linked titles, years, and original titles; `src/helpers/inlineResult.ts` creates query-specific Telegram result IDs.
8. Search results become Telegram inline articles; expected no-result, rate-limit, and API-error states remain user-friendly and uncached.

## Error Handling and Logging

`bot.catch` logs and swallows handler failures so the webhook still answers `200`. Rethrowing would make Telegram redeliver the same update ahead of every later one, turning one deterministic bug into a stalled update queue. Only unexpected failures outside the bot, and grammY's own request timeout, produce a `500`.

Log through `src/helpers/logging.ts`. It records the event name and the error's constructor name only, because error messages can carry Telegram updates, search queries, SQL, or authenticated URLs.

## Key Files

- `wrangler.jsonc` — declares the Worker, the D1 and rate limit bindings, public bot metadata, and the names of the required secrets. The `secrets.required` list is what makes `wrangler types` emit `TOKEN`, `APIKEY`, and `WEBHOOK_SECRET`, so CI generates the same bindings as a local checkout that has a `.env`. Never put secret values here.
- `migrations/` — versions the D1 schema; never rewrite an applied migration.
- `src/models/Context.ts` — defines bot-specific context properties and helpers.
- `src/models/User.ts` — stores the user's language preference.
- `src/menus/language.ts` — renders the language picker; `src/menus/ownership.ts` keeps group members out of each other's menus.
- `src/helpers/searchCache.ts` — validates and stores successful searches in Cloudflare's regional Cache API.
- `src/helpers/moviePresentation.ts` — builds escaped Telegram HTML and localized Kinorium links.
- `.github/workflows/workflow.yml` — compiles, lints, and audits pull requests with a read-only token.

## Local Development

Create `.env` from `.env.example`, then initialize local D1. Do not also create `.dev.vars`; Wrangler gives it precedence over `.env`.

- `yarn` — install the locked dependencies.
- `yarn d1:migrate:local` — apply unapplied migrations to local D1.
- `yarn dev` — run the Worker locally with Wrangler.
- `yarn test` — run Vitest inside the Workers runtime.
- `yarn lint` — run formatting, ESLint, and type checks.
- `yarn build` — validate and bundle a deployment without publishing.

## Implementation Guidance

Prefer small, cohesive modules over utility dumping grounds. Share behavior only when doing so gives one clear source of truth. Keep network, persistence, Telegram presentation, and domain mapping separated so logic can be tested without live services. Prefer existing packages and avoid adding dependencies without a concrete need.

Wrangler resolves the `@/` source alias during bundling. Regenerate `worker-configuration.d.ts` with `yarn types` whenever bindings or compatibility settings change.

Handle expected failures explicitly. Inline queries should return useful no-result, rate-limit, or error responses rather than leaking exceptions. Log actionable context through `src/helpers/logging.ts`, but never tokens, API keys, error messages, database URLs, or full Kinorium URLs containing credentials. Keep Telegram titles, descriptions, and result payloads compact.

Preserve the cache policy unless a product requirement changes it deliberately: Telegram answers use a five-second personal cache, while Cloudflare caches only successful, non-empty searches for 300 seconds. Cache keys must hash the language and trimmed query and must never contain an API key or readable search. Cache reads must validate stored JSON; cache failures must fall back to Kinorium, and writes belong in `ExecutionContext.waitUntil()`. Cache API operations are only guaranteed on custom domains and never leave the writing data center, so treat hits as an optimization and never as a correctness requirement.

Treat every Kinorium field as untrusted. `src/helpers/kinorium.ts` validates ids and titles, coerces loosely typed numbers, and accepts only absolute HTTPS poster URLs, because posters are handed to Telegram as thumbnails. `src/helpers/searchCache.ts` reuses the same guard for cached records.

The bot assigns query-specific Telegram result IDs, but Telegram thumbnail URLs still load asynchronously in the client and a brief old-poster transition can occur. Do not add a poster proxy without measurements showing that its additional Worker traffic and complexity provide a useful improvement.

Use `camelCase` for functions and ordinary module filenames, `PascalCase` for classes and types, and `UPPER_SNAKE_CASE` for constants. Each locale YAML file must retain a top-level `name` field used by the language menu.

## Verification Strategy

For pure mapping, validation, and error handling, use pragmatic TDD: write the smallest failing Vitest case, implement only enough to pass, then refactor. Repository tests use Cloudflare's Vitest integration so D1 and Worker behavior execute in the target runtime.

Every code change must pass `yarn lint`, `yarn test`, and `yarn build`. Manually verify affected Telegram commands or inline queries after a preview deployment, including empty input, no results, upstream errors, and timeouts when relevant. For cache changes, cover hits, misses, language-specific keys, TTLs, invalid cached data, and the rule that empty/error results are not stored.
