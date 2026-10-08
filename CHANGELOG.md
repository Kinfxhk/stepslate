# Changelog

All notable changes to Sumstair (called StepSlate before 0.2.0) are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-10-08

### Added

- Linear inequalities in one unknown (`2x + 3 < 11`, `<=`, `>=`, and the signs ≤ ≥).
  Each step is a sound transformation: the same solution set, and a non-zero constant
  multiple of the previous difference. Dividing by a negative number flips the sign.
  A step that changes the solution set, including a missed flip, is not shown.
  Quadratic inequalities are refused rather than guessed. The answer can be drawn as a
  number line; the drawing is a picture of the checked bound, not a step.
- Completing the square as an optional second method for quadratic equations (the
  checkbox "Completing the square"). The default path is unchanged (factorise rational
  roots, otherwise the quadratic formula). The square-root step uses the same
  solution-set check as the existing square-root path. Simultaneous equations still
  finish by a verified back-substitution after elimination.
- Factorising an expression (`factor x^2 - 5x + 6`): common factor, difference of
  squares, perfect square, cross method, grouping, and exact division by a rational
  root. Every step is a polynomial identity.
- Practice questions for inequalities and factorising. A factored answer that matches
  the checked factorisation is accepted; an unexpanded product is still rejected when
  the question asked for a simplified polynomial.
- The page says, in English and Traditional Chinese, that every step is checked before
  it is shown and that the app stays free (no account, no ads, no paid steps).
- `navigator.storage.persist()` on load, with a visible status (kept, not kept, or
  unsupported). A dismissible reminder offers a JSON backup of settings and practice
  progress after a few local changes. The file is built in the browser. No network.
- An independent Python oracle (`npm run oracle`, sympy 1.13.1) that recomputes
  solution sets and polynomial identities for hundreds of random inequalities,
  completing-the-square solutions, factorisations and linear equations. It runs in CI
  on Linux before the release is tagged.

### Not in this version

- Radical simplification and index laws beyond the integer powers already checked in
  arithmetic and polynomials. The verifier is exact over the rationals. Treating a
  general surd identity as a checked step would be a new trust boundary, so it waits.
- Word-problem templates. A sentence such as "let the number be x" is not a polynomial
  identity. Putting it in the step list would show prose the verifier does not check.
- Photo input. Camera capture and handwriting recognition are a licensing and design
  problem, not a small verified step.
- Quadratic inequalities. The solution set is not one half-line, and this version does
  not pretend otherwise.

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

[0.3.0]: https://github.com/Kinfxhk/sumstair/releases/tag/v0.3.0
[0.2.0]: https://github.com/Kinfxhk/sumstair/releases/tag/v0.2.0
[0.1.0]: https://github.com/Kinfxhk/sumstair/releases/tag/v0.1.0
