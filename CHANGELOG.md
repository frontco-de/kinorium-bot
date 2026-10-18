# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.5.0](https://github.com/frontco-de/kinorium-bot/compare/v1.4.0...v1.5.0) (2026-10-18)

### Features

- **inline:** answer slow searches with "still searching" behind a flag ([#8](https://github.com/frontco-de/kinorium-bot/issues/8)) ([e3c51e6](https://github.com/frontco-de/kinorium-bot/commit/e3c51e6ad42680d3cdc0abbdaca80e81c3f1e527))
- **inline:** share identical in-flight searches and log answer delay ([#10](https://github.com/frontco-de/kinorium-bot/issues/10)) ([fb5c138](https://github.com/frontco-de/kinorium-bot/commit/fb5c1382e2b9cc484046a3258fca8d1cf8b0352c))
- **logging:** record Kinorium search duration and status ([#7](https://github.com/frontco-de/kinorium-bot/issues/7)) ([816953e](https://github.com/frontco-de/kinorium-bot/commit/816953e23517861ca489a63d957ae7485cb5eeb1))

### Bug Fixes

- **deps:** bump js-yaml to 5.4.1 for GHSA-r3ph-w7gj-g6xm ([#4](https://github.com/frontco-de/kinorium-bot/issues/4)) ([8a91852](https://github.com/frontco-de/kinorium-bot/commit/8a918529c3e42a35a6c5e596dbc8648f915c4e0d))
- **inline:** hand a search to the background after 5s ([#9](https://github.com/frontco-de/kinorium-bot/issues/9)) ([da74837](https://github.com/frontco-de/kinorium-bot/commit/da748374bd8417b8998836b8012da4a167ce755e))
- **kinorium:** treat a null response as "no results" ([#11](https://github.com/frontco-de/kinorium-bot/issues/11)) ([2dd2e59](https://github.com/frontco-de/kinorium-bot/commit/2dd2e596ae6615eb5601c4a0af6e998f199764b3))
- **webhook:** handle BotError outside bot.catch ([#3](https://github.com/frontco-de/kinorium-bot/issues/3)) ([ed1271b](https://github.com/frontco-de/kinorium-bot/commit/ed1271bb1e4dcd766d9962c68417c1268595f24d))

## [1.4.0](https://github.com/frontco-de/kinorium-bot/compare/v1.3.0...v1.4.0) (2026-08-17)

### Features

- **privacy:** erase data on request, alert the admin, and throttle floods ([841b585](https://github.com/frontco-de/kinorium-bot/commit/841b5857930507bb3860c175cfd4043e8befe45a))

## [1.3.0](https://github.com/frontco-de/kinorium-bot/compare/v1.2.1...v1.3.0) (2026-08-17)

### Features

- **deploy:** serve the bot from kinorium.frontco.de only ([9dac42e](https://github.com/frontco-de/kinorium-bot/commit/9dac42ec2722d0db8b81b8ede1e2884631a412b4))

## [1.2.1](https://github.com/frontco-de/kinorium-bot/compare/v1.2.0...v1.2.1) (2026-08-17)

### Bug Fixes

- **stats:** store one row per day instead of per hour ([f44cf6e](https://github.com/frontco-de/kinorium-bot/commit/f44cf6efe7d226efac31e00522975c7ad88e2dfb))

## [1.2.0](https://github.com/frontco-de/kinorium-bot/compare/v1.1.1...v1.2.0) (2026-08-17)

### Features

- **stats:** count searches, sent results, and active users ([3236392](https://github.com/frontco-de/kinorium-bot/commit/3236392d7a3f4fd22466f7b96fb5db59001dadc9))

## [1.1.1](https://github.com/frontco-de/kinorium-bot/compare/v1.1.0...v1.1.1) (2026-08-15)

### Bug Fixes

- **config:** restore required secret declarations ([2152069](https://github.com/frontco-de/kinorium-bot/commit/2152069a9289df1c37da164c137f1a32db898262))
- **locales:** use a current year in search examples ([7c75631](https://github.com/frontco-de/kinorium-bot/commit/7c75631356390c13340038ab49e4a394d07ee7a1))

## [1.1.0](https://github.com/frontco-de/kinorium-bot/compare/v1.0.1...v1.1.0) (2026-08-15)

### Features

- **inline:** rate limit searches and harden untrusted input ([27cc2c2](https://github.com/frontco-de/kinorium-bot/commit/27cc2c27a9ac1789781cd2a077a7b2077e2d29cd))

## [1.0.1](https://github.com/frontco-de/kinorium-bot/compare/v1.0.0...v1.0.1) (2026-08-15)

### Bug Fixes

- **inline:** show localized error results ([4503119](https://github.com/frontco-de/kinorium-bot/commit/45031198010498a1d8b280f9b915608c61b38d9f))
- **release:** format generated changelog ([958ea42](https://github.com/frontco-de/kinorium-bot/commit/958ea42ebbe092a90d3fac4a18ba9e1e19d0f8fe))

## 1.0.0 (2026-08-15)

### Features

- **bot:** improve start and help messages ([2991061](https://github.com/frontco-de/kinorium-bot/commit/2991061a5955774803d4c45e42ab4e09f2ac48ac))
- **cache:** cache inline search results ([a153924](https://github.com/frontco-de/kinorium-bot/commit/a1539240702edad6cc34b8e94043afedcc13ecfc))
- kinorium bot test ([4d58a2d](https://github.com/frontco-de/kinorium-bot/commit/4d58a2d2dc5e4e35892be8b74568143ad213d702))
- **worker:** migrate bot to Cloudflare Workers ([5f1dcd1](https://github.com/frontco-de/kinorium-bot/commit/5f1dcd14499c2a6dc05c85201635c89d5dce6b49))

### Bug Fixes

- **inline:** handle missing original titles ([be9c1f3](https://github.com/frontco-de/kinorium-bot/commit/be9c1f3ea1527e02d17921db9b68ea453af6aad4))
- **inline:** localize movie results ([1882112](https://github.com/frontco-de/kinorium-bot/commit/1882112a16c08c457825eed86ff7d1b8657ce8b5))
- **inline:** refresh results and format titles ([e28ac5d](https://github.com/frontco-de/kinorium-bot/commit/e28ac5d28457c986bbdb6bfc736c83dc03cc859c))
- remove unused packageManager field from package.json ([7572e1f](https://github.com/frontco-de/kinorium-bot/commit/7572e1f3b99c6130b89a9f44cb0d47c8207abc59))
- **worker:** accept Telegram webhook updates ([17eb2c9](https://github.com/frontco-de/kinorium-bot/commit/17eb2c94083035018fccb0d730d4c8e514844a2c))
- **worker:** verify webhook secret safely ([f89b56f](https://github.com/frontco-de/kinorium-bot/commit/f89b56fb4cd310f55b6fe147e11f54c1bc7df9ed))
