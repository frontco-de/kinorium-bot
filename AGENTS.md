# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project Overview

This is a TypeScript Telegram bot starter built on grammY (based on https://github.com/frontco-de/kinorium-bot). It includes:
- Inline-mode search: takes inline query text, calls the Kinorium API, and returns inline article results.
- MongoDB persistence for a `User` model (stores language preference).
- i18n via YAML locale files and a language selection menu.

## Key Paths

- `src/app.ts` — application entry point; wires middleware, commands, and starts the bot runner.
- `src/helpers/bot.ts` — grammY `Bot` instance and inline query handler registration.
- `src/helpers/kinorium.ts` — Kinorium API request + response shaping (`searchMoviesDetailed`).
- `src/helpers/env.ts` — loads `.env` and validates required vars.
- `src/helpers/startMongo.ts` — MongoDB connection.
- `src/models/Context.ts` — custom grammY context (`ctx.dbuser`, `ctx.replyWithLocalization`).
- `src/models/User.ts` — MongoDB user model (Typegoose) + upsert helper.
- `locales/*.yaml` — i18n content and language names.
- `dist/` — compiled output (do not edit by hand).

## Environment Variables

Required (validated by `src/helpers/env.ts`):
- `TOKEN` — Telegram bot token.
- `MONGO` — MongoDB connection string.
- `KINORIUMAPIKEY` — Kinorium API key used for search.

Notes:
- `.env` is developer-specific and may contain secrets; do not commit it.
- Use `.env.sample` for documented placeholders.

## Common Commands

- Install: `npm install`
- Dev (watch + run compiled output): `npm run develop`
- Build TypeScript: `npm run build-ts`
- Run built bot: `node dist/app.js` (or `npm run distribute`)
- Lint/format check: `npm run lint` (runs `prettier --check src` + eslint)

## Code Style & Conventions

- Language: TypeScript (strict). Keep changes minimal and consistent with existing patterns.
- Imports: use the `@/*` alias (configured in `tsconfig.json`). Runtime uses `module-alias/register`, so changes to import structure must be validated against `dist/` output.
- Error handling:
  - Inline query handler should fail “softly” (return empty results on unexpected errors).
  - Prefer user-friendly “no results” / “API error” inline articles over throwing.
  - Log actionable errors; avoid logging secrets (tokens, API keys).
- Keep responses to Telegram within platform constraints (short titles/descriptions; avoid huge payloads).
- Locales: `locales/*.yaml` must include a top-level `name` field (used for the language menu button labels).

## Working Agreements for Agents

- Do not edit generated files in `dist/`; edit `src/` and rebuild if needed.
- Avoid introducing new dependencies unless necessary; prefer existing libraries.
- When you change behavior, run the narrowest relevant command(s) (e.g., `npm run build-ts`, then `npm run lint` if appropriate).
- If a change affects env vars, update both `README.md` and `.env.sample`.
- Be careful with `.env` contents in logs, diffs, and messages—treat it as secret.

## Quick Functional Flow (for Orientation)

1. `src/app.ts` connects to Mongo, installs middlewares, and starts the bot.
2. `attachUser` upserts a user record and stores it on `ctx.dbuser` (infers default locale from Telegram for `en`/`ru`/`uk`).
3. `configureI18n` sets `ctx.i18n.locale(ctx.dbuser.language)`; `ctx.replyWithLocalization()` uses i18n keys.
4. Inline queries in `src/helpers/bot.ts` call `searchMoviesDetailed()` from `src/helpers/kinorium.ts`.
5. Results are mapped into inline “article” results and returned via `answerInlineQuery`.
