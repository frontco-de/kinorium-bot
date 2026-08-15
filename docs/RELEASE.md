# Releasing

Releases use Conventional Commits to determine the next SemVer version, update `package.json`, generate `CHANGELOG.md`, create a `chore(release)` commit, and add a `v<version>` Git tag. The release command does not push or publish anything. Its wrapper requires a clean `main`, fetches remote tags, confirms `main` matches `origin/main`, and runs all validation gates before writing a release.

## Version Rules

- `fix:` produces a patch release.
- `feat:` produces a minor release.
- A `!` after the type or a `BREAKING CHANGE:` footer produces a major release.
- Other commit types do not independently require a version bump and may be omitted by the default changelog preset.

Only commits after the latest SemVer tag are considered. Keep commit messages accurate because squash-merge titles become release inputs.

## First Release

The repository starts at version `1.0.0` but has no release tag. Choose one bootstrap path and never run both:

- Run `yarn release:first` to establish the current code as `v1.0.0` without changing the version.
- Run the normal release flow to infer a new version from the complete existing history.

Always inspect `yarn release:dry-run` before choosing.

## Release Procedure

Start from a clean, synchronized `main` branch:

```sh
git switch main
git pull --ff-only
git fetch --tags
yarn install --frozen-lockfile
yarn release:dry-run
yarn release
```

Review the generated release commit, `CHANGELOG.md`, package version, and tag. If they are correct, push the commit and tag together:

```sh
git push --follow-tags origin main
```

The `main` push triggers the production Worker deployment. Confirm the GitHub validation and Cloudflare build, then verify `/health` and the affected Telegram behavior. D1 migrations remain a separate, explicit step described in [DEPLOY.md](DEPLOY.md).
