// SPDX-License-Identifier: AGPL-3.0-or-later
// Practice mode (filled in by M7).

import type { Lang } from '@stepslate/core';
import { ui } from './i18n';

export class PracticeView {
  private lang: Lang = 'en';
  setLang(lang: Lang): void {
    this.lang = lang;
    this.render();
  }
  show(): void {
    this.render();
  }
  private render(): void {
    const root = document.getElementById('practice-root')!;
    root.replaceChildren();
    const p = document.createElement('p');
    p.textContent = ui(this.lang, 'practice.intro');
    root.append(p);
  }
}
