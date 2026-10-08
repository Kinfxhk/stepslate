// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { num, solve, v, type Surd } from '../src/index';

function roots(input: string, method: 'formula' | 'square' = 'formula'): Surd[] {
  const sol = solve(input, method === 'square' ? { quadratic: 'square' } : {});
  expect(sol.status, `${input} ${sol.reason ?? ''}`).toBe('solved');
  if (sol.answer?.kind === 'no-solution') return [];
  if (sol.answer?.kind !== 'roots') throw new Error(`${input} ${sol.answer?.kind}`);
  return [...sol.answer.values];
}

function same(a: readonly Surd[], b: readonly Surd[]): boolean {
  const key = (xs: readonly Surd[]) =>
    xs
      .map((v) => v.key())
      .sort()
      .join('|');
  return key(a) === key(b);
}

describe('completing the square', () => {
  const cases = [
    'x^2 + 4x + 1 = 0',
    'x^2 - 5x + 6 = 0',
    'x^2 + 6x + 9 = 0',
    'x^2 + 2x + 5 = 0',
    '2x^2 - 4x - 2 = 0',
    'x^2 - 4x + 1 = 0',
    '(x - 2)(x - 3) = 0',
    'x^2 + 4x + 4 = 0',
  ];

  it('matches the default method on each example', () => {
    for (const input of cases) {
      const a = roots(input, 'formula');
      const b = roots(input, 'square');
      expect(same(a, b), input).toBe(true);
    }
  });

  it('shows the square step and does not use the quadratic formula', () => {
    const sol = solve('x^2 + 4x + 1 = 0', { quadratic: 'square' });
    expect(sol.status, sol.reason).toBe('solved');
    const rules = sol.steps.map((s) => s.rule);
    expect(rules).toContain('eq.complete-square');
    expect(rules).toContain('eq.complete-add');
    expect(rules).not.toContain('eq.quadratic-formula');
    expect(rules).not.toContain('eq.factorise');
  });

  it('the default path is unchanged (formula, not completing the square)', () => {
    const sol = solve('x^2 + 4x + 1 = 0');
    expect(sol.steps.some((s) => s.rule === 'eq.quadratic-formula')).toBe(true);
    expect(sol.steps.some((s) => s.rule.startsWith('eq.complete'))).toBe(false);
  });

  it('rejects a tampered square-root step', () => {
    const sol = solve('x^2 + 4x + 1 = 0', {
      quadratic: 'square',
      tamper(step) {
        if (step.rule === 'eq.square-root-both')
          return { ...step, after: { kind: 'equation', eq: { lhs: v('x'), rhs: num(0) } } };
        return step;
      },
    });
    expect(sol.status).toBe('unverified');
  });
});
