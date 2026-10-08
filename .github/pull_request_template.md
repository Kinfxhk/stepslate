<!-- Thank you! Please fill in every section; delete hints in brackets. -->

## What and why

[What does this change and which issue does it address?]

## Checklist

- [ ] `npm run check` passes (lint, format, typecheck, tests, licences, hygiene, secret scan).
- [ ] UI changes: `npm run test:e2e` passes.
- [ ] **Verifier:** every new or changed step is accepted by the independent verifier in
      `packages/core/src/verify/`, and the verifier was **not** weakened.
- [ ] **Golden tests:** expected steps added or updated, and I checked the expected answers by hand.
- [ ] **Property tests:** random inputs (fast-check) produce only verified steps and the right answer.
- [ ] **Mutation test:** a deliberately broken version of each new rule is rejected by the verifier.
- [ ] New explanation strings exist in both `en` and `zh-HK`.
- [ ] **Clean room:** no code, text, UI, screenshots or problems copied from other solvers,
      textbooks or exam papers (CONTRIBUTING.md).
- [ ] Commits are signed off (`git commit -s`, DCO).

## AI assistance

- [ ] I did not use AI tools for this change.
- [ ] I used AI tools: [which tools, and for what]. I reviewed every line and can explain it,
      and I did not ask the tool to reproduce other projects' code or text.
