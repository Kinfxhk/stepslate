// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(here, 'public');
const rootPkg = JSON.parse(readFileSync(join(here, '../../package.json'), 'utf8')) as {
  version: string;
  homepage: string;
  repository: { url: string };
};

/**
 * AGPL section 13: point the footer "Source code" link at the exact version tag
 * (for example https://github.com/<owner>/<repo>/tree/v0.1.0) and show the version.
 * Also make the link-preview (Open Graph / Twitter) URLs absolute.
 */
function sourceLink(): Plugin {
  const tag = `v${rootPkg.version}`;
  const url = `${rootPkg.repository.url.replace(/\.git$/, '')}/tree/${tag}`;
  return {
    name: 'stepslate-source-link',
    transformIndexHtml(html) {
      const linked = html.replace(/(id="source-link"\s+href=")[^"]*(")/, `$1${url}$2`);
      const versioned = linked.replace(
        /<span id="app-version"([^>]*)>[^<]*<\/span>/,
        `<span id="app-version"$1>${tag}</span>`,
      );
      if (!linked.includes(url) || !versioned.includes(`>${tag}<`))
        throw new Error('index.html: could not inject the source link / version');
      // Link-preview crawlers need absolute URLs; the image itself is served by the site.
      const home = rootPkg.homepage.endsWith('/') ? rootPkg.homepage : `${rootPkg.homepage}/`;
      let previews = 0;
      const out = versioned.replace(
        /(<meta (?:property|name)="(?:og|twitter):(?:url|image)" content=")\.\/([^"]*")/g,
        (_m, head: string, rest: string) => {
          previews++;
          return `${head}${home}${rest}`;
        },
      );
      if (previews !== 3) throw new Error('index.html: expected og:url, og:image, twitter:image');
      return out;
    },
  };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/**
 * KaTeX font families that StepSlate's output actually uses (numbers, italic letters,
 * brackets, fractions, roots, ±, Δ). Measured by rendering every golden problem and the
 * practice view; the e2e test "every KaTeX font the solver uses is pre-cached" keeps
 * this list honest. Other families stay in the build and load on demand when online.
 */
const KATEX_FONTS_USED = /KaTeX_(Main-Regular|Math-Italic|Size[1-4]-Regular)-/;

/**
 * Files that are built but not pre-cached for offline use:
 * - KaTeX's .ttf and .woff fonts: every browser that can run the service worker uses
 *   the .woff2 files (listed first in KaTeX's CSS), so the older formats would only
 *   triple the download for students on mobile data;
 * - .woff2 families that StepSlate never uses (see KATEX_FONTS_USED);
 * - the social preview image, which only link-preview crawlers fetch.
 */
function precached(file: string): boolean {
  if (/\.(ttf|woff)$/.test(file)) return false;
  if (file.endsWith('.woff2')) return KATEX_FONTS_USED.test(file);
  return file !== 'social-card.png';
}

/**
 * Offline support without extra dependencies: after the build, emit a small service worker
 * that pre-caches the site (same origin only) and the root licence text.
 */
function offline(): Plugin {
  return {
    name: 'stepslate-offline',
    apply: 'build',
    generateBundle(_opts, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/StepSlate-LICENSE.txt',
        source: readFileSync(join(here, '../../LICENSE'), 'utf8'),
      });
      const files = [
        ...Object.keys(bundle),
        'licenses/StepSlate-LICENSE.txt',
        ...listFiles(publicDir).map((p) => relative(publicDir, p).split('\\').join('/')),
      ]
        .filter((f) => !f.endsWith('.map') && precached(f))
        .sort();
      const unique = [...new Set(files)];
      const hash = createHash('sha256');
      for (const f of unique) {
        hash.update(f);
        const item = bundle[f];
        if (item) hash.update(item.type === 'chunk' ? item.code : String(item.source));
      }
      const version = hash.digest('hex').slice(0, 16);
      const urls = ['./', ...unique.map((f) => `./${f}`)];
      const sw = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Generated at build time: pre-caches the whole site so it works offline.
const CACHE = 'stepslate-${version}';
const URLS = ${JSON.stringify(urls)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('stepslate-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).catch(() =>
          req.mode === 'navigate' ? caches.match('./index.html') : Response.error(),
        ),
    ),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  root: here,
  base: './',
  plugins: [sourceLink(), offline()],
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { host: '127.0.0.1', port: 4874, strictPort: true },
  preview: { host: '127.0.0.1', port: 4875 },
});
