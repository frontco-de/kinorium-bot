# Repository Guidelines

## Non-Negotiable Engineering Rules

- Apply DRY thoughtfully: remove meaningful duplication, but do not create abstractions before a repeated concept is understood.
- Follow SOLID at module and class boundaries. Keep handlers thin, dependencies explicit, and each unit focused on one responsibility.
- Write Clean Code: use intention-revealing names, small functions, early returns, and comments that explain why rather than restating what.
- Practice pragmatic TDD. For fixes, first add a regression test when the behavior can be isolated. For new logic, prefer a red-green-refactor loop. Do not manufacture low-value tests for trivial configuration or documentation changes.
- Follow Standard TypeScript style: two-space indentation, single quotes, no semicolons, and clear, sorted imports. The repository currently checks these conventions through Prettier and ESLint with `yarn lint`; `ts-standard` itself is not installed.
- Never edit generated `dist/` files or commit secrets from `.env`.

## Structure and Boundaries

`src/app.ts` is the composition root. Place Telegram commands in `src/handlers/`, integrations and shared setup in `src/helpers/`, request pipeline logic in `src/middlewares/`, persistence and context types in `src/models/`, menus in `src/menus/`, and translations in `locales/`. Use the `@/` alias for imports from `src`; ESLint rejects relative source imports.

See [docs/contributor-guide.md](docs/contributor-guide.md) for the architecture flow, key files, environment requirements, and validation guidance.

## Required Workflow

Install with `yarn`, run locally with `yarn dev`, compile with `yarn build-ts`, and run all configured static checks with `yarn lint`. No automated test runner or coverage threshold is currently configured; add focused tests with new testable behavior and document manual Telegram verification until a runner is adopted.

Use Conventional Commits: `type(scope): imperative summary`, for example `fix(inline): handle empty results`. Use matching kebab-case branch names such as `feat/movie-posters`, `fix/api-timeout`, `refactor/bot-context`, or `chore/update-deps`.

Pull requests must contain a concise bullet summary, linked issue when applicable, verification steps, and screenshots for visible Telegram changes. Keep unrelated changes separate and ensure CI compile and lint checks pass.

## Security

Keep `TOKEN`, `MONGO`, and `APIKEY` only in `.env`. Never log secrets or full authenticated request URLs. Document configuration changes in `.env.sample` and `README.md`.
