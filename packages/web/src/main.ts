// SPDX-License-Identifier: AGPL-3.0-or-later
// Sumstair web entry: settings, language, views, offline support.

import './styles.css';
import type { Lang } from '@sumstair/core';
import { dismissBackup, downloadBackup, loadBackup, noteActivity, shouldRemind } from './backup';
import { UI, ui, type UiKey } from './i18n';
import { PracticeView, questionFromHash } from './practice-view';
import { loadSettings, saveSettings } from './settings';
import { SolveView } from './solve-view';

const settings = loadSettings();
const solveView = new SolveView();
const practiceView = new PracticeView();
let storageKind: 'persisted' | 'denied' | 'unsupported' = 'unsupported';

function paintStorage(): void {
  const el = document.getElementById('storage-status');
  if (el) el.textContent = ui(settings.lang, `storage.${storageKind}`);
}

function paintBackup(): void {
  const el = document.getElementById('backup-reminder');
  if (el) el.hidden = !shouldRemind(loadBackup(), Date.now());
}

function applyI18n(lang: Lang): void {
  document.documentElement.lang = lang === 'zh-HK' ? 'zh-Hant-HK' : 'en';
  const dict = UI[lang];
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]'))
    el.textContent = dict[el.dataset.i18n as UiKey] ?? el.textContent;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]'))
    el.setAttribute('aria-label', dict[el.dataset.i18nAria as UiKey] ?? '');
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]'))
    el.placeholder = dict[el.dataset.i18nPlaceholder as UiKey] ?? el.placeholder;
  const toggle = document.getElementById('lang-toggle')!;
  toggle.textContent = ui(lang, 'settings.lang');
  toggle.setAttribute('lang', lang === 'en' ? 'zh-Hant' : 'en');
  document.title = lang === 'zh-HK' ? '步步解 · Sumstair' : 'Sumstair · 步步解';
  paintStorage();
}

function applySettings(): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.large = settings.large ? 'true' : 'false';
  document
    .getElementById('theme-toggle')!
    .setAttribute('aria-pressed', String(settings.theme === 'dark'));
  document.getElementById('large-toggle')!.setAttribute('aria-pressed', String(settings.large));
  const square = document.getElementById('square-method') as HTMLInputElement | null;
  if (square) square.checked = settings.square;
  applyI18n(settings.lang);
  solveView.setLang(settings.lang);
  solveView.setSquare(settings.square);
  practiceView.setLang(settings.lang);
  paintBackup();
  saveSettings(settings);
}

document.getElementById('lang-toggle')!.addEventListener('click', () => {
  settings.lang = settings.lang === 'en' ? 'zh-HK' : 'en';
  applySettings();
});
document.getElementById('theme-toggle')!.addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applySettings();
});
document.getElementById('large-toggle')!.addEventListener('click', () => {
  settings.large = !settings.large;
  applySettings();
});
document.getElementById('square-method')!.addEventListener('change', () => {
  settings.square = (document.getElementById('square-method') as HTMLInputElement).checked;
  saveSettings(settings);
  noteActivity();
  solveView.setSquare(settings.square);
});
document.getElementById('backup-save')!.addEventListener('click', () => {
  downloadBackup();
  paintBackup();
});
document.getElementById('backup-dismiss')!.addEventListener('click', () => {
  dismissBackup();
  paintBackup();
});
window.addEventListener('sumstair-storage', paintBackup);

function showView(name: string): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('nav.tabs button')) {
    if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  for (const v of document.querySelectorAll<HTMLElement>('main > .view')) {
    const on = v.id === `view-${name}`;
    v.hidden = !on;
    v.classList.toggle('active', on);
  }
  if (name === 'practice') practiceView.show();
}
for (const b of document.querySelectorAll<HTMLButtonElement>('nav.tabs button'))
  b.addEventListener('click', () => showView(b.dataset.view ?? 'solve'));

applySettings();

async function rememberStorage(): Promise<void> {
  try {
    const nav = navigator.storage;
    if (!nav?.persist) storageKind = 'unsupported';
    else {
      const already = (await nav.persisted?.()) ?? false;
      storageKind = already || (await nav.persist()) ? 'persisted' : 'denied';
    }
  } catch {
    storageKind = 'unsupported';
  }
  paintStorage();
}
void rememberStorage();

const practiceLink = questionFromHash(location.hash);
if (practiceLink) {
  practiceView.open(practiceLink.type, practiceLink.level, practiceLink.seed);
  showView('practice');
  solveView.refresh();
} else if (!solveView.loadFromHash()) solveView.refresh();

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline support is optional; the app works without it
    });
  });
}
