// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  eqn,
  parseProblem,
  ratExpr,
  Rational,
  solutionText,
  solve,
  solveProblem,
  verifyStep,
  type Equation,
  type Expr,
  type Step,
} from '../src/index';
import { approx } from './approx';
import { T3_GOLDEN } from './goldens';

describe('T3 golden solutions', () => {
  it(`has at least 40 problems (${T3_GOLDEN.length})`, () =>
    expect(T3_GOLDEN.length).toBeGreaterThanOrEqual(40));
  it.each(T3_GOLDEN)('%s', (input) => {
    const sol = solve(input);
    expect(sol.status, sol.reason).toBe('solved');
    expect(sol.type).toBe('T3');
    const kind = sol.answer?.kind;
    expect(['roots', 'no-solution', 'all-real']).toContain(kind);
    if (kind === 'roots') {
      // last step is the substitution check
      expect(sol.steps.at(-1)?.rule).toBe('check');
    }
    expect(solutionText(sol, 'en')).toMatchSnapshot();
    expect(solutionText(sol, 'zh-HK')).toMatchSnapshot();
  });
  it('classifies special cases', () => {
    expect(solve('x+1=x+2').answer?.kind).toBe('no-solution');
    expect(solve('2(x+1)=2x+2').answer?.kind).toBe('all-real');
    const a = solve('2(x+3)=5x-4').answer;
    expect(a?.kind === 'roots' && a.values.map(String)).toEqual(['10/3']);
  });
});

// ---- property: equations built backwards from a known rational solution ---------------

const smallInt = fc.integer({ min: -9, max: 9 });
const nz = smallInt.filter((n) => n !== 0);
const posInt = fc.integer({ min: 2, max: 6 });

/** Random linear expression in x with integer/fraction coefficients. */
const linExpr: fc.Arbitrary<string> = fc.oneof(
  fc.tuple(nz, smallInt).map(([a, b]) => `${a}(x + ${b})`),
  fc.tuple(smallInt, posInt).map(([b, k]) => `(x + ${b})/${k}`),
  fc.tuple(nz, smallInt).map(([a, b]) => `${a}x - ${b}`),
  fc.tuple(nz, smallInt, nz, smallInt).map(([a, b, c, d]) => `${a}(x - ${b}) - ${c}(x + ${d})`),
  fc.tuple(nz, posInt, smallInt).map(([a, k, b]) => `${a}x/${k} + ${b}`),
);

function evalAt(e: Expr, x: Rational): Rational {
  // tiny exact evaluator for building tests (independent of the engine)
  switch (e.k) {
    case 'num':
      return e.v;
    case 'var':
      return x;
    case 'neg':
      return evalAt(e.a, x).neg();
    case 'add':
      return evalAt(e.a, x).add(evalAt(e.b, x));
    case 'sub':
      return evalAt(e.a, x).sub(evalAt(e.b, x));
    case 'mul':
      return evalAt(e.a, x).mul(evalAt(e.b, x));
    case 'div':
      return evalAt(e.a, x).div(evalAt(e.b, x));
    default:
      throw new Error('unexpected');
  }
}

describe('T3 properties', () => {
  it('recovers the planted solution; every step is a verified equivalence', () => {
    fc.assert(
      fc.property(
        linExpr,
        smallInt,
        fc.integer({ min: 1, max: 5 }),
        smallInt,
        fc.boolean(),
        (lhsText, sn, sd, r, flip) => {
          const s = Rational.of(sn, sd);
          const p = parseProblem(lhsText).problem;
          if (p.kind !== 'expr') throw new Error();
          const L = p.expr;
          // RHS = r·x + e with e chosen so that x = s solves L = RHS
          const slope = evalAt(L, Rational.ONE).sub(evalAt(L, Rational.ZERO));
          fc.pre(!slope.eq(Rational.of(r)));
          const e = evalAt(L, s).sub(Rational.of(r).mul(s));
          const R: Expr = {
            k: 'add',
            a: { k: 'mul', a: ratExpr(Rational.of(r)), b: { k: 'var', name: 'x' } },
            b: ratExpr(e),
          };
          const eq: Equation = flip ? eqn(R, L) : eqn(L, R);
          const problem = { kind: 'equation', eq } as const;
          const sol = solveProblem(problem);
          expect(sol.status, sol.reason).toBe('solved');
          const ctx = { problem, vars: ['x'] };
          for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
          expect(sol.answer?.kind).toBe('roots');
          if (sol.answer?.kind === 'roots') {
            expect(sol.answer.values.length).toBe(1);
            expect(sol.answer.values[0]!.isRational() && sol.answer.values[0]!.a.eq(s)).toBe(true);
          }
        },
      ),
      { numRuns: 600 },
    );
  });
});

// ---- mutation tests --------------------------------------------------------------------

function rootApprox(eq: Equation): number | undefined {
  const f = (x: number) => approx(eq.lhs, { x }) - approx(eq.rhs, { x });
  const f0 = f(0);
  const slope = f(1) - f0;
  if (Math.abs(slope) < 1e-12) return undefined;
  return -f0 / slope;
}

type Mutant = { name: string; rule: string; mutate: (s: Step) => Step };

const swapOp = (e: Expr): Expr =>
  e.k === 'sub'
    ? { k: 'add', a: swapOp(e.a), b: e.b }
    : e.k === 'add'
      ? { k: 'add', a: swapOp(e.a), b: e.b }
      : e;

const MUTANTS: Mutant[] = [
  {
    name: 'moving a term without changing its sign',
    rule: 'eq.move-terms',
    mutate: (s) =>
      s.after.kind === 'equation'
        ? {
            ...s,
            after: { kind: 'equation', eq: eqn(swapOp(s.after.eq.lhs), swapOp(s.after.eq.rhs)) },
          }
        : s,
  },
  {
    name: 'multiplying instead of dividing',
    rule: 'eq.divide',
    mutate: (s) => {
      if (s.before.kind !== 'equation' || s.after.kind !== 'equation') return s;
      const before = s.before.eq;
      // a x = d  →  x = d · a (wrong)
      const a = before.lhs.k === 'mul' ? before.lhs.a : before.lhs;
      return {
        ...s,
        after: { kind: 'equation', eq: eqn(s.after.eq.lhs, { k: 'mul', a: before.rhs, b: a }) },
      };
    },
  },
  {
    name: 'clearing fractions on one side only',
    rule: 'eq.multiply-lcd',
    mutate: (s) =>
      s.before.kind === 'equation' && s.after.kind === 'equation'
        ? { ...s, after: { kind: 'equation', eq: eqn(s.after.eq.lhs, s.before.eq.rhs) } }
        : s,
  },
  {
    name: 'check step showing a wrong value',
    rule: 'check',
    mutate: (s) => {
      if (s.info?.kind !== 'substitute') return s;
      const rows = s.info.rows.map((r) => ({
        ...r,
        lhsValue: { k: 'add', a: r.lhsValue, b: { k: 'num', v: Rational.ONE } } as Expr,
      }));
      return { ...s, info: { ...s.info, rows } };
    },
  },
];

describe('T3 mutation tests', () => {
  it.each(MUTANTS)('verifier stops: $name', (m) => {
    let wrongMutants = 0;
    for (const input of T3_GOLDEN) {
      let wrong = false;
      const sol = solve(input, {
        tamper: (s) => {
          if (s.rule !== m.rule || wrong) return s;
          const out = m.mutate(s);
          if (out === s) return s;
          if (m.rule === 'check') wrong = true;
          else if (out.before.kind === 'equation' && out.after.kind === 'equation') {
            const r0 = rootApprox(out.before.eq);
            const r1 = rootApprox(out.after.eq);
            if (r0 !== undefined && (r1 === undefined || Math.abs(r0 - r1) > 1e-7)) wrong = true;
          }
          return out;
        },
      });
      if (!wrong) continue;
      wrongMutants++;
      expect(sol.status, input).toBe('unverified');
    }
    expect(wrongMutants).toBeGreaterThan(0);
  });
});
