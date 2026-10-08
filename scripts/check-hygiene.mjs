#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Repository hygiene gate for Sumstair:
//  - required notice files and README statements exist;
//  - the web UI never loads anything from another origin (no CDN, fonts, analytics);
//  - competitor product names never appear in UI or explanation strings (no branding);
//  - the AGPL section 13 "source" link and the CSP stay in the page.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(f));

const problems = [];
const read = (f) => readFileSync(f, 'utf8');

for (const required of [
  'LICENSE',
  'NOTICE',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/wrong-answer.yml',
]) {
  if (!existsSync(required)) problems.push(`missing required file: ${required}`);
}

if (existsSync('LICENSE') && !read('LICENSE').includes('GNU AFFERO GENERAL PUBLIC LICENSE'))
  problems.push('LICENSE is not the AGPL text');

if (existsSync('README.md')) {
  const readme = read('README.md');
  const needles = {
    'https://buymeacoffee.com/kinfxhk': 'Buy Me a Coffee link',
    'https://github.com/Kinfxhk/sumstair': 'repository link',
    'educational tool': 'English educational disclaimer',
    verify: 'advice to verify answers',
    教育用途: 'Chinese educational disclaimer',
    'not affiliated': 'not-affiliated statement',
    '## Commitments': 'public commitments section (no ads, tracking or paid steps)',
    'AI coding agents': 'honest statement of how the project is made',
  };
  for (const [needle, what] of Object.entries(needles))
    if (!readme.includes(needle)) problems.push(`README.md lacks the ${what} ("${needle}")`);
}
if (existsSync('THIRD_PARTY_NOTICES.md') && !read('THIRD_PARTY_NOTICES.md').includes('KaTeX'))
  problems.push('THIRD_PARTY_NOTICES.md lacks the KaTeX entry');

// --- No competitor names as branding in UI / explanation strings. -------------------------
const COMPETITORS =
  /symbolab|mathway|photomath|wolfram|socratic|mathpapa|cymath|mathsteps|gauthmath|quickmath/i;
const UI_FILES = files.filter(
  (f) =>
    /^packages\/(web|core)\/(src|public)\//.test(f) ||
    f === 'packages/web/index.html' ||
    /^packages\/web\/public\/manifest/.test(f),
);
for (const f of UI_FILES) {
  if (/\/licenses\//.test(f)) continue;
  if (!/\.(ts|html|css|json|webmanifest|svg)$/.test(f)) continue;
  const m = read(f).match(COMPETITORS);
  if (m) problems.push(`${f}: competitor name "${m[0]}" must not appear in UI/engine strings`);
}

// --- The web UI must not load third-party resources. ---------------------------------------
const ALLOWED_LINKS = [
  'https://github.com/Kinfxhk/sumstair',
  'https://buymeacoffee.com/kinfxhk',
  'https://www.gnu.org/licenses/',
];
const WEB_FILES = files.filter(
  (f) => /^packages\/web\/(src|public)\//.test(f) || f === 'packages/web/index.html',
);
for (const f of WEB_FILES) {
  if (/\/licenses\//.test(f) || !/\.(ts|html|css|json|webmanifest|js)$/.test(f)) continue;
  const text = read(f);
  for (const m of text.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) {
    const url = m[0];
    if (url.startsWith('http://www.w3.org/')) continue; // XML namespaces (SVG/MathML), not loads
    if (!ALLOWED_LINKS.some((a) => url.startsWith(a)))
      problems.push(`${f}: external URL not allowed in the web UI: ${url}`);
  }
  if (/(src|srcset)\s*=\s*["']https?:/i.test(text) || /url\(\s*["']?https?:/i.test(text))
    problems.push(`${f}: loads a resource from another origin`);
}

const PAGE = 'packages/web/index.html';
if (existsSync(PAGE)) {
  const html = read(PAGE);
  if (!/http-equiv="Content-Security-Policy"[^>]*default-src 'self'/s.test(html))
    problems.push(`${PAGE}: missing CSP meta with default-src 'self'`);
  if (!html.includes('id="source-link"'))
    problems.push(`${PAGE}: missing footer source link (AGPL section 13)`);
}

if (problems.length) {
  console.error('Repository hygiene check FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.info(`Repository hygiene check passed (${files.length} files).`);
