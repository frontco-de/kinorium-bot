# Deploying the Telegram Bot

The bot runs as a Cloudflare Worker, receives Telegram webhooks at `/webhook`, and stores language preferences in D1. Use a separate BotFather test bot while validating this branch: one Telegram token cannot use the existing deployment and this webhook simultaneously.

## 1. Prepare and Validate

Install dependencies, authenticate Wrangler, and run all local gates:

```sh
nvm use
corepack enable
yarn install --immutable
npx wrangler login
npx wrangler whoami
yarn validate
```

Before running any deployment or D1 command, replace `REPLACE_WITH_YOUR_CLOUDFLARE_ACCOUNT_ID` in `wrangler.jsonc` with the account ID shown by `npx wrangler whoami`. The configured ID makes Wrangler target that Cloudflare account. Do not attempt deployment while the placeholder remains. The account ID identifies the account but is not a secret.

Copy `.env.example` to `.env`. Set `TOKEN` to the test bot token, `APIKEY` to the Kinorium key, generate `WEBHOOK_SECRET` with `openssl rand -hex 32`, and set `ADMIN_ID` to the numeric Telegram user id allowed to run `/stats`. Never commit `.env`, and do not create `.dev.vars` because Wrangler gives it precedence.

For a new or replacement bot, load the trusted local file and request its public metadata:

```sh
set -a
source .env
set +a
curl --fail-with-body "https://api.telegram.org/bot${TOKEN}/getMe"
unset TOKEN APIKEY WEBHOOK_SECRET
```

`set -a` exports variables loaded by `source`; `set +a` restores normal shell behavior. Copy the returned `result` fields into the public `BOT_INFO` object in `wrangler.jsonc`, then run `yarn types`. Restore production bot metadata before promotion.

`BOT_INFO` mirrors Telegram's `getMe` response; it does not configure bot capabilities. Do not manually force fields to `true`. Standard inline mode requires `supports_inline_queries: true`, enabled through BotFather's `/setinline`. `can_join_groups` is unrelated to inline mode, and `supports_guest_queries` belongs to Telegram's separate guest-bot feature, which this project does not handle.

Keep BotFather privacy mode enabled (`/setprivacy` → Enable). With privacy mode disabled, Telegram delivers every group message to the Worker; the bot drops those updates before touching D1, but each one still costs an invocation. Privacy mode is enabled for this bot, which is why `BOT_INFO` carries `can_read_all_group_messages: false`. Re-run `getMe` and `yarn types` after changing the setting.

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

The D1 `database_id` identifies the resource but is not a credential. The Worker serves only `https://kinorium.frontco.de`; `workers_dev` and `preview_urls` are both disabled in `wrangler.jsonc`, so no other public hostname exists. Cloudflare creates the DNS record and certificate for the custom domain on first deploy, which takes a moment to become resolvable. Confirm `https://kinorium.frontco.de/health` returns `{"status":"ok","bot":"<configured_username>"}` before connecting Telegram. Routine deployments do not need to re-upload unchanged secrets.

A custom domain is a deliberate requirement rather than cosmetics. Zone rules — WAF custom rules and rate limiting rules — run _before_ the Worker, so traffic they block never starts an invocation and never consumes the daily request allowance. A `workers.dev` hostname bypasses those rules, and its Cache API operations are not guaranteed.

### Restrict the webhook to Telegram

Telegram posts webhooks only from `149.154.160.0/20` and `91.108.4.0/22`, and [documents](https://core.telegram.org/bots/webhooks) that limiting traffic to those ranges is supported. Add a WAF custom rule on the zone that blocks `/webhook` requests from anywhere else:

```txt
(http.host eq "kinorium.frontco.de" and http.request.uri.path eq "/webhook"
  and not ip.src in {149.154.160.0/20 91.108.4.0/22})
```

Action: Block. This is dashboard or API configuration, not Wrangler configuration, so it does not live in this repository — record it here and re-check it whenever the bot stops receiving updates, because Telegram warns the ranges may change. The Worker's own secret-token check stays in place regardless; the rule exists to keep rejected floods from consuming Worker invocations.

## 3. Register the Telegram Webhook

Load the already configured values without putting their contents in shell history:

```sh
set -a
source .env
set +a
WORKER_URL=https://kinorium.frontco.de
curl --fail-with-body --request POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query","inline_query","chosen_inline_result"]'
curl --fail-with-body "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
unset TOKEN APIKEY WEBHOOK_SECRET ADMIN_ID WORKER_URL
```

Telegram should report the exact HTTPS webhook URL and a `pending_update_count` that returns to zero. An older `last_error_message` may remain recorded; compare its timestamp and confirm current behavior instead of treating the field alone as a current failure. A `401 Unauthorized` means the `WEBHOOK_SECRET` uploaded to Cloudflare does not match the value passed to `setWebhook`. In BotFather, enable inline mode with `/setinline` if it is disabled.

`chosen_inline_result` carries the "sent result" counter. Telegram only emits it while inline feedback is enabled in BotFather (`/setinlinefeedback`); choose `Enabled` for exact counts, because the probabilistic settings deliver a sample and would undercount. Without it, searches are still counted and sent results stay at zero.

## 4. Verify

- Send `/start`, `/help`, and `/language` to the test bot.
- In another chat, enter `@test_bot_username Dune 2026` and select a result.
- Confirm the selected title, including its quotation marks, links to the language-specific Kinorium domain and that an ongoing series uses `…`.
- Repeat an identical query within five seconds to exercise Telegram's personal cache. Repeat it after five seconds but within five minutes to exercise the Worker's regional search cache.
- Check no-result and upstream-error behavior in each affected language.
- In a group with two accounts, send `/language` from one and press a button from the other: the second account must see the "menu belongs to another user" alert.
- Send ordinary group text and confirm no new row appears in D1 (`npx wrangler d1 execute kinorium-bot --remote --command "SELECT COUNT(*) FROM users"`).
- Send `/stats` from the `ADMIN_ID` account in a private chat and confirm the counters answer; send it from another account, and from a group, and confirm silence.
- Send `/forget` from a throwaway account and confirm the reply, then confirm its rows are gone (`npx wrangler d1 execute kinorium-bot --remote --command "SELECT COUNT(*) FROM users"`).
- After a search and a selection, confirm both counters moved (`npx wrangler d1 execute kinorium-bot --remote --command "SELECT * FROM usage_stats ORDER BY day DESC LIMIT 4"`).
- Inspect logs with `npx wrangler tail`; cache failures are non-fatal, and logs must not contain tokens, queries, error messages, user data, or authenticated URLs.

The Worker caches only successful, non-empty searches for five minutes. Cache keys hash the language and trimmed query; API keys and readable searches are excluded. [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) entries are regional, so a request reaching another data center can miss independently. Cloudflare guarantees functional cache operations for Workers on custom domains, which this deployment uses, so hits are expected rather than incidental — but a request served by another data center still misses.

Two limits apply. `UPDATE_RATE_LIMITER` drops updates from one sender above 60 per minute before any database access, so a flood cannot spend the daily D1 allowance the bot needs for its own reads; those updates get no answer at all. `INLINE_RATE_LIMITER` limits inline searches to 30 per user per minute and answers with a "slow down" result, protecting the Kinorium quota. The counters are location-local and eventually consistent, so the limit protects the Kinorium quota rather than providing exact accounting.

## Admin Alerts

The bot messages the `ADMIN_ID` account when a webhook request or an update handler fails. Alerts carry the event name and the error constructor name only, never an error message, update, or query, because those can contain user data and authenticated URLs.

The `alerts` table throttles them: its primary key is `(day, event)`, so the first failure of a kind each UTC day sends a message and the rest are silent inserts. Sending runs in the background and is never retried, so a failing notification cannot amplify the failure it reports; a failed send appears in logs as `admin_alert_failed`.

The admin account must have started a chat with the bot at least once, otherwise Telegram refuses the message with `403` and the alert is dropped. Pair this with a Cloudflare notification on Worker error rate, which still fires when the bot is too broken to message anyone.

## Data Retention and Erasure

`/forget` lets any user erase their own data: the `users` row and every `user_activity` row for that id, in one batch. There is deliberately no way to erase another account, and no HTTP endpoint for it — Telegram already authenticates the sender, so no additional surface is needed. Usage counters hold no personal data and stay intact, which keeps historical totals correct after an erasure.

Retention is manual by choice; no Cron Trigger is configured. To bound `user_activity` growth, prune days older than the longest `/stats` window:

```sh
npx wrangler d1 execute kinorium-bot --remote --command "DELETE FROM user_activity WHERE day < '2025-08-01'"
```

Adjust the date; anything older than roughly 400 days is beyond every window `/stats` reports. The same applies to `alerts`, whose rows are only useful for the current day.

## Backups and Recovery

Export before any destructive migration, and delete the dump once the migration is verified:

```sh
yarn d1:export:remote
```

The file lands in the gitignored `backups/` directory and contains user ids, so treat it as personal data on disk.

Recovery uses [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), which retains 30 days without any setup on this side:

```sh
npx wrangler d1 time-travel info kinorium-bot
npx wrangler d1 time-travel restore kinorium-bot --bookmark=<bookmark>
```

Restoring rewinds the whole database, so prefer it for a failed migration rather than for a single unwanted row.

## Usage Counters and `/stats`

`usage_stats` holds one row per UTC day and event. `api_call` counts requests actually sent to Kinorium, so cache hits are excluded and the number tracks upstream quota rather than keystrokes. `sent_result` counts inline results a user selected. `user_activity` holds one row per user per day they interacted, which is what makes "active users" answerable for any window. Storage therefore grows by at most two counter rows plus one row per active user per day.

`/stats` reports the current UTC day, then the trailing 7, 30, and 365 days, then all-time totals, then up to ten recent days. Window user counts are distinct active users; the all-time user count is registered accounts from the `users` table. Because rows are daily, the first line covers today since 00:00 UTC rather than a rolling 24 hours.

`/stats` answers the single account in the `ADMIN_ID` secret and silently ignores everyone else, so the command never reveals that it exists. Set it to your numeric Telegram user id and upload it like the other secrets. When it is unset the command answers nobody and the Worker logs `stats_admin_not_configured`.

Writes run through `ctx.waitUntil`, so a D1 failure cannot delay or break an answer to Telegram; failures appear in logs as `stats_write_failed` or `user_activity_write_failed`. `user_activity` is the only table that pairs a user id with a date; queries and result ids are never stored, and old rows can be pruned with a `DELETE FROM user_activity WHERE day < ?` without affecting the search or sent counters.

## Automatic Deployments from `main`

Connect the existing `kinorium-bot` Worker to the `frontco-de/kinorium-bot` repository under **Settings → Builds** in the Cloudflare dashboard. Configure:

- Production branch: `main`
- Root directory: `/`
- Build command: `yarn validate`
- Deploy command: `yarn deploy`
- Non-production branch builds: disabled; use the separate test Worker for previews

Before enabling builds, commit the real `account_id` in `wrangler.jsonc` and confirm the dashboard Worker name matches its `name`. Keep `TOKEN`, `APIKEY`, `WEBHOOK_SECRET`, and `ADMIN_ID` as Worker runtime secrets under **Settings → Variables & Secrets**; build variables are not available to the deployed Worker. Require the GitHub validation workflow to pass before merging into `main`, then verify the Cloudflare build and `/health` after each merge.

`yarn deploy` does not apply D1 migrations, and a push to `main` deploys automatically. When a release includes a migration, make it backward-compatible, run `yarn d1:migrate:remote`, verify it, and only then merge the Worker change into `main`. `0002_create_usage_counters.sql` is additive, but the `/stats` command and every counter fail until it is applied.

## Promote, Update, and Roll Back

After validation, merge the feature branch to `main`, update `BOT_INFO` for the production bot, upload its own secrets, deploy that exact commit, apply migrations, and register its webhook. For later updates, repeat validation, deployment, migration, and smoke tests in that order; webhook registration is only necessary when its URL or secret changes.

Use `npx wrangler versions list` to identify a deployed version and `npx wrangler rollback <VERSION_ID>` to restore it. D1 migrations are forward-only; assess schema compatibility before rollback. To disconnect a test bot, call Telegram's `deleteWebhook` endpoint. Rotate all affected secrets immediately if one is exposed.

## Keep the Test Bot for Later

Keep the test bot registered in BotFather, but disconnect it before its Worker secrets are replaced. While `.env` still contains the test token, delete its webhook and pending test updates:

```sh
set -a
source .env
set +a
curl --fail-with-body --request POST \
  "https://api.telegram.org/bot${TOKEN}/deleteWebhook" \
  --data-urlencode "drop_pending_updates=true"
curl --fail-with-body "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
unset TOKEN APIKEY WEBHOOK_SECRET
```

Confirm that `getWebhookInfo` returns an empty `url`, then store the test token securely outside the repository. If you reactivate the bot later, use a separate `kinorium-bot-test` Worker and D1 database so test and production secrets and language preferences remain isolated. When reconnecting the test webhook, pass `drop_pending_updates=true` to `setWebhook` to discard updates accumulated while it was offline.
