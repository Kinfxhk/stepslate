// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { MESSAGES, solve } from '@stepslate/core';
import { ruleKey, UI } from '../src/i18n';
import { MAX_TRANSCRIPT, REPORT_TEMPLATE, reportUrl } from '../src/report';
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

describe('report a wrong answer link', () => {
  const repo = 'https://github.com/example/repo';
  it('pre-fills the issue form with the problem, the shown steps and the version', () => {
    const url = new URL(reportUrl(repo, 'v9.9.9', solve('2(x+3)=5x-4')));
    expect(`${url.origin}${url.pathname}`).toBe(`${repo}/issues/new`);
    const p = url.searchParams;
    expect(p.get('template')).toBe(REPORT_TEMPLATE);
    expect(p.get('title')).toBe('Wrong answer: 2(x+3)=5x-4');
    expect(p.get('problem')).toBe('2(x+3)=5x-4');
    expect(p.get('version')).toBe('v9.9.9');
    expect(p.get('shown')).toContain('x = 10/3');
  });
  it('stays short enough for browsers and GitHub even for long solutions', () => {
    const long = '(2x+3)(x-1)+(2x+3)(x-1)+(2x+3)(x-1)+(x+1)^2-(x-2)(x+5)';
    const url = reportUrl(repo, 'v1.0.0', solve(long));
    expect(url.length).toBeLessThan(8000);
    expect(new URL(url).searchParams.get('shown')!.length).toBeLessThanOrEqual(MAX_TRANSCRIPT);
  });
  it('only builds a link (no network, no storage)', () => {
    const url = reportUrl(repo, 'v1', solve('1+1'));
    expect(url.startsWith(`${repo}/issues/new?`)).toBe(true);
  });
});
