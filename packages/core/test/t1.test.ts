// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  evalRational,
  parseProblem,
  parseExpr,
  Rational,
  solutionText,
  solve,
  solveProblem,
  verifyStep,
  type Expr,
  type Step,
} from '../src/index';
import { getAt, replaceAt, type Side } from '../src/rules/tree';
import { T1_GOLDEN } from './goldens';

describe('T1 golden solutions', () => {
  it(`has at least 40 problems (${T1_GOLDEN.length})`, () =>
    expect(T1_GOLDEN.length).toBeGreaterThanOrEqual(40));
  it.each(T1_GOLDEN)('%s', (input) => {
    const sol = solve(input);
    expect(sol.status, sol.reason).toBe('solved');
    expect(sol.type).toBe('T1');
    const direct = evalRational(parseExpr(input), new Map());
    expect(sol.answer?.kind).toBe('value');
    if (sol.answer?.kind === 'value') expect(sol.answer.value.eq(direct)).toBe(true);
    expect(solutionText(sol, 'en')).toMatchSnapshot();
    expect(solutionText(sol, 'zh-HK')).toMatchSnapshot();
  });
});

// ---- property: random arithmetic → every step verified, last value = direct value -------

const leaf: fc.Arbitrary<Expr> = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: 12 }).map((n) => parseExpr(String(n))) },
  {
    weight: 2,
    arbitrary: fc
      .tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 1, max: 9 }))
      .map(([p, q]) => parseExpr(`${p}/${q}`)),
  },
  { weight: 1, arbitrary: fc.constantFrom('0.5', '0.25', '1.2', '2.75', '0.1').map(parseExpr) },
);

const arith: fc.Arbitrary<Expr> = fc.letrec<{ e: Expr }>((tie) => ({
  e: fc.oneof(
    { depthSize: 'small' },
    leaf,
    tie('e').map((a) => ({ k: 'neg', a }) as Expr),
    fc
      .tuple(fc.constantFrom('add', 'sub', 'mul', 'div'), tie('e'), tie('e'))
      .map(([k, a, b]) => ({ k, a, b }) as Expr),
    fc.tuple(leaf, fc.integer({ min: 0, max: 3 })).map(
      ([a, n]) =>
        ({
          k: 'pow',
          a,
          b: { k: 'num', v: Rational.of(n) },
        }) as Expr,
    ),
  ),
})).e;

describe('T1 properties', () => {
  it('every step is verified and the final value equals direct evaluation', () => {
    fc.assert(
      fc.property(arith, (e) => {
        const problem = { kind: 'expr', expr: e } as const;
        const sol = solveProblem(problem);
        expect(sol.status).not.toBe('unverified');
        if (sol.status !== 'solved') return; // division by zero / too large
        const ctx = { problem, vars: [] };
        for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
        const direct = evalRational(e, new Map());
        if (sol.answer?.kind !== 'value') throw new Error('no value');
        expect(sol.answer.value.eq(direct)).toBe(true);
      }),
      { numRuns: 1500 },
    );
  });
});

describe('T1 powers in pure arithmetic', () => {
  const base = fc.oneof(
    fc.integer({ min: -12, max: 12 }).map(String),
    fc
      .tuple(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 2, max: 9 }), fc.boolean())
      .map(([n, d, minus]) => `(${minus ? '-' : ''}${n}/${d})`),
  );
  it('a^k for whole k from -20 to 20: verified steps, exact value or a polite refusal', () => {
    fc.assert(
      fc.property(base, fc.integer({ min: -20, max: 20 }), (b, k) => {
        const input = `${b.startsWith('-') ? `(${b})` : b}^${k < 0 ? `(${k})` : k}`;
        const sol = solve(input);
        expect(sol.status, input).not.toBe('unverified');
        const problem = parseProblem(input).problem;
        const value = (() => {
          try {
            return evalRational(
              problem.kind === 'expr' ? problem.expr : (null as never),
              new Map(),
            );
          } catch {
            return undefined;
          }
        })();
        if (value === undefined) {
          // 0^(negative): division by zero
          expect(sol.message?.key, input).toBe('error.div-zero');
          return;
        }
        if (sol.status !== 'solved') {
          expect(sol.message?.key, input).toBe('error.too-large');
          return;
        }
        const ctx = { problem, vars: [] };
        for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
        if (sol.answer?.kind !== 'value') throw new Error('no value');
        expect(sol.answer.value.eq(value), input).toBe(true);
      }),
      { numRuns: 1500 },
    );
  });
  it('limits: exponent size, division by zero and huge results are refused politely', () => {
    expect(solve('2^21').message?.key).toBe('unsupported.exponent-arith');
    expect(solve('2^-21').message?.key).toBe('unsupported.exponent-arith');
    expect(solve('2^0.5').message?.key).toBe('unsupported.exponent-arith');
    expect(solve('2^(1+1)').message?.key).toBe('unsupported.exponent-arith');
    expect(solve('0^-1').message?.key).toBe('error.div-zero');
    expect(solve('1/(0^-2)').message?.key).toBe('error.div-zero');
    expect(solve('999999999^20').message?.key).toBe('error.too-large');
    const t0 = performance.now();
    expect(solve('((((9^20)^20)^20)^20)^20').message?.key).toBe('error.too-large');
    expect(performance.now() - t0).toBeLessThan(1000);
    // with unknowns the old limit (0..4) still applies
    expect(solve('x^5').message?.key).toBe('unsupported.exponent');
    expect(solve('x+2^5').message?.key).toBe('unsupported.exponent');
    expect(solve('x^-1=2').message?.key).toBe('unsupported.exponent');
  });
});

// ---- mutation tests: deliberately broken rules must be stopped by the verifier -----------

type Mutant = { name: string; rule: string; mutate: (step: Step) => Step };

function nodeAtHighlight(step: Step, i = 0): { path: Side[]; node: Expr } | undefined {
  const p = step.highlight?.[i] as Side[] | undefined;
  if (!p || step.after.kind !== 'expr') return undefined;
  return { path: p, node: getAt(step.after.expr, p) };
}
function withNode(step: Step, path: Side[], node: Expr): Step {
  if (step.after.kind !== 'expr') return step;
  return { ...step, after: { kind: 'expr', expr: replaceAt(step.after.expr, path, node) } };
}
const plusOne = (e: Expr): Expr => ({ k: 'add', a: e, b: { k: 'num', v: Rational.ONE } });

const MUTANTS: Mutant[] = [
  {
    name: 'subtracting a negative keeps the minus sign',
    rule: 'arith.subtract-negative',
    mutate: (s) => {
      const h = nodeAtHighlight(s);
      if (!h || h.node.k !== 'add') return s;
      return withNode(s, h.path, { k: 'sub', a: h.node.a, b: h.node.b });
    },
  },
  {
    name: 'multiplication off by one',
    rule: 'arith.multiply',
    mutate: (s) => {
      const h = nodeAtHighlight(s);
      return h ? withNode(s, h.path, plusOne(h.node)) : s;
    },
  },
  {
    name: 'common denominator without scaling the numerator',
    rule: 'arith.common-denominator',
    mutate: (s) => {
      if (s.before.kind !== 'expr') return s;
      let out = s;
      for (let i = 0; i < 2; i++) {
        const h = nodeAtHighlight(out, i);
        if (!h) continue;
        const orig = getAt(s.before.expr, h.path);
        const n =
          orig.k === 'div' ? orig.a : orig.k === 'neg' && orig.a.k === 'div' ? orig.a.a : orig;
        const den =
          h.node.k === 'div'
            ? h.node.b
            : h.node.k === 'neg' && h.node.a.k === 'div'
              ? h.node.a.b
              : undefined;
        if (den) out = withNode(out, h.path, { k: 'div', a: n, b: den });
      }
      return out;
    },
  },
  {
    name: 'reducing only the numerator',
    rule: 'arith.reduce',
    mutate: (s) => {
      if (s.before.kind !== 'expr') return s;
      const h = nodeAtHighlight(s);
      if (!h) return s;
      const orig = getAt(s.before.expr, h.path);
      if (orig.k !== 'div' || h.node.k !== 'div') return s;
      return withNode(s, h.path, { k: 'div', a: h.node.a, b: orig.b });
    },
  },
  {
    name: 'power computed as base times exponent',
    rule: 'arith.power',
    mutate: (s) => {
      if (s.before.kind !== 'expr') return s;
      const h = nodeAtHighlight(s);
      if (!h) return s;
      const orig = getAt(s.before.expr, h.path);
      if (orig.k !== 'pow') return s;
      return withNode(s, h.path, { k: 'mul', a: orig.a, b: orig.b });
    },
  },
  {
    name: 'negative exponent: dropping the reciprocal',
    rule: 'arith.negative-power',
    mutate: (s) => {
      if (s.before.kind !== 'expr') return s;
      const h = nodeAtHighlight(s);
      if (!h) return s;
      const orig = getAt(s.before.expr, h.path);
      if (orig.k !== 'pow' || orig.b.k !== 'neg') return s;
      return withNode(s, h.path, { k: 'pow', a: orig.a, b: orig.b.a });
    },
  },
  {
    name: 'negative exponent: making the result negative instead',
    rule: 'arith.negative-power',
    mutate: (s) => {
      if (s.before.kind !== 'expr') return s;
      const h = nodeAtHighlight(s);
      if (!h) return s;
      const orig = getAt(s.before.expr, h.path);
      if (orig.k !== 'pow' || orig.b.k !== 'neg') return s;
      return withNode(s, h.path, { k: 'neg', a: { k: 'pow', a: orig.a, b: orig.b.a } });
    },
  },
  {
    name: 'adding fractions by adding denominators too',
    rule: 'arith.combine-fractions',
    mutate: (s) => {
      const h = nodeAtHighlight(s);
      if (!h) return s;
      const d =
        h.node.k === 'div'
          ? h.node
          : h.node.k === 'neg' && h.node.a.k === 'div'
            ? h.node.a
            : undefined;
      if (!d) return s;
      const bad: Expr = { k: 'div', a: d.a, b: { k: 'add', a: d.b, b: d.b } };
      return withNode(s, h.path, h.node.k === 'neg' ? { k: 'neg', a: bad } : bad);
    },
  },
];

/** Independent floating-point evaluator used only to judge whether a mutant is wrong. */
export function approx(e: Expr): number {
  switch (e.k) {
    case 'num':
      return Number(e.v.n) / Number(e.v.d);
    case 'neg':
      return -approx(e.a);
    case 'add':
      return approx(e.a) + approx(e.b);
    case 'sub':
      return approx(e.a) - approx(e.b);
    case 'mul':
      return approx(e.a) * approx(e.b);
    case 'div':
      return approx(e.a) / approx(e.b);
    case 'pow':
      return approx(e.a) ** approx(e.b);
    default:
      throw new Error('unsupported in approx');
  }
}

describe('T1 mutation tests', () => {
  it.each(MUTANTS)('verifier stops: $name', (m) => {
    let wrongMutants = 0;
    for (const input of T1_GOLDEN) {
      let wrong = false;
      const sol = solve(input, {
        tamper: (s) => {
          if (s.rule !== m.rule || wrong) return s;
          const out = m.mutate(s);
          if (out !== s && out.before.kind === 'expr' && out.after.kind === 'expr') {
            const d = Math.abs(approx(out.before.expr) - approx(out.after.expr));
            if (d > 1e-9) wrong = true;
          }
          return out;
        },
      });
      if (!wrong) continue; // mutant did not fire, or happened to give a correct value
      wrongMutants++;
      expect(sol.status, input).toBe('unverified');
    }
    expect(wrongMutants).toBeGreaterThan(0);
  });
});

describe('T1 final answers are in lowest terms', () => {
  it.each(T1_GOLDEN)('%s', (input) => {
    const sol = solve(input);
    if (sol.answer?.kind !== 'value') return;
    let e = sol.answer.expr;
    if (e.k === 'neg') e = e.a;
    if (e.k === 'div' && e.a.k === 'num' && e.b.k === 'num') {
      const g = (a: bigint, b: bigint): bigint => (b === 0n ? a : g(b, a % b));
      expect(e.b.v.n).not.toBe(1n);
      expect(g(e.a.v.n, e.b.v.n)).toBe(1n);
    }
  });
});
