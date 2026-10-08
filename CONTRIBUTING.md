# Contributing to StepSlate

Thank you for helping. StepSlate exists so that every student can see full
worked solutions for free, offline and without an account. Correctness and legal
cleanliness matter as much as features.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Questions
and ideas go to [Discussions](https://github.com/Kinfxhk/stepslate/discussions);
wrong answers, topic requests and translations have their own issue forms.

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
   licence. Do not paste snippets of unknown origin, for example from Q&A sites.
   AI-assisted work is allowed only under the policy below.

## AI-assisted development

**How this project is made:** StepSlate is written with AI coding agents working
under the maintainer's direction. Most of the code, tests and documentation in
this repository were drafted that way and then checked by the same gates that
apply to every contribution: the clean-room rules above, the independent
verifier, golden, property and mutation tests, the licence allowlist, the
hygiene check and the secret scan. We say this openly because a policy that
pretended otherwise would be useless.

You may use AI tools for your contribution too, on these conditions:

1. **Review it yourself.** Read every line you submit and be able to explain why
   it is correct. You are responsible for it exactly as if you had typed it. Check
   golden-test expectations by hand; do not let a tool write both a rule and the
   expected answers without your own check.
2. **No reproduction of other work.** Do not ask an AI tool to reproduce,
   translate or paraphrase code, explanation text, UI, problem sets or
   screenshots from other solvers, textbooks or exam papers, and do not paste such
   material into prompts. If a tool tells you its output matches existing code
   (or shows a licence or attribution), do not use that output.
3. **DCO covers all of it.** Your sign-off (below) certifies that you have the
   right to submit the whole contribution, including AI-assisted parts.
4. **Disclose it.** Say in the pull request which AI tools you used and for what.
   The pull request template asks for this. Disclosure is not a mark against a
   contribution; it helps reviewers know where to look harder.
5. **The gates do not move.** AI-assisted or not, every rule needs golden,
   property and mutation tests, and the verifier is never weakened.

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
