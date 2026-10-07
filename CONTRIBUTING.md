# Contributing to StepSlate

Thank you for helping. StepSlate exists so that every student can see full
worked solutions for free, offline and without an account. Correctness and legal
cleanliness matter as much as features.

## Clean-room rule (mandatory)

1. **Do not copy code, UI, text or assets** from any commercial or closed-source
   maths solver, or from other open-source solvers. The step engine is written
   from scratch; please do not paste or translate code from other solvers
   (including permissively licensed ones) so that the provenance of every line
   stays clear.
2. Work only from **general mathematical knowledge** and written descriptions in
   this repository. Do not use screenshots, step outputs, explanation sentences or
   UI recordings of other products as templates.
3. **No third-party problem sets.** Do not add textbook, exam or competitor
   problems. Tests and practice problems are written by contributors or generated
   by the seeded generators.
4. **No trademarks as branding.** Other products may be named only in plain
   factual comparisons in documentation, never in the UI or explanation strings
   (`npm run check:hygiene` enforces this).
5. **Third-party code** must be an npm dependency under an AGPL-3.0-compatible
   licence. Do not paste snippets of unknown origin, including from Q&A sites or
   AI tools.

## Correctness rule

Every step the UI shows must pass the independent verifier in
`packages/core/src/verify/`. A new rule needs:

- golden tests (expected steps),
- property tests (fast-check) showing that random inputs produce only verified
  steps and the correct final answer,
- a mutation test: a deliberately broken version of the rule must be rejected by
  the verifier.

Never weaken the verifier to make a rule pass. If a step cannot be verified, it
must not be shown.

## Developer Certificate of Origin

All commits must be signed off (`git commit -s`), certifying the
[Developer Certificate of Origin 1.1](https://developercertificate.org/): you wrote
the change or otherwise have the right to submit it under AGPL-3.0-or-later.

## Development

```bash
npm ci
npm run check      # lint, format, typecheck, tests, licences, hygiene, secrets
npm run test:e2e   # headless browser tests
```

- `packages/core` must stay **pure**: no I/O, no clock, no `Math.random()`
  (ESLint enforces this). Use the seeded RNG for practice problems.
- Explanation sentences live in `packages/core/src/i18n/`; every key must exist
  in both `en` and `zh-HK` (a test enforces this).

## Licence

By contributing you agree that your contribution is licensed under
AGPL-3.0-or-later.
