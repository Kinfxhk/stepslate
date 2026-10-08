// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { answerText, checkAnswer, num, solve, verifyStep, type Rel, type Step } from '../src/index';
import { Rational } from '../src/numbers/rational';

function solved(input: string) {
  const sol = solve(input);
  expect(sol.status, `${input} ${sol.reason ?? ''} ${sol.message?.key ?? ''}`).toBe('solved');
  expect(sol.type).toBe('T7');
  return sol;
}

function rat(text: string): Rational {
  const neg = text.startsWith('-');
  const body = neg ? text.slice(1) : text;
  const [n, d] = body.split('/');
  const q = Rational.of(BigInt(n!), BigInt(d ?? '1'));
  return neg ? q.neg() : q;
}

function expectInterval(input: string, rel: Rel, bound: string) {
  const sol = solved(input);
  expect(sol.answer?.kind, input).toBe('interval');
  if (sol.answer?.kind !== 'interval') return;
  expect(sol.answer.rel, input).toBe(rel);
  expect(sol.answer.bound.eq(rat(bound)), `${input} got ${sol.answer.bound}`).toBe(true);
  expect(checkAnswer(sol, answerText(sol))).toBe('correct');
  expect(checkAnswer(sol, `x ${rel === '<' ? '<=' : '<'} ${bound}`)).toBe('wrong');
}

describe('T7 linear inequalities', () => {
  it('solves the school examples, including a negative divisor', () => {
    expectInterval('2x + 3 < 11', '<', '4');
    expectInterval('2x < 4', '<', '2');
    expectInterval('-2x < 4', '>', '-2');
    expectInterval('-2x <= 4', '>=', '-2');
    expectInterval('-2x > 4', '<', '-2');
    expectInterval('-2x >= 4', '<=', '-2');
    expectInterval('2 < x', '>', '2');
    expectInterval('3 < 2x + 1', '>', '1');
    expectInterval('x/2 + 1/3 < 1', '<', '4/3');
    expectInterval('-x/2 < 3', '>', '-6');
    expectInterval('0.5x <= 1', '<=', '2');
    expectInterval('x + 1 < 2x', '>', '1');
    expectInterval('2x + 3 ≤ 7', '<=', '2');
  });

  it('constant inequalities are all or none, and do not invent a bound', () => {
    expect(solved('2 < 3').answer?.kind).toBe('all-real');
    expect(solved('2 <= 2').answer?.kind).toBe('all-real');
    expect(solved('2 < 2').answer?.kind).toBe('no-solution');
    expect(solved('2 > 3').answer?.kind).toBe('no-solution');
    expect(solved('x < x').answer?.kind).toBe('no-solution');
    expect(solved('x <= x').answer?.kind).toBe('all-real');
  });

  it('refuses quadratic inequalities instead of pretending', () => {
    const sol = solve('x^2 < 1');
    expect(sol.status).toBe('unsupported');
    expect(sol.message?.key).toBe('unsupported.quadratic-inequality');
  });

  it('keeps the solution set on random linear inequalities', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -8, max: 8 }).filter((a) => a !== 0),
        fc.integer({ min: -12, max: 12 }),
        fc.integer({ min: -12, max: 12 }),
        fc.constantFrom('<' as const, '<=' as const, '>' as const, '>=' as const),
        (a, b, c, rel) => {
          const bPart = b === 0 ? '' : b > 0 ? `+ ${b}` : `- ${-b}`;
          const ax = a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`;
          const input = `${ax} ${bPart} ${rel} ${c}`.replace('  ', ' ');
          const sol = solved(input);
          const A = Rational.of(a);
          const rhs = Rational.of(c - b);
          const bound = rhs.div(A);
          const out = A.sign() < 0 ? flip(rel) : rel;
          expect(sol.answer?.kind).toBe('interval');
          if (sol.answer?.kind !== 'interval') return;
          expect(sol.answer.rel).toBe(out);
          expect(sol.answer.bound.eq(bound)).toBe(true);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('T7 mutation tests', () => {
  it('rejects a missed sign flip when dividing by a negative number', () => {
    const sol = solve('-2x < 4', {
      tamper(step: Step) {
        if (step.rule === 'ineq.divide-negative' && step.after.kind === 'inequality')
          return { ...step, after: { ...step.after, rel: '<' } };
        return step;
      },
    });
    expect(sol.status).toBe('unverified');
    expect(sol.reason).toMatch(/solution set|flip|sign/i);
  });

  it('rejects a flipped sign when dividing by a positive number', () => {
    const sol = solve('2x < 4', {
      tamper(step: Step) {
        if (step.rule === 'ineq.divide' && step.after.kind === 'inequality')
          return { ...step, after: { ...step.after, rel: '>' } };
        return step;
      },
    });
    expect(sol.status).toBe('unverified');
  });

  it('rejects a step that moves the bound', () => {
    const sol = solve('2x < 4', {
      tamper(step: Step) {
        if (step.rule === 'ineq.divide' && step.after.kind === 'inequality')
          return { ...step, after: { ...step.after, rhs: num(99) } };
        return step;
      },
    });
    expect(sol.status).toBe('unverified');
  });

  it('the verifier itself rejects a negative multiple that does not flip', () => {
    const before = {
      kind: 'inequality' as const,
      rel: '<' as const,
      lhs: {
        k: 'mul' as const,
        a: { k: 'num' as const, v: Rational.of(-2) },
        b: { k: 'var' as const, name: 'x' },
      },
      rhs: { k: 'num' as const, v: Rational.of(4) },
    };
    const after = {
      kind: 'inequality' as const,
      rel: '<' as const,
      lhs: { k: 'var' as const, name: 'x' },
      rhs: { k: 'neg' as const, a: { k: 'num' as const, v: Rational.of(2) } },
    };
    const problem = {
      kind: 'inequality' as const,
      lhs: before.lhs,
      rhs: before.rhs,
      rel: '<' as const,
    };
    const result = verifyStep(
      { before, after, rule: 'ineq.divide-negative', explain: { key: 'ineq.divide-negative' } },
      { problem, vars: ['x'] },
    );
    expect(result.ok).toBe(false);
  });
});

function flip(rel: Rel): Rel {
  if (rel === '<') return '>';
  if (rel === '<=') return '>=';
  if (rel === '>') return '<';
  return '<=';
}
