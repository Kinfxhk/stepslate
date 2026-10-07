// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  identical,
  parseExpr,
  Rational,
  solutionText,
  solve,
  solveProblem,
  verifyStep,
  type Expr,
  type Step,
} from '../src/index';
import { nextPolyStep } from '../src/rules/poly';
import { getAt, replaceAt, type Side } from '../src/rules/tree';
import { differ } from './approx';

export const T2_GOLDEN = [
  '2(x+3)',
  '-3(x-4)',
  'x(x+1)',
  '2x(3x-5)',
  '(x+1)(x+2)',
  '(x+1)(x-1)',
  '(2x-3)(x+4)',
  '(x+1)^2',
  '(x-3)^2',
  '(2x+1)^2',
  '(x+2)^3',
  '(x-2)^3',
  '(x+1)^4',
  '(x^2+1)(x^2-1)',
  '3x+2x^2-x+5',
  '4x-7x',
  'x^2-x^2',
  '5-x+3x-2',
  '3-2(x+1)',
  '-(x-3)+2x',
  '2(x+1)-3(x-2)',
  '(2x-1)(x+3)-x(x-2)',
  'x(x+1)(x+2)',
  '(x+1)/2+x/3',
  '(4x-2)/2',
  '0.5x+1.5x',
  '2(3+4)x',
  '2x*3x',
  'x*x*x',
  '(3x)^2',
  '(-x)^3',
  '-(x^2-2x+1)',
  'x-(2x-(3x-4))',
  '(x+y)^2',
  '(x-y)(x+y)',
  '3x+2y-x+4y',
  '2(x+y)-(x-y)',
  'x^2+x+1',
  '7',
  '(1/2)x+1/3x',
  '(x^2+x)(x-1)',
  '6x^2/3',
];

describe('T2 golden solutions', () => {
  it(`has at least 40 problems (${T2_GOLDEN.length})`, () =>
    expect(T2_GOLDEN.length).toBeGreaterThanOrEqual(40));
  it.each(T2_GOLDEN)('%s', (input) => {
    const sol = solve(input);
    expect(sol.status, sol.reason).toBe('solved');
    if (input !== '7') expect(sol.type).toBe('T2');
    const ans = sol.answer;
    if (sol.type === 'T2') {
      if (ans?.kind !== 'expression') throw new Error('no expression');
      const vars = sol.vars;
      expect(identical(parseExpr(input), ans.expr, vars)).toBe(true);
      expect(nextPolyStep(ans.expr, vars)).toBeNull(); // fully simplified
    }
    expect(solutionText(sol, 'en')).toMatchSnapshot();
    expect(solutionText(sol, 'zh-HK')).toMatchSnapshot();
  });
});

// ---- property --------------------------------------------------------------------------

const small = fc.integer({ min: -6, max: 6 });
const linear = fc.tuple(small, small).map(([a, b]) => parseExpr(`(${a}x + ${b})`));
const term: fc.Arbitrary<Expr> = fc.oneof(
  small.map((n) => parseExpr(`${n}x`)),
  small.map((n) => parseExpr(`(${n})`)),
  fc.tuple(small, fc.integer({ min: 1, max: 4 })).map(([n, d]) => parseExpr(`(${n}/${d})x^2`)),
  linear,
);
const poly: fc.Arbitrary<Expr> = fc.oneof(
  fc.tuple(linear, linear).map(([a, b]) => ({ k: 'mul', a, b }) as Expr),
  fc.tuple(linear, fc.integer({ min: 0, max: 3 })).map(
    ([a, n]) =>
      ({
        k: 'pow',
        a,
        b: { k: 'num', v: Rational.of(n) },
      }) as Expr,
  ),
  fc
    .tuple(term, term, term, fc.constantFrom('add', 'sub'), fc.constantFrom('add', 'sub', 'mul'))
    .map(([a, b, c, o1, o2]) => ({ k: o2, a: { k: o1, a, b }, b: c }) as Expr),
  fc
    .tuple(linear, linear, linear)
    .map(([a, b, c]) => ({ k: 'mul', a: { k: 'mul', a, b }, b: c }) as Expr),
  fc.tuple(term, linear).map(([a, b]) => ({ k: 'sub', a, b: { k: 'mul', a: b, b: a } }) as Expr),
);

describe('T2 properties', () => {
  it('every step is an exact identity and the result is fully simplified', () => {
    fc.assert(
      fc.property(poly, (e) => {
        const problem = { kind: 'expr', expr: e } as const;
        const sol = solveProblem(problem);
        expect(sol.status, sol.reason).not.toBe('unverified');
        if (sol.status !== 'solved' || sol.type !== 'T2') return;
        const ctx = { problem, vars: sol.vars };
        for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
        if (sol.answer?.kind !== 'expression') throw new Error('no answer');
        expect(identical(e, sol.answer.expr, sol.vars)).toBe(true);
        expect(nextPolyStep(sol.answer.expr, sol.vars)).toBeNull();
      }),
      { numRuns: 800 },
    );
  });
});

// ---- mutation tests --------------------------------------------------------------------

type Mutant = { name: string; rule: string; mutate: (s: Step) => Step };

const exprOf = (s: Step['after']): Expr | undefined => (s.kind === 'expr' ? s.expr : undefined);
const setExpr = (s: Step, e: Expr): Step => ({ ...s, after: { kind: 'expr', expr: e } });

/** Rewrite the first node of `after` matching `pred` with `f`. */
function rewriteFirst(e: Expr, pred: (n: Expr) => boolean, f: (n: Expr) => Expr): Expr {
  let done = false;
  const go = (n: Expr): Expr => {
    if (done) return n;
    if (pred(n)) {
      done = true;
      return f(n);
    }
    if (n.k === 'num' || n.k === 'var') return n;
    if (n.k === 'neg' || n.k === 'sqrt') return { ...n, a: go(n.a) };
    return { ...n, a: go(n.a), b: go(n.b) } as Expr;
  };
  return go(e);
}

const MUTANTS: Mutant[] = [
  {
    name: 'distribute only to the first term',
    rule: 'poly.distribute',
    mutate: (s) => {
      const p = s.highlight?.[0] as Side[] | undefined;
      const a = exprOf(s.after);
      if (!p || !a) return s;
      const node = getAt(a, p);
      if (node.k !== 'add' && node.k !== 'sub') return s;
      const b = node.b.k === 'mul' ? node.b.b : node.b;
      return setExpr(s, replaceAt(a, p, { ...node, b }));
    },
  },
  {
    name: 'minus before a bracket changes only the first sign',
    rule: 'poly.remove-brackets',
    mutate: (s) => {
      const a = exprOf(s.after);
      if (!a) return s;
      return setExpr(
        s,
        rewriteFirst(
          a,
          (n) => n.k === 'sub' && (n.a.k === 'sub' || n.a.k === 'add'),
          (n) => (n.k === 'sub' ? { k: 'add', a: n.a, b: n.b } : n),
        ),
      );
    },
  },
  {
    name: 'square of a sum as the sum of squares',
    rule: 'poly.power-to-product',
    mutate: (s) => {
      const p = s.highlight?.[0] as Side[] | undefined;
      const a = exprOf(s.after);
      const b = exprOf(s.before);
      if (!p || !a || !b) return s;
      const orig = getAt(b, p);
      if (orig.k !== 'pow' || (orig.a.k !== 'add' && orig.a.k !== 'sub')) return s;
      const sum = orig.a;
      const bad: Expr = {
        k: sum.k,
        a: { k: 'pow', a: sum.a, b: orig.b },
        b: { k: 'pow', a: sum.b, b: orig.b },
      };
      return setExpr(s, replaceAt(a, p, bad));
    },
  },
  {
    name: 'combining like terms also adds the powers',
    rule: 'poly.combine',
    mutate: (s) => {
      const a = exprOf(s.after);
      if (!a) return s;
      return setExpr(
        s,
        rewriteFirst(
          a,
          (n) => n.k === 'var',
          (n) => ({ k: 'pow', a: n, b: { k: 'num', v: Rational.of(2) } }),
        ),
      );
    },
  },
  {
    name: 'x·x simplified to 2x',
    rule: 'poly.simplify-terms',
    mutate: (s) => {
      const a = exprOf(s.after);
      if (!a) return s;
      return setExpr(
        s,
        rewriteFirst(
          a,
          (n) => n.k === 'pow' && n.a.k === 'var' && n.b.k === 'num' && n.b.v.n === 2n,
          (n) => ({ k: 'mul', a: { k: 'num', v: Rational.of(2) }, b: (n as { a: Expr }).a }),
        ),
      );
    },
  },
];

describe('T2 mutation tests', () => {
  it.each(MUTANTS)('verifier stops: $name', (m) => {
    let wrongMutants = 0;
    for (const input of T2_GOLDEN) {
      let wrong = false;
      const sol = solve(input, {
        tamper: (s) => {
          if (s.rule !== m.rule || wrong) return s;
          const out = m.mutate(s);
          const b = exprOf(out.before);
          const a = exprOf(out.after);
          if (out !== s && a && b && differ(a, b)) wrong = true;
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
