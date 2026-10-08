# Third-party notices

Sumstair is licensed under AGPL-3.0-or-later. The core engine
(`packages/core`) has **no runtime dependencies**: the exact rational and surd
arithmetic, parser, step rules and verifier are original code written for this
project. The browser UI uses the third-party components below. The full
dependency list with licences is produced by `npm run check:licenses`, which also
enforces an AGPL-3.0-compatible allowlist in CI.

## Runtime dependencies (shipped in the web UI)

| Package | Licence | Notes                                     |
| ------- | ------- | ----------------------------------------- |
| KaTeX   | MIT     | Maths typesetting (HTML + MathML output). |

## KaTeX

- Project: <https://github.com/KaTeX/KaTeX> (npm package `katex`).
- Licence: MIT. `Copyright (c) 2013-2020 Khan Academy and other contributors`.
  The full licence text is shipped with the UI at `licenses/katex-LICENSE.txt`.
- **Fonts.** The KaTeX npm package bundles the KaTeX font files
  (`dist/fonts/KaTeX_*.woff2` etc.), which Sumstair serves from its own origin
  (never from a CDN). Licence check (2026-10-08):
  - The KaTeX repository's root `LICENSE` (MIT, quoted above) covers the
    repository, which contains the same font files under `fonts/`.
  - The font sources live in <https://github.com/KaTeX/katex-fonts>, whose
    `LICENSE` file is also the MIT licence (`Copyright (c) 2018 Khan Academy`).
  - The katex-fonts README says font generation was "Originally based on MathJax
    font generation". The licence of any upstream glyph sources beyond what the
    KaTeX projects state in their own `LICENSE` files is **not independently
    verified** (未能核實); we rely on the MIT licence files published by KaTeX.

## Development-only tools (not shipped)

Vite, Vitest, fast-check, Playwright, axe-core (`@axe-core/playwright`,
MPL-2.0), ESLint, Prettier, TypeScript and tsx are used only to build and test
Sumstair. MPL-2.0 is accepted for development tooling only.
