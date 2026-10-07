// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { en, MESSAGES, t, zhHK } from '../src/index';

describe('i18n', () => {
  it('both languages define exactly the same keys', () => {
    expect(Object.keys(zhHK).sort()).toEqual(Object.keys(en).sort());
  });
  it('placeholders match between languages', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(ph(zhHK[k]), k).toEqual(ph(en[k]));
    }
  });
  it('no empty strings', () => {
    for (const lang of Object.values(MESSAGES))
      for (const [k, s] of Object.entries(lang)) expect(s.trim(), k).not.toBe('');
  });
  it('formats parameters', () => {
    expect(t('en', 'parse.too-long', { max: 200 })).toContain('200');
    expect(t('zh-HK', 'parse.too-long', { max: 200 })).toContain('200');
  });
});
