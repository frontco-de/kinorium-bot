# Repository Guidelines

## Non-Negotiable Engineering Rules

- Apply DRY thoughtfully: remove meaningful duplication, but do not create abstractions before a repeated concept is understood.
- Follow SOLID at module and class boundaries. Keep handlers thin, dependencies explicit, and each unit focused on one responsibility.
- Write Clean Code: use intention-revealing names, small functions, early returns, and comments that explain why rather than restating what.
- Practice pragmatic TDD. For fixes, first add a regression test when the behavior can be isolated. For new logic, prefer a red-green-refactor loop. Do not manufacture low-value tests for trivial configuration or documentation changes.
- Follow Standard TypeScript (`standard-ts`) conventions: two-space indentation, single quotes, no semicolons, and clear, sorted imports. Prettier and ESLint enforce the repository rules through `yarn lint`.
- Never edit generated `dist/` or `worker-configuration.d.ts` manually. Never commit local `.env`, `.dev.vars`, tokens, or API keys; `.env.example` contains placeholders only.

## Structure and Boundaries

`src/app.ts` is the Worker entry point. Place Telegram commands in `src/handlers/`, integrations in `src/helpers/`, middleware in `src/middlewares/`, D1 repositories and context types in `src/models/`, menus in `src/menus/`, translations in `locales/`, migrations in `migrations/`, and tests in `test/`. Use `@/` imports for `src` modules.

See [docs/contributor-guide.md](docs/contributor-guide.md) for the architecture flow, key files, environment requirements, and validation guidance.

## Required Workflow

Enable Corepack and install with the repository-pinned Yarn version using `yarn install --immutable`. Regenerate bindings with `yarn types` after Wrangler changes, migrate local D1 with `yarn d1:migrate:local`, and run locally with `yarn dev`. Before handoff, run `yarn lint`, `yarn test`, and `yarn build`. Add focused Vitest coverage for changed behavior; no numeric coverage threshold is imposed.

Use Conventional Commits: `type(scope): imperative summary`, for example `fix(inline): handle empty results`. Use matching kebab-case branch names such as `feat/movie-posters`, `fix/api-timeout`, `refactor/bot-context`, or `chore/update-deps`.

Create releases only from a clean, synchronized `main` branch. Preview the inferred SemVer bump with `yarn release:dry-run`, then follow [docs/RELEASE.md](docs/RELEASE.md). Release commands create a local commit and tag but never authorize pushing them automatically.

Pull requests must contain a concise bullet summary, linked issue when applicable, verification steps, and screenshots for visible Telegram changes. Keep unrelated changes separate and ensure CI compile and lint checks pass.

## Security

Keep `TOKEN`, `APIKEY`, `WEBHOOK_SECRET`, and `ADMIN_ID` in `.env` locally and Cloudflare secrets remotely. Do not also create `.dev.vars`. Never log secrets, Telegram updates, search queries, error messages, or authenticated URLs; log through `src/helpers/logging.ts`, which records event names and error constructor names only. Never put API keys or readable searches in cache keys, and never cache Kinorium errors or empty results; see [docs/contributor-guide.md](docs/contributor-guide.md). Usage counters store one row per UTC day; never add query text or result ids to `usage_stats`, and never make the buckets finer than a day without agreeing to the extra rows first. `user_activity` exists only to count distinct active users, so keep it to `(day, user_id)` pairs, and keep `/forget` able to erase every row that identifies a user. Admin alerts follow the logging rule: event name and error constructor only, throttled through the `alerts` table, never retried. D1 exports contain user ids, so they stay in the gitignored `backups/` directory and are deleted once a migration is verified. Validate every field that arrives from Kinorium or the cache before it reaches Telegram. Render HTML messages through `Localizer.tHtml`, which escapes interpolated values, and keep `Localizer.t` for plain text such as inline descriptions. Keep D1 access parameterized and document binding changes in `wrangler.jsonc`, `.env.example`, and `README.md`.
