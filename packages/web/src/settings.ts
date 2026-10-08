// SPDX-License-Identifier: AGPL-3.0-or-later
// Display settings, stored only in this browser.

import type { Lang } from '@sumstair/core';

export interface Settings {
  lang: Lang;
  theme: 'light' | 'dark';
  large: boolean;
}

const KEY = 'sumstair.settings.v1';

function defaults(): Settings {
  const zh = (navigator.languages ?? [navigator.language]).some((l) => /^zh/i.test(l));
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return { lang: zh ? 'zh-HK' : 'en', theme: dark ? 'dark' : 'light', large: false };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      lang: s.lang === 'en' || s.lang === 'zh-HK' ? s.lang : base.lang,
      theme: s.theme === 'dark' || s.theme === 'light' ? s.theme : base.theme,
      large: typeof s.large === 'boolean' ? s.large : base.large,
    };
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage may be disabled; settings then last for this visit only
  }
}
