// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  constantMultiple,
  identical,
  parseExpr,
  parseProblem,
  problemVariables,
  Rational,
  solutionSet1,
  univariateCoefficients,
  verifyStep,
  type Problem,
  type State,
  type Step,
} from '../src/index';

const E = (s: string): State => ({ kind: 'expr', expr: parseExpr(s) });
const step = (before: State, after: State, extra: Partial<Step> = {}): Step => ({
  before,
  after,
  rule: 'test',
  explain: { key: 'arith.add' },
  ...extra,
});
const ctxFor = (input: string) => {
  const problem = parseProblem(input).problem as Problem;
  return { problem, vars: problemVariables(problem) };
};

describe('verifier: values and identities', () => {
  it('accepts equal values and rejects changed values', () => {
    const ctx = ctxFor('1/2+1/4');
    expect(verifyStep(step(E('1/2+1/4'), E('2/4+1/4')), ctx).ok).toBe(true);
    expect(verifyStep(step(E('1/2+1/4'), E('2/6')), ctx).ok).toBe(false);
  });
  it('rejects division by zero instead of throwing', () => {
    const ctx = ctxFor('1+1');
    const r = verifyStep(step(E('1+1'), E('2/0*0+2')), ctx);
    expect(r.ok).toBe(false);
  });
  it('decides polynomial identities exactly', () => {
    expect(identical(parseExpr('(x+1)^2'), parseExpr('x^2+2x+1'), ['x'])).toBe(true);
    expect(identical(parseExpr('(x+1)^2'), parseExpr('x^2+1'), ['x'])).toBe(false);
    // differs only at a point outside 0..d would still be caught: degree bound is exact
    expect(identical(parseExpr('x(x-1)(x-2)'), parseExpr('0'), ['x'])).toBe(false);
    expect(identical(parseExpr('(x+y)^2'), parseExpr('x^2+2xy+y^2'), ['x', 'y'])).toBe(true);
    expect(identical(parseExpr('(x+y)^2'), parseExpr('x^2+y^2'), ['x', 'y'])).toBe(false);
  });
  it('finds constant multiples', () => {
    expect(constantMultiple(parseExpr('6x-12'), parseExpr('x-2'), ['x'])?.toString()).toBe('6');
    expect(constantMultiple(parseExpr('x^2-4'), parseExpr('x-2'), ['x'])).toBeUndefined();
    expect(constantMultiple(parseExpr('0*x'), parseExpr('x-2'), ['x'])).toBeUndefined();
  });
  it('extracts coefficients exactly', () => {
    expect(univariateCoefficients(parseExpr('(2x-1)(x+3)'), 'x').map(String)).toEqual([
      '-3',
      '5',
      '2',
    ]);
    expect(univariateCoefficients(parseExpr('x/2 + 1/3'), 'x').map(String)).toEqual(['1/3', '1/2']);
    expect(univariateCoefficients(parseExpr('(x+1)^2 - x^2'), 'x').map(String)).toEqual(['1', '2']);
  });
  it('solves equations directly with the formula oracle', () => {
    const set = (s: string) => {
      const p = parseProblem(s).problem;
      if (p.kind !== 'equation') throw new Error();
      return solutionSet1({ kind: 'equation', eq: p.eq }, 'x');
    };
    const vals = (s: string) => {
      const r = set(s);
      return r.kind === 'all' ? 'all' : r.values.map(String);
    };
    expect(vals('2x+3=7')).toEqual(['2']);
    expect(vals('x^2-5x+6=0')).toEqual(['2', '3']);
    expect(vals('x^2-5x+3=0')).toEqual(['5/2 - 1/2*sqrt(13)', '5/2 + 1/2*sqrt(13)']);
    expect(vals('x^2+1=0')).toEqual([]);
    expect(vals('x+1=x+1')).toBe('all');
    expect(vals('x+1=x+2')).toEqual([]);
    expect(vals('x=(5+-sqrt(13))/2')).toEqual(['5/2 - 1/2*sqrt(13)', '5/2 + 1/2*sqrt(13)']);
    expect(Rational.ONE.isOne()).toBe(true);
  });
});
