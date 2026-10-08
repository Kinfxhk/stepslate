// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  Rational,
  solutionText,
  solve,
  verifyStep,
  type Expr,
  type State,
  type Step,
} from '../src/index';
import { approx } from './approx';
import { T4_GOLDEN } from './goldens';

describe('T4 golden solutions', () => {
  it(`has at least 40 problems (${T4_GOLDEN.length})`, () =>
    expect(T4_GOLDEN.length).toBeGreaterThanOrEqual(40));
  it.each(T4_GOLDEN)('%s', (input) => {
    const sol = solve(input);
    expect(sol.status, sol.reason).toBe('solved');
    expect(['T3', 'T4']).toContain(sol.type);
    expect(['roots', 'no-solution', 'all-real']).toContain(sol.answer?.kind);
    if (sol.answer?.kind === 'roots') expect(sol.steps.at(-1)?.rule).toBe('check');
    expect(solutionText(sol, 'en')).toMatchSnapshot();
    expect(solutionText(sol, 'zh-HK')).toMatchSnapshot();
  });
  it('gives the expected answers', () => {
    const roots = (s: string) => {
      const a = solve(s).answer;
      return a?.kind === 'roots' ? a.values.map(String) : a?.kind;
    };
    expect(roots('x^2-5x+6=0')).toEqual(['2', '3']);
    expect(roots('2x^2+3x=2')).toEqual(['-2', '1/2']);
    expect(roots('x^2+2x+1=0')).toEqual(['-1']);
    expect(roots('x^2+x+1=0')).toBe('no-solution');
    expect(roots('x^2+9=0')).toBe('no-solution');
    expect(roots('(x+1)^2=x^2+3')).toEqual(['1']);
    const s = solve('x^2-4x+1=0');
    expect(s.answer?.kind === 'roots' && s.answer.values.map((v) => v.approx())).toEqual([
      2 - Math.sqrt(3),
      2 + Math.sqrt(3),
    ]);
  });
});

// ---- independent numeric solution sets (floating point; tests only) ---------------------

const hasRoot = (e: Expr): boolean =>
  e.k === 'sqrt' || e.k === 'pm'
    ? true
    : e.k === 'num' || e.k === 'var'
      ? false
      : e.k === 'neg'
        ? hasRoot(e.a)
        : hasRoot(e.a) || hasRoot(e.b);

function pickPm(e: Expr, sign: 1 | -1): Expr {
  switch (e.k) {
    case 'num':
    case 'var':
      return e;
    case 'neg':
    case 'sqrt':
      return { ...e, a: pickPm(e.a, sign) };
    case 'pm':
      return { k: sign > 0 ? 'add' : 'sub', a: pickPm(e.a, sign), b: pickPm(e.b, sign) };
    default:
      return { ...e, a: pickPm(e.a, sign), b: pickPm(e.b, sign) } as Expr;
  }
}

function rootsOfEquation(lhs: Expr, rhs: Expr): number[] | 'all' {
  if (hasRoot(lhs) || hasRoot(rhs)) {
    const other = lhs.k === 'var' ? rhs : lhs;
    return [approx(pickPm(other, 1)), approx(pickPm(other, -1))];
  }
  const f = (x: number) => approx(lhs, { x }) - approx(rhs, { x });
  const f0 = f(0);
  const a = (f(1) + f(-1)) / 2 - f0;
  const b = (f(1) - f(-1)) / 2;
  const tiny = (z: number) => Math.abs(z) < 1e-9;
  if (tiny(a)) {
    if (tiny(b)) return tiny(f0) ? 'all' : [];
    return [-f0 / b];
  }
  const D = b * b - 4 * a * f0;
  if (D < -1e-9) return [];
  const s = Math.sqrt(Math.max(D, 0));
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}

export function numericSet(s: State): string {
  let vals: number[] = [];
  if (s.kind === 'all') return 'all';
  if (s.kind === 'equation' || s.kind === 'or') {
    for (const q of s.kind === 'equation' ? [s.eq] : s.eqs) {
      const r = rootsOfEquation(q.lhs, q.rhs);
      if (r === 'all') return 'all';
      vals.push(...r);
    }
  }
  vals = vals.sort((p, q) => p - q).filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]!) > 1e-7);
  return vals.map((v) => v.toFixed(6)).join(',');
}

// ---- properties -----------------------------------------------------------------------------

const small = fc.integer({ min: -9, max: 9 });
const nz = small.filter((n) => n !== 0);

describe('T4 properties', () => {
  it('rational roots: recovers planted roots of k(px − q)(rx − s) in several layouts', () => {
    fc.assert(
      fc.property(
        nz,
        fc.integer({ min: 1, max: 4 }),
        small,
        fc.integer({ min: 1, max: 4 }),
        small,
        fc.integer({ min: 0, max: 3 }),
        small,
        (k, p, q, r, s, layout, shift) => {
          // expand k(px − q)(rx − s) = A x² + B x + C exactly
          const A = k * p * r;
          const B = -k * (p * s + q * r);
          const C = k * q * s;
          const text = [
            `${A}x^2 + ${B}x + ${C} = 0`,
            `${A}x^2 + ${B}x = ${-C}`,
            `${A}x^2 + ${shift}x + ${C} = ${shift - B}x`,
            `${k}(${p}x - ${q})(${r}x - ${s}) = 0`,
          ][layout]!.replace(/\+ -/g, '- ');
          const sol = solve(text);
          expect(sol.status, `${text}: ${sol.reason}`).toBe('solved');
          const want = [Rational.of(q, p), Rational.of(s, r)]
            .sort((u, w) => u.cmp(w))
            .filter((u, i, a) => i === 0 || !u.eq(a[i - 1]!))
            .map(String);
          const got =
            sol.answer?.kind === 'roots' ? sol.answer.values.map(String) : sol.answer?.kind;
          expect(got, text).toEqual(want);
          const ctx = { problem: sol.problem!, vars: ['x'] };
          for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('any coefficients: answers match an independent floating-point solution', () => {
    fc.assert(
      fc.property(nz, small, small, (a, b, c) => {
        const text = `${a}x^2 + ${b}x + ${c} = 0`.replace(/\+ -/g, '- ');
        const sol = solve(text);
        expect(sol.status, `${text}: ${sol.reason}`).toBe('solved');
        const D = b * b - 4 * a * c;
        if (D < 0) expect(sol.answer?.kind).toBe('no-solution');
        else {
          const s = Math.sqrt(D);
          const want = [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((u, w) => u - w);
          const got = sol.answer?.kind === 'roots' ? sol.answer.values.map((v) => v.approx()) : [];
          expect(got.length).toBe(D === 0 ? 1 : 2);
          got.forEach((g, i) => expect(g).toBeCloseTo(want[D === 0 ? 0 : i]!, 9));
          expect(sol.steps.filter((st) => st.rule === 'check').length).toBe(got.length);
        }
      }),
      { numRuns: 800 },
    );
  });
});

// ---- mutation tests ------------------------------------------------------------------------

type Mutant = { name: string; rule: string; mutate: (s: Step) => Step };

const mapRhs = (s: Step, f: (e: Expr) => Expr): Step =>
  s.after.kind === 'equation'
    ? { ...s, after: { kind: 'equation', eq: { lhs: s.after.eq.lhs, rhs: f(s.after.eq.rhs) } } }
    : s;

const MUTANTS: Mutant[] = [
  {
    name: 'quadratic formula with +b instead of -b',
    rule: 'eq.quadratic-formula',
    mutate: (s) =>
      mapRhs(s, (e) =>
        e.k === 'div' && e.a.k === 'pm' && e.a.a.k === 'neg'
          ? { ...e, a: { ...e.a, a: e.a.a.a } }
          : e,
      ),
  },
  {
    name: 'dropping the ± (only one root)',
    rule: 'eq.evaluate-formula',
    mutate: (s) =>
      mapRhs(s, (e) => (e.k === 'div' && e.a.k === 'pm' ? { ...e, a: { ...e.a, k: 'add' } } : e)),
  },
  {
    name: 'dividing only the denominator when reducing',
    rule: 'eq.reduce-formula',
    mutate: (s) => {
      if (s.before.kind !== 'equation') return s;
      const before = s.before.eq.rhs;
      return mapRhs(s, (e) => (before.k === 'div' && e.k === 'div' ? { ...e, a: before.a } : e));
    },
  },
  {
    name: 'factor with the wrong sign',
    rule: 'eq.factorise',
    mutate: (s) => {
      if (s.after.kind !== 'equation') return s;
      const flip = (e: Expr): Expr =>
        e.k === 'sub' ? { ...e, k: 'add' } : e.k === 'add' ? { ...e, k: 'sub' } : e;
      const l = s.after.eq.lhs;
      const lhs: Expr =
        l.k === 'mul' ? { ...l, b: flip(l.b) } : l.k === 'pow' ? { ...l, a: flip(l.a) } : l;
      return { ...s, after: { kind: 'equation', eq: { lhs, rhs: s.after.eq.rhs } } };
    },
  },
  {
    name: 'wrong sign when solving a factor',
    rule: 'eq.solve-each',
    mutate: (s) => {
      if (s.after.kind !== 'or') return s;
      const [e0, e1] = s.after.eqs as [{ lhs: Expr; rhs: Expr }, { lhs: Expr; rhs: Expr }];
      return {
        ...s,
        after: { kind: 'or', eqs: [{ lhs: e0.lhs, rhs: { k: 'neg', a: e0.rhs } }, e1] },
      };
    },
  },
  {
    name: 'wrong discriminant value',
    rule: 'eq.discriminant',
    mutate: (s) =>
      s.info?.kind === 'discriminant'
        ? {
            ...s,
            info: {
              ...s.info,
              value: { k: 'add', a: s.info.value, b: { k: 'num', v: Rational.ONE } },
            },
          }
        : s,
  },
  {
    name: 'forgetting the negative root of x²',
    rule: 'eq.square-root-both',
    mutate: (s) => mapRhs(s, (e) => (e.k === 'pm' ? e.b : e)),
  },
];

describe('T4 mutation tests', () => {
  it.each(MUTANTS)('verifier stops: $name', (m) => {
    let wrongMutants = 0;
    for (const input of T4_GOLDEN) {
      let wrong = false;
      const sol = solve(input, {
        tamper: (s) => {
          if (s.rule !== m.rule || wrong) return s;
          const out = m.mutate(s);
          if (out === s) return s;
          if (out.info) wrong = true;
          else if (numericSet(out.before) !== numericSet(out.after)) wrong = true;
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
