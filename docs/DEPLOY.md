# Deploying the Telegram Bot

The bot runs as a Cloudflare Worker, receives Telegram webhooks at `/webhook`, and stores language preferences in D1. Use a separate BotFather test bot while validating this branch: one Telegram token cannot use the existing deployment and this webhook simultaneously.

## 1. Prepare and Validate

Install dependencies, authenticate Wrangler, and run all local gates:

```sh
nvm use
yarn install --frozen-lockfile
npx wrangler login
yarn types
yarn lint
yarn test
yarn build
```

Copy `.env.example` to `.env`. Set `TOKEN` to the test bot token, `APIKEY` to the Kinorium key, and generate `WEBHOOK_SECRET` with `openssl rand -hex 32`. Never commit `.env`, and do not create `.dev.vars` because Wrangler gives it precedence.

For a new or replacement bot, load the trusted local file and request its public metadata:

```sh
set -a
source .env
set +a
curl --fail-with-body "https://api.telegram.org/bot${TOKEN}/getMe"
unset TOKEN APIKEY WEBHOOK_SECRET
```

`set -a` exports variables loaded by `source`; `set +a` restores normal shell behavior. Copy the returned `result` fields into the public `BOT_INFO` object in `wrangler.jsonc`, then run `yarn types`. Restore production bot metadata before promotion.

For local development, initialize D1 with `yarn d1:migrate:local`, then run `yarn dev` and check `http://localhost:8787/health`.

## 2. Deploy the Worker and D1

Deploy from the branch and commit being tested. On a new Cloudflare account, first create the D1 database with `npx wrangler d1 create kinorium-bot`, copy its returned ID into `wrangler.jsonc`, and run `yarn types`. Existing deployments reuse the configured database.

For the first deployment, upload the secrets with the Worker version, then migrate:

```sh
yarn deploy --secrets-file .env
yarn d1:migrate:remote
```

For an existing Worker, upload secrets only when they change, then deploy normally:

```sh
npx wrangler secret bulk .env
yarn deploy
```

The D1 `database_id` identifies the resource but is not a credential. Record the `https://kinorium-bot.<subdomain>.workers.dev` URL and Worker version printed by Wrangler. Confirm `<worker-url>/health` returns `{"status":"ok","bot":"<configured_username>"}` before connecting Telegram. Routine deployments do not need to re-upload unchanged secrets.

## 3. Register the Telegram Webhook

Load the already configured values without putting their contents in shell history:

```sh
set -a
source .env
set +a
WORKER_URL=https://kinorium-bot.<subdomain>.workers.dev
curl --fail-with-body --request POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query","inline_query"]'
curl --fail-with-body "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
unset TOKEN APIKEY WEBHOOK_SECRET WORKER_URL
```

Telegram should report the exact HTTPS webhook URL and a `pending_update_count` that returns to zero. An older `last_error_message` may remain recorded; compare its timestamp and confirm current behavior instead of treating the field alone as a current failure. A `401 Unauthorized` means the `WEBHOOK_SECRET` uploaded to Cloudflare does not match the value passed to `setWebhook`. In BotFather, enable inline mode with `/setinline` if it is disabled.

## 4. Verify

- Send `/start`, `/help`, and `/language` to the test bot.
- In another chat, enter `@test_bot_username Dune 2021` and select a result.
- Confirm the selected title, including its quotation marks, links to the language-specific Kinorium domain and that an ongoing series uses `…`.
- Repeat an identical query within five seconds to exercise Telegram's personal cache. Repeat it after five seconds but within five minutes to exercise the Worker's regional search cache.
- Check no-result and upstream-error behavior in each affected language.
- Inspect logs with `npx wrangler tail`; cache failures are non-fatal, and logs must not contain tokens, queries, user data, or authenticated URLs.

The Worker caches only successful, non-empty searches for five minutes. Cache keys hash the language and trimmed query; API keys and readable searches are excluded. [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) entries are regional, so a request reaching another data center can miss independently.

## Promote, Update, and Roll Back

After validation, merge the feature branch to `main`, update `BOT_INFO` for the production bot, upload its own secrets, deploy that exact commit, apply migrations, and register its webhook. For later updates, repeat validation, deployment, migration, and smoke tests in that order; webhook registration is only necessary when its URL or secret changes.

Use `npx wrangler versions list` to identify a deployed version and `npx wrangler rollback <VERSION_ID>` to restore it. D1 migrations are forward-only; assess schema compatibility before rollback. To disconnect a test bot, call Telegram's `deleteWebhook` endpoint. Rotate all affected secrets immediately if one is exposed.
