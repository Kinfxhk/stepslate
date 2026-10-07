# StepSlate (步步解)

**StepSlate** is a free, open-source, offline **step-by-step maths solver** for
secondary-school algebra. Type a problem and see every step with a short
explanation, in English or Traditional Chinese. **Every step is checked by an
independent exact verifier before it is shown**; a step that cannot be verified
is never displayed. No account, no ads, no tracking, no subscription.

![StepSlate solving x² − 4x + 1 = 0 step by step](docs/screenshot.png)

- Try it online (GitHub Pages): <https://kinfxhk.github.io/stepslate/>
- Repository: <https://github.com/Kinfxhk/stepslate>
- Licence: [AGPL-3.0-or-later](LICENSE)
- Support the project: <https://buymeacoffee.com/kinfxhk>

## Disclaimer

StepSlate is an **educational tool** for learning and for checking your own
work. Each step is machine-verified with exact arithmetic, but software can
still contain bugs: **verify important answers yourself**, and do not use
StepSlate to cheat in tests or exams. It is not a substitute for a teacher.

StepSlate is an independent project and is **not affiliated with, endorsed by,
or sponsored by** any other maths-solver product, company, publisher or exam
board.

## What it solves (v0.1)

| Type                                                  | Examples                                            | How                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Arithmetic with fractions, decimals, powers           | `1/2 + 3/4 * 2`, `(2/3)^2 - 0.25`                   | one operation at a time, exact fractions                                                                                                    |
| Simplifying polynomials (up to 2 letters, degree ≤ 4) | `3(2x - 1) - (x + 4)`, `(x + 2)^2 - (x - 1)(x + 3)` | expand, remove brackets, collect like terms                                                                                                 |
| Linear equations                                      | `2(x + 3) = 5x - 4`, `x/3 + 1 = x/2`                | clear fractions, move terms, divide, check                                                                                                  |
| Quadratic equations                                   | `x^2 - 5x + 6 = 0`, `x^2 - 4x + 1 = 0`, `3x^2 = 5`  | factorise when the roots are rational, otherwise the quadratic formula with exact square roots; "no real roots" when Δ < 0; check each root |
| Two simultaneous linear equations                     | `2x + y = 7; x - y = 2`                             | elimination, back substitution, check; detects no / infinitely many solutions                                                               |

Other features: an **"I read this as"** preview (and a warning for ambiguous
input such as `1/2x`), step-by-step reveal or show all, highlighting of what
changed, a check step that substitutes the answer back into the original
equation, **practice mode** (generated questions, answers accepted in any
equivalent form, step hints, progress kept only in your browser), dark/light
theme, large text, keyboard operation, MathML for screen readers, print styles,
share links (the problem is stored after `#`, which browsers never send to a
server) and **offline use** after the first visit.

Input limits keep the browser responsive: at most 200 characters, 9-digit
numbers, 6 decimal places, exponents up to 4.

## How the checking works

The step engine (`packages/core/src/rules`, `solve`) proposes each step. A
separate verifier (`packages/core/src/verify`, which never imports the rules)
must accept it before it is recorded:

- arithmetic: both sides are evaluated with exact rational numbers;
- expressions: polynomial identity, checked exactly on a grid of points large
  enough for the degree;
- equations: the new equation must be a non-zero constant multiple of the old one
  (rearranging, clearing fractions, dividing) **and** have the same solution set,
  found by a direct exact solver (rationals and square roots);
- simultaneous equations: a row-operation matrix with non-zero determinant is
  attached to each step and checked coefficient by coefficient, plus the solution
  set;
- check steps: the substitution and every displayed value are recomputed.

If the verifier rejects a step, StepSlate stops and says so instead of showing
it. Property-based tests (fast-check) and mutation tests (deliberately broken
steps must be rejected) cover the engine.

## Use it

- **Online:** a GitHub Pages build will be linked from the repository once it is
  published.
- **Offline / self-hosted:** download `stepslate-site-v0.1.0.zip` from the
  release, unzip, and serve the folder with any static server on localhost.
- **Docker:**

  ```sh
  docker build -t stepslate .
  docker run --rm -p 127.0.0.1:4873:4873 stepslate
  # open http://127.0.0.1:4873/
  ```

- **From source** (Node.js 22 or later):

  ```sh
  git clone https://github.com/Kinfxhk/stepslate.git
  cd stepslate
  npm ci
  npm start            # builds and serves on http://127.0.0.1:4873/
  npm run solve -- "x^2-5x+6=0"            # plain-text steps in the terminal
  npm run solve -- --lang zh-HK "2x+3=7"
  ```

## Privacy

The app makes **no network requests** of its own: no analytics, fonts or CDNs
(enforced by a Content-Security-Policy of `default-src 'self'` and by tests).
Settings and practice progress are stored only in your browser's localStorage;
practice mode has a button to clear progress. If you use the GitHub Pages copy,
GitHub hosts the files and may keep its own access logs; self-host or use the
offline zip to avoid that.

## Development

```sh
npm ci
npm run dev          # Vite dev server on http://127.0.0.1:4874/
npm run check        # lint, format, typecheck, unit/property/golden tests,
                     # licence allowlist, repository hygiene, secret scan (gitleaks)
PW_CHROMIUM_PATH=/usr/bin/google-chrome npm run test:e2e   # browser tests
npm run package:site # release/stepslate-site-v<version>.zip
```

Layout: `packages/core` (exact numbers, parser, step rules, verifier, practice
generators; zero runtime dependencies), `packages/web` (Vite + TypeScript UI,
KaTeX), `packages/cli` (terminal solver and a loopback static server).

Contributions are welcome under the rules in [CONTRIBUTING.md](CONTRIBUTING.md):
clean-room work only (no code, text or screenshots from other solvers), every
new rule must pass the verifier, and commits are signed off (DCO).

## Licence

StepSlate is free software: you can redistribute it and/or modify it under the
terms of the GNU Affero General Public License, version 3 or (at your option)
any later version. If you run a modified version for other people over a
network, you must offer them its source code (the footer "Source code" link
does this for the original). Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (KaTeX, MIT).

---

## 繁體中文

**步步解（StepSlate）** 是一個免費、開源、可離線使用的**數學逐步解題器**，適用於中學代數。
輸入題目，即可看到每一步及簡短解釋（繁體中文或英文）。
**每一步在顯示前都會經獨立的精確驗證器檢查**；未能驗證的步驟一律不會顯示。
毋須帳戶，沒有廣告、追蹤或訂閱。

### 免責聲明

步步解屬**教育用途**工具，用於學習及核對自己的答案。每一步雖經精確運算自動驗證，
但軟件仍可能有錯漏：**重要答案請自行核對**，亦請勿用於測驗或考試作弊。本工具不能取代老師。

步步解是獨立項目，與任何其他解題產品、公司、出版社或考評機構**均無關連**，
亦未獲其認可或贊助（not affiliated）。

### 功能（v0.1）

- 四則運算（分數、小數、指數）、化簡多項式（最多兩個字母、最高四次）、一元一次方程、
  一元二次方程（有理根時因式分解，否則用二次公式並以根式精確表示；Δ < 0 時無實根）、
  二元一次聯立方程（消元法；可判斷無解或無限多解）。
- 「我理解為」預覽（遇到 `1/2x` 一類有歧義的寫法會提示）、逐步顯示或顯示全部、
  高亮變動部分、方程題最後一步把答案代回原式驗算。
- 練習模式：程式生成題目，接受任何等價寫法（例如 `0.5` 與 `1/2`），可逐步提示；
  進度只儲存在瀏覽器，可一鍵清除。
- 深淺色、大字、鍵盤操作、供讀屏軟件使用的 MathML、列印樣式、網址分享
  （題目放在 `#` 之後，不會傳送到伺服器）、首次載入後可離線使用。

### 使用方法

- 自架／離線：下載 release 中的 `stepslate-site-v0.1.0.zip`，解壓後以任何靜態伺服器在本機提供。
- Docker：`docker build -t stepslate .`，再 `docker run --rm -p 127.0.0.1:4873:4873 stepslate`。
- 原始碼（Node.js 22 或以上）：`npm ci`，然後 `npm start`，開啟 <http://127.0.0.1:4873/>。

### 私隱

程式本身不會發出任何網絡請求（沒有分析工具、外部字型或 CDN，並以 CSP `default-src 'self'`
及自動測試強制）。設定及練習進度只儲存在瀏覽器的 localStorage。
若使用 GitHub Pages 版本，檔案由 GitHub 託管，GitHub 或會保留其存取紀錄；
如不希望這樣，可自架或使用離線壓縮檔。

### 授權

本軟件以 GNU Affero 通用公共授權條款第 3 版或（由你選擇）任何較新版本發佈
（AGPL-3.0-or-later）。如你修改後透過網絡提供予他人使用，須向使用者提供相應原始碼。
第三方元件見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

- 網上版（GitHub Pages）：<https://kinfxhk.github.io/stepslate/>
- 原始碼：<https://github.com/Kinfxhk/stepslate>
- 支持項目：<https://buymeacoffee.com/kinfxhk>
