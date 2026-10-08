// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { identical, num, solve, toText, variables, type Expr, type Step } from '../src/index';
import { T6_GOLDEN } from './goldens';

function answerExpr(input: string): Expr {
  const sol = solve(input);
  expect(sol.status, `${input} ${sol.reason ?? ''}`).toBe('solved');
  expect(sol.type).toBe('T6');
  if (sol.answer?.kind !== 'expression') throw new Error(input);
  return sol.answer.expr;
}

describe('T6 factorisation', () => {
  it(`has at least 50 regression problems (${T6_GOLDEN.length})`, () =>
    expect(T6_GOLDEN.length).toBeGreaterThanOrEqual(50));

  it.each(T6_GOLDEN)('%s stays identical to the problem and is verified', (input) => {
    const sol = solve(input);
    expect(sol.status, sol.reason).toBe('solved');
    const got = answerExpr(input);
    const original = sol.problem?.kind === 'expr' ? sol.problem.expr : undefined;
    expect(original).toBeTruthy();
    const vars = [...new Set([...variables(original!), ...variables(got)])].sort();
    expect(identical(original!, got, vars)).toBe(true);
  });

  it('gives the expected factors', () => {
    const text = (s: string) => toText(answerExpr(s));
    expect(text('factor 6x+9')).toBe('3(2x + 3)');
    expect(text('factor x^2-9')).toBe('(x - 3)(x + 3)');
    expect(text('factor x^2+6x+9')).toBe('(x + 3)^2');
    expect(text('factor x^2+5x+6')).toBe('(x + 2)(x + 3)');
    expect(text('factor 2x^2+7x+3')).toBe('(x + 3)(2x + 1)');
    expect(text('factor x^2-y^2')).toBe('(x - y)(x + y)');
    expect(text('factor xy+2x+3y+6')).toBe('(x + 3)(y + 2)');
    expect(text('factor x^3-6x^2+11x-6')).toBe('(x - 1)(x - 3)(x - 2)');
    expect(text('factor x^2+x+1')).toBe('x^2 + x + 1');
  });

  it('a quadratic built from two integer roots factors back', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -6, max: 6 }),
        fc.integer({ min: -6, max: 6 }),
        fc.integer({ min: 1, max: 4 }),
        (p, q, a) => {
          const b = -(a * q + p);
          const c = p * q;
          const input = `factor ${a === 1 ? '' : a}x^2${b < 0 ? b : `+${b}`}x${c < 0 ? c : `+${c}`}`;
          const sol = solve(input.replace('+0x', '').replace('+-', '-'));
          expect(sol.status, input).toBe('solved');
          const got = sol.answer?.kind === 'expression' ? sol.answer.expr : num(0);
          const original = sol.problem?.kind === 'expr' ? sol.problem.expr : num(0);
          expect(identical(original, got, ['x'])).toBe(true);
          if (p !== 0 || q !== 0)
            expect(sol.steps.some((s) => s.rule.startsWith('factor.'))).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });
});

function setAfter(step: Step, expr: Expr): Step {
  return { ...step, after: { kind: 'expr', expr } };
}

describe('T6 mutation tests', () => {
  it('a factor step that changes the value is rejected', () => {
    let killed = 0;
    for (const input of ['factor x^2-9', 'factor x^2+5x+6', 'factor 6x+9', 'factor xy+2x+3y+6']) {
      const sol = solve(input, {
        tamper: (s) =>
          s.rule.startsWith('factor.') && s.rule !== 'factor.none' && s.after.kind === 'expr'
            ? setAfter(s, num(0))
            : s,
      });
      expect(sol.status, input).toBe('unverified');
      killed++;
    }
    expect(killed).toBe(4);
  });

  it('dropping the common factor is rejected', () => {
    const sol = solve('factor 6x+9', {
      tamper: (s) =>
        s.rule === 'factor.common' && s.after.kind === 'expr'
          ? setAfter(s, s.after.expr.k === 'mul' ? s.after.expr.b : s.after.expr)
          : s,
    });
    expect(sol.status).toBe('unverified');
  });
});
