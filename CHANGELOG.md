# Changelog

All notable changes to Sumstair (called StepSlate before 0.2.0) are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-08

### Changed

- **Renamed from StepSlate to Sumstair** (repository, package names
  `@sumstair/*`, web app title and manifest, link previews, documentation). An
  unrelated, announced app uses the name StepSlate, so the English name changed
  to avoid confusion. The Chinese name 步步解 is unchanged. Old repository URLs
  redirect to <https://github.com/Kinfxhk/sumstair>; the old GitHub Pages address
  (`kinfxhk.github.io/stepslate/`) no longer works, use
  <https://kinfxhk.github.io/sumstair/>. Environment variables are now
  `SUMSTAIR_HOST`, `SUMSTAIR_PORT` and `SUMSTAIR_DIST`; settings and practice
  progress saved by 0.1.0 in the browser are not carried over.
- Powers in pure arithmetic accept exponents from -20 to 20, including negative
  exponents (`2^-3`, `(2/3)^-2`), still guarded by the size limit.
- An equation with infinitely many solutions in a system is divided by the common
  factor of its coefficients before the conclusion (`2x+4y=6; 3x+6y=9` ends with
  `x + 2y = 3`).
- The offline pre-cache holds only the files the app uses: 68 files and
  1,514,835 bytes in 0.1.0, now 14 files and about 508 kB (woff2 fonts only; the
  link-preview image is not pre-cached).
- The footer "Source code" link points to the exact version tag.

### Added

- Clear "not supported yet" messages for `sin`, `cos`, `tan`, `log`, `ln`, `exp`,
  `abs`, `sqrt` and `√` instead of reading them as letters.
- Optional commands at the start: `solve`, `simplify`, `factor` / `factorise`
  (for example `solve 2x+3=7`). Factorising an expression on its own is planned
  for the next version and says so.
- Full-width input from Chinese input methods (`２ｘ＋３＝７`, full-width brackets
  and spaces) and superscript exponents (`x²`, `2⁻¹`).
- "Report a wrong answer" link under the steps: opens a pre-filled GitHub issue
  that you check and submit yourself; nothing is sent automatically.
- Link previews (Open Graph / Twitter card) with an original 1200×630 image.
- Code of Conduct (Contributor Covenant 3.0), issue forms (wrong answer, topic
  request, translation), pull-request checklist, GitHub Discussions.
- AI-assisted development policy in CONTRIBUTING and a "Commitments" section in
  the README: never ads, tracking or paid step unlocks.
- Windows CI job; adversarial parser tests; 590 unit, property, golden and
  mutation tests (485 in 0.1.0).

### Fixed

- `-0` is never shown (`3-(-0)`, `x=-x`); a lone minus zero is explained.

## [0.1.0] - 2026-10-08

First release.

### Added

- Exact number types (big-integer rationals and square-root surds) and a hand-written
  parser with implicit multiplication, Unicode operators and an ambiguity warning for
  inputs such as `1/2x`.
- Step engine for five problem types: arithmetic with fractions, decimals and powers;
  polynomial simplification (up to two letters, degree 4); linear equations; quadratic
  equations (factorising, square roots, quadratic formula with exact surds, no real
  roots); two simultaneous linear equations by elimination (including no / infinitely
  many solutions).
- Independent verifier: every displayed step is checked (exact evaluation, polynomial
  identity, constant-multiple and solution-set equivalence, row-operation matrices for
  systems, recomputed substitution checks). Unverifiable steps are never shown.
- Explanations in English and Traditional Chinese (Hong Kong written style).
- Web app: "I read this as" preview, step-by-step reveal, highlights, check steps,
  practice mode with seeded generators, equivalence-checked answers, hints and local
  progress, dark/light theme, large text, MathML output, share links in the URL
  fragment, print styles, offline service worker, strict CSP.
- Command line solver (`npm run solve`), loopback static server (`npm start`),
  Dockerfile, CI (check, e2e, docker), GitHub Pages workflow, static-site zip.

[0.2.0]: https://github.com/Kinfxhk/sumstair/releases/tag/v0.2.0
[0.1.0]: https://github.com/Kinfxhk/sumstair/releases/tag/v0.1.0
