// SPDX-License-Identifier: AGPL-3.0-or-later
// Command line: print verified steps as plain text.
//   npm run solve -- "2(x+3)=5x-4"          (English)
//   npm run solve -- --lang zh-HK "1/2+3/4"
import { solutionText, solve, type Lang } from '@stepslate/core';

const args = process.argv.slice(2);
let lang: Lang = 'en';
const li = args.indexOf('--lang');
if (li >= 0) {
  const v = args[li + 1];
  if (v !== 'en' && v !== 'zh-HK') {
    console.error('--lang must be en or zh-HK');
    process.exit(2);
  }
  lang = v;
  args.splice(li, 2);
}
const input = args.join(' ');
if (!input) {
  console.error('usage: npm run solve -- [--lang en|zh-HK] "<problem>"');
  process.exit(2);
}
const sol = solve(input);
console.info(solutionText(sol, lang));
process.exit(sol.status === 'solved' ? 0 : 1);
