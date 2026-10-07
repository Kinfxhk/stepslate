// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@stepslate/core';
import { ruleKey, UI } from '../src/i18n';
import { problemFromHash, hashForProblem } from '../src/share';

describe('web UI strings', () => {
  it('English and Chinese have exactly the same keys', () => {
    expect(Object.keys(UI['zh-HK']).sort()).toEqual(Object.keys(UI.en).sort());
  });
  it('no string is empty and placeholders match', () => {
    for (const key of Object.keys(UI.en) as (keyof typeof UI.en)[]) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(UI.en[key].trim(), key).not.toBe('');
      expect(UI['zh-HK'][key].trim(), key).not.toBe('');
      expect(ph(UI['zh-HK'][key]), key).toEqual(ph(UI.en[key]));
    }
  });
  it('every explanation key has a step heading', () => {
    for (const key of Object.keys(MESSAGES.en)) expect(UI.en[ruleKey(key)]).toBeTruthy();
  });
});

describe('share links', () => {
  it('round-trips problems through the URL fragment', () => {
    for (const q of ['2(x+3)=5x-4', 'x^2-5x+6=0', '2x+y=7; x-y=2', '½ + ¾', '1/2 x'])
      expect(problemFromHash(hashForProblem(q))).toBe(q);
  });
  it('ignores malformed or oversized fragments', () => {
    expect(problemFromHash('#q=%E0%A4%A')).toBeUndefined();
    expect(problemFromHash('#other')).toBeUndefined();
    expect(problemFromHash('#q=' + 'x'.repeat(201))).toBeUndefined();
  });
});
