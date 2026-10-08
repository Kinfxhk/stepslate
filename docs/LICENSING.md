# Licensing decisions

## Project licence: AGPL-3.0-or-later

Chosen so that anyone who modifies StepSlate and offers it to others as a hosted
(network) service must publish their source code under the same licence. This
keeps worked solutions free and makes it hard to wrap StepSlate into a closed,
paid "unlock the steps" subscription, which is the opposite of the project's
goal.

- `LICENSE` is the unmodified text from https://www.gnu.org/licenses/agpl-3.0.txt
  (fetched 2026-10-08, 661 lines, SHA-256
  `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`).
- Every source file carries `SPDX-License-Identifier: AGPL-3.0-or-later`.
- **AGPL section 13:** the page footer always links to the source code
  of the exact version: at build time `packages/web/vite.config.ts` sets the
  footer link to `<repository>/tree/v<version>` (repository URL and version from
  the root `package.json`) and shows the version next to it; an e2e test checks
  this. The GitHub Pages demo and anyone's self-hosted copy therefore offer the
  Corresponding Source by default. If you deploy a modified version, change the
  `repository` URL in `package.json` (or the link) to point at your modified
  source.

## Compatibility of dependencies

| Licence                        | Compatible with AGPLv3?                                    | Source                                  |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------------- |
| MIT (KaTeX, incl. its fonts)   | Yes                                                        | FSF licence list (lax permissive)       |
| MIT, ISC, BSD-2/3-Clause, 0BSD | Yes                                                        | FSF licence list                        |
| Apache-2.0                     | Yes (one-way)                                              | FSF licence list; ASF GPL page          |
| MPL-2.0 (dev tooling only)     | Yes (unless marked "Incompatible With Secondary Licenses") | FSF licence list; MPL-2.0 §3.3          |
| GPL-2.0-only                   | **No**                                                     | Blocked by `scripts/check-licenses.mjs` |

The enforced allowlist lives in `scripts/check-licenses.mjs`.

## Contributions

Contributions are accepted under AGPL-3.0-or-later with a Developer Certificate of
Origin sign-off (`git commit -s`). See `CONTRIBUTING.md`.

_This document is an engineering record, not legal advice._
