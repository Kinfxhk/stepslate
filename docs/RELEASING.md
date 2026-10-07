# Releasing StepSlate

Maintainer checklist. Nothing here runs automatically.

1. `npm ci && npm run check` (tests, type check, lint, licence allowlist, hygiene, gitleaks).
2. `PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e` several times in a row; all runs must pass.
3. Clean-copy test: `git clone <repo> /tmp/ss && cd /tmp/ss && npm ci && npm start`, then open
   http://127.0.0.1:4873/ and check `/healthz`.
4. Update the version in every `package.json` and add a `CHANGELOG.md` section.
5. `npm run build && npm run package:site` writes `release/stepslate-site-v<version>.zip` and its
   `.sha256`. The zip is reproducible (fixed timestamps and order).
6. `node scripts/release-notes.mjs > release/notes.md` builds the release text from the changelog.
7. Tag: `git tag -a v<version> -m "StepSlate v<version>"`, push the branch and the tag, then create
   a GitHub release from `release/notes.md` and attach the zip and checksum.
8. GitHub Pages uses the `pages.yml` workflow (source: GitHub Actions). It runs when a release is
   published, or by hand from the Actions tab.
9. After the first push, confirm the CI jobs (check, e2e, docker) are green and the Pages site opens.
