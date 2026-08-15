# Deploying the Telegram Bot

The current application uses grammY runner with long polling. Deploy it as one continuously running Node.js process per bot token. It does not expose an HTTP server and is not ready for webhook-only or scale-to-zero hosting without code changes. Telegram documents long polling and webhooks as mutually exclusive update methods; see the [Bot API](https://core.telegram.org/bots/api#getting-updates) and [grammY deployment guide](https://grammy.dev/guide/deployment-types).

## 1. Prepare Telegram

1. Create or select the bot in [@BotFather](https://t.me/BotFather) and copy its token to a password manager.
2. Send `/setinline` to BotFather, select the bot, and set a search placeholder. Inline mode must be enabled for this bot's primary flow ([Telegram inline bot guide](https://core.telegram.org/bots/inline)).
3. If this token previously used a webhook, remove that webhook through the Telegram Bot API before starting the service. Do not discard pending updates unless that is intentional.

Never paste the token into tickets, commits, screenshots, or shared shell transcripts.

## 2. Prepare the Host

Use a Linux host with outbound HTTPS access, Node.js 24, Yarn Classic, Git, and access to MongoDB. Create a dedicated non-root service account and application directory; the exact account-management commands depend on the distribution.

Clone and validate the release as that account:

```sh
git clone https://github.com/frontco-de/kinorium-bot.git /opt/kinorium-bot
cd /opt/kinorium-bot
git switch main
yarn install --frozen-lockfile
yarn build-ts
yarn lint
```

Do not deploy `node_modules/` or `dist/` from a developer workstation. Build them on the target host or in a trusted CI release job.

## 3. Configure Secrets

Create `/etc/kinorium-bot.env` as a root-owned file. systemd loads it before starting the unprivileged service:

```dotenv
TOKEN=YOUR_TELEGRAM_BOT_TOKEN
MONGO=mongodb://HOST:27017/DATABASE
APIKEY=YOUR_KINORIUM_API_KEY
```

Restrict the file with `sudo chown root:root /etc/kinorium-bot.env` and `sudo chmod 600 /etc/kinorium-bot.env`. Use a least-privilege MongoDB user, require TLS for a remote database, and restrict network access to the database.

## 4. Run with systemd

Create `/etc/systemd/system/kinorium-bot.service`. Replace the user, group, paths, and Node binary path with values from the host (`command -v node`):

```ini
[Unit]
Description=Kinorium Telegram bot
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=kinorium-bot
Group=kinorium-bot
WorkingDirectory=/opt/kinorium-bot
EnvironmentFile=/etc/kinorium-bot.env
ExecStart=/usr/bin/node /opt/kinorium-bot/dist/app.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
```

Load and start the service:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now kinorium-bot
sudo systemctl status kinorium-bot
sudo journalctl -u kinorium-bot -n 100 --no-pager
```

The startup log should report a successful MongoDB connection and the bot username. Keep only one active polling deployment for the token during migrations.

## 5. Verify the Deployment

- Send `/start`, `/help`, and `/language` directly to the bot.
- In another chat, enter `@your_bot_username Dune 2021` and select a result.
- Check a title with no matches and confirm the localized no-results response.
- Review logs for initialization, MongoDB, Telegram, or Kinorium errors without exposing secret values.

## Updating and Rolling Back

Record the currently deployed commit before each update. Then fetch the intended revision, install from the lockfile, build, lint, and restart:

```sh
cd /opt/kinorium-bot
git pull --ff-only origin main
yarn install --frozen-lockfile
yarn build-ts
yarn lint
sudo systemctl restart kinorium-bot
sudo systemctl status kinorium-bot
```

For rollback, check out the previously recorded release commit, repeat installation and build, then restart and re-run the verification checklist. Rotate `TOKEN`, `MONGO`, or `APIKEY` immediately if any secret is exposed.
