// SPDX-License-Identifier: AGPL-3.0-or-later
// StepSlate web entry: settings, language, views, offline support.

import './styles.css';
import type { Lang } from '@stepslate/core';
import { UI, ui, type UiKey } from './i18n';
import { loadSettings, saveSettings } from './settings';
import { SolveView } from './solve-view';
import { PracticeView, questionFromHash } from './practice-view';

const settings = loadSettings();
const solveView = new SolveView();
const practiceView = new PracticeView();

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
  document.title = lang === 'zh-HK' ? '步步解 · StepSlate' : 'StepSlate · 步步解';
}

function applySettings(): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.large = settings.large ? 'true' : 'false';
  document
    .getElementById('theme-toggle')!
    .setAttribute('aria-pressed', String(settings.theme === 'dark'));
  document.getElementById('large-toggle')!.setAttribute('aria-pressed', String(settings.large));
  applyI18n(settings.lang);
  solveView.setLang(settings.lang);
  practiceView.setLang(settings.lang);
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
