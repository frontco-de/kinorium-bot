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

Copy `.dev.vars.example` to `.dev.vars`. Set `TOKEN` to the test bot token, `APIKEY` to the Kinorium key, and generate `WEBHOOK_SECRET` with `openssl rand -hex 32`. Never commit `.dev.vars`. If using a separate test bot, replace the public `BOT_INFO` object in `wrangler.jsonc` with the `result` fields returned by Telegram's `getMe`, then run `yarn types`; restore the production bot metadata before promotion.

For local development, initialize D1 with `yarn d1:migrate:local`, then run `yarn dev` and check `http://localhost:8787/health`.

## 2. Deploy the Worker and D1

Deploy from `feat/cloudflare-worker` while testing. Wrangler automatically provisions the configured D1 database on the first deployment and writes its ID to `wrangler.jsonc`:

```sh
yarn deploy --secrets-file .dev.vars
yarn d1:migrate:remote
```

Review and commit the generated D1 `database_id`; it identifies the resource but is not a credential. Record the `https://kinorium-bot.<subdomain>.workers.dev` URL printed by Wrangler. Confirm `<worker-url>/health` returns `{"status":"ok","bot":"<configured_username>"}` before connecting Telegram.

## 3. Register the Telegram Webhook

Read the token and webhook secret without putting their values in shell history:

```sh
read -s TOKEN
read -s WEBHOOK_SECRET
WORKER_URL=https://kinorium-bot.<subdomain>.workers.dev
curl --fail-with-body --request POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query","inline_query"]'
curl --fail-with-body "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
unset TOKEN WEBHOOK_SECRET
```

Telegram should report the exact HTTPS webhook URL and no `last_error_message`. In BotFather, enable inline mode with `/setinline` if it is disabled.

## 4. Verify

- Send `/start`, `/help`, and `/language` to the test bot.
- In another chat, enter `@test_bot_username Dune 2021` and select a result.
- Check no-result and upstream-error behavior in each affected language.
- Inspect logs with `npx wrangler tail`; logs must not contain tokens, queries, user data, or authenticated URLs.

## Promote, Update, and Roll Back

After validation, merge the feature branch to `main`, deploy that exact commit, apply migrations, and re-register the production bot webhook using its own secrets. For updates, repeat validation, deployment, migration, and smoke tests in that order.

To roll back code, check out the recorded known-good commit and run `yarn deploy`. D1 migrations are forward-only; assess schema compatibility before rollback. To disconnect a test bot, call Telegram's `deleteWebhook` endpoint. Rotate all affected secrets immediately if one is exposed.
