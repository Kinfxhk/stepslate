# Changelog

All notable changes to Sumstair are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/Kinfxhk/sumstair/releases/tag/v0.1.0
