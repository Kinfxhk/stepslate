// Prints release notes for one version, taken from CHANGELOG.md.
// Usage: node scripts/release-notes.mjs [version]   (default: root package.json version)
import { readFileSync, existsSync } from 'node:fs';

const version = process.argv[2] ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const start = changelog.indexOf(`## [${version}]`);
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const rest = changelog.slice(start);
const next = rest.slice(1).search(/^## \[|^\[[^\]]+\]: /m);
const body = (next < 0 ? rest : rest.slice(0, next + 1)).split('\n').slice(1).join('\n').trim();

const lines = [body, ''];
const sumFile = `release/sumstair-site-v${version}.zip.sha256`;
if (existsSync(sumFile)) {
  lines.push(
    '### Static site download',
    '',
    'SHA-256:',
    '',
    '```',
    readFileSync(sumFile, 'utf8').trim(),
    '```',
    '',
  );
}
lines.push(
  '### Please note',
  '',
  'Sumstair is an educational tool. Every displayed step is checked by an exact verifier, but software can have bugs: verify important answers yourself.',
  'Sumstair is an independent project and is not affiliated with any other maths app, publisher or exam board.',
  '',
  'If Sumstair helps you, you can support it at https://buymeacoffee.com/kinfxhk',
);
process.stdout.write(lines.join('\n') + '\n');
