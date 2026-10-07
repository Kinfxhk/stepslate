// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  Rational,
  solutionText,
  solve,
  verifyStep,
  type Equation,
  type Expr,
  type State,
  type Step,
} from '../src/index';
import { approx } from './approx';

export const T5_GOLDEN = [
  'x+y=5; x-y=1',
  'x+y=10; x-y=2',
  '2x+y=7; x-y=2',
  '2x+3y=12; x-y=1',
  '3x+2y=16; 5x-3y=14',
  '4x-3y=1; 2x+5y=7',
  '5x+2y=1; 3x+4y=9',
  '2x-y=0; x+y=6',
  'x-2y=-1; 3x+y=11',
  'x=2; x+y=5',
  'y=3; 2x-y=1',
  'x=1; y=-2',
  '2x=6; x+3y=9',
  'y=2x+1; 3x+y=11',
  'y=x-1; y=-x+5',
  'x=3y; x+y=8',
  '2(x+1)=y; 3x-2y=-5',
  '3(x-y)=6; x+2y=8',
  'x+y-3=0; 2x-y=0',
  'x/2+y/3=2; x-y=-1',
  'x/3-y/4=1; x+y=10',
  '(x+y)/2=3; x-y=2',
  '0.5x+y=3; x-0.2y=1',
  '1.5x-y=2; x+0.5y=6',
  'x+y=1; x-y=0',
  '2x+4y=3; 3x-2y=1',
  '7x+3y=1; 2x+5y=12',
  '-x+y=4; x+y=2',
  '6x-4y=2; 9x+2y=13',
  '3y+2x=12; y-x=-1',
  'x+y=2; 2x+2y=4',
  'x+y=2; x+y=3',
  '2x-y=1; 4x-2y=2',
  '2x-y=1; 4x-2y=5',
  '2x-4y=6; x-2y=3',
  'a+b=10; a-b=4',
  'm+2n=7; 2m-n=4',
  'p=2q; p+q=9',
  'x+2y=0; 3x-y=0',
  '5x-y=3; 10x-2y=7',
  'x-y=1; y-x=-1',
];

describe('T5 golden solutions', () => {
  it(`has at least 40 problems (${T5_GOLDEN.length})`, () =>
    expect(T5_GOLDEN.length).toBeGreaterThanOrEqual(40));
  it.each(T5_GOLDEN)('%s', (input) => {
    const sol = solve(input);
    expect(sol.status, sol.reason).toBe('solved');
    expect(sol.type).toBe('T5');
    expect(['pair', 'no-solution', 'infinitely-many']).toContain(sol.answer?.kind);
    if (sol.answer?.kind === 'pair') expect(sol.steps.at(-1)?.rule).toBe('check');
    // every step between two systems carries an invertible row-operation matrix
    for (const st of sol.steps)
      if (!st.info && st.before.kind === 'system' && st.after.kind === 'system')
        expect(st.matrix).toBeDefined();
    expect(solutionText(sol, 'en')).toMatchSnapshot();
    expect(solutionText(sol, 'zh-HK')).toMatchSnapshot();
  });
  it('gives the expected answers', () => {
    const ans = (s: string) => {
      const a = solve(s).answer;
      return a?.kind === 'pair' ? a.values.map(String) : a?.kind;
    };
    expect(ans('x+y=5; x-y=1')).toEqual(['3', '2']);
    expect(ans('3x+2y=16; 5x-3y=14')).toEqual(['4', '2']);
    expect(ans('0.5x+y=3; x-0.2y=1')).toEqual(['16/11', '25/11']);
    expect(ans('x+y=2; x+y=3')).toBe('no-solution');
    expect(ans('x+y=2; 2x+2y=4')).toBe('infinitely-many');
    expect(ans('2x-4y=6; x-2y=3')).toBe('infinitely-many');
    expect(solve('x=2; 2x=4').status).toBe('unsupported'); // only one unknown
  });
});

// ---- independent numeric solution sets (floating point; tests only) ---------------------

function line(q: Equation, x: string, y: string) {
  const f = (a: number, b: number) =>
    approx(q.lhs, { [x]: a, [y]: b }) - approx(q.rhs, { [x]: a, [y]: b });
  const c = f(0, 0);
  return { a: f(1, 0) - c, b: f(0, 1) - c, c: -c };
}

function numericSet2(s: State, x = 'x', y = 'y'): string {
  const tiny = (z: number) => Math.abs(z) < 1e-9;
  if (s.kind === 'none') return 'none';
  if (s.kind === 'all') return 'all';
  const rows = (
    s.kind === 'system' ? s.eqs : s.kind === 'infinite' || s.kind === 'equation' ? [s.eq] : []
  ).map((q) => line(q, x, y));
  const live = rows.filter((r) => !(tiny(r.a) && tiny(r.b)));
  if (rows.some((r) => tiny(r.a) && tiny(r.b) && !tiny(r.c))) return 'none';
  if (live.length === 0) return 'all';
  const norm = (r: { a: number; b: number; c: number }) => {
    const k = tiny(r.a) ? r.b : r.a;
    return `line:${(r.a / k).toFixed(6)},${(r.b / k).toFixed(6)},${(r.c / k).toFixed(6)}`;
  };
  if (live.length === 1) return norm(live[0]!);
  const [p, q] = live as [(typeof live)[0], (typeof live)[0]];
  const det = p.a * q.b - q.a * p.b;
  if (tiny(det)) {
    const consistent = tiny(p.a * q.c - q.a * p.c) && tiny(p.b * q.c - q.b * p.c);
    return consistent ? norm(p) : 'none';
  }
  return `(${((p.c * q.b - q.c * p.b) / det).toFixed(6)},${((p.a * q.c - q.a * p.c) / det).toFixed(6)})`;
}

// ---- properties ----------------------------------------------------------------------------

const small = fc.integer({ min: -9, max: 9 });

describe('T5 properties', () => {
  it('recovers a planted rational solution; every step is verified', () => {
    fc.assert(
      fc.property(
        fc.tuple(small, small, small, small).filter(([a, b, c, d]) => a * d - b * c !== 0),
        small,
        fc.integer({ min: 1, max: 3 }),
        small,
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 0, max: 2 }),
        ([a, b, c, d], xn, xd, yn, yd, layout) => {
          const X = Rational.of(xn, xd);
          const Y = Rational.of(yn, yd);
          const r1 = Rational.of(a).mul(X).add(Rational.of(b).mul(Y));
          const r2 = Rational.of(c).mul(X).add(Rational.of(d).mul(Y));
          const eq = (p: number, q: number, r: Rational) =>
            [
              `${p}x + ${q}y = ${r.toString()}`,
              `${p}x = ${r.toString()} - ${q}y`,
              `${q}y + ${p}x - ${r.toString()} = 0`,
            ][layout]!;
          const text = `${eq(a, b, r1)}; ${eq(c, d, r2)}`
            .replace(/\+ -/g, '- ')
            .replace(/- -/g, '+ ');
          const sol = solve(text);
          if (sol.status === 'unsupported') {
            // a zero coefficient can leave fewer than two unknowns in the problem
            expect(sol.vars.length).toBeLessThan(2);
            return;
          }
          expect(sol.status, `${text}: ${sol.reason}`).toBe('solved');
          if (sol.type !== 'T5') return; // e.g. "0x" removed an unknown
          expect(sol.answer?.kind, text).toBe('pair');
          if (sol.answer?.kind === 'pair') {
            expect(sol.answer.values[0].eq(X), text).toBe(true);
            expect(sol.answer.values[1].eq(Y), text).toBe(true);
          }
          const ctx = { problem: sol.problem!, vars: sol.vars };
          for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
        },
      ),
      { numRuns: 600 },
    );
  });

  it('dependent and inconsistent systems are recognised', () => {
    fc.assert(
      fc.property(
        fc.tuple(small, small).filter(([a, b]) => a !== 0 && b !== 0),
        small,
        fc.integer({ min: 2, max: 4 }),
        small,
        ([a, b], c, k, shift) => {
          const text = `${a}x + ${b}y = ${c}; ${k * a}x + ${k * b}y = ${k * c + shift}`.replace(
            /\+ -/g,
            '- ',
          );
          const sol = solve(text);
          expect(sol.status, `${text}: ${sol.reason}`).toBe('solved');
          expect(sol.answer?.kind, text).toBe(shift === 0 ? 'infinitely-many' : 'no-solution');
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ---- mutation tests ------------------------------------------------------------------------

type Mutant = { name: string; rules: string[]; mutate: (s: Step) => Step };

const mapEq = (
  s: Step,
  i: number,
  f: (q: Equation, before: Equation | undefined) => Equation,
): Step => {
  if (s.after.kind !== 'system') return s;
  const before = s.before.kind === 'system' ? s.before.eqs[i] : undefined;
  const eqs = s.after.eqs.map((q, j) => (j === i ? f(q, before) : q));
  return { ...s, after: { kind: 'system', eqs } };
};

const flipFirstOp = (e: Expr): Expr =>
  e.k === 'add' ? { ...e, k: 'sub' } : e.k === 'sub' ? { ...e, k: 'add' } : e;

const MUTANTS: Mutant[] = [
  {
    name: 'scaling only the left side of an equation',
    rules: ['sys.scale-one', 'sys.scale-both'],
    mutate: (s) => {
      const i = s.matrix?.[0]?.[0]?.isOne() ? 1 : 0;
      return mapEq(s, i, (q, b) => ({ lhs: q.lhs, rhs: b?.rhs ?? q.rhs }));
    },
  },
  {
    name: 'adding or subtracting the left sides only',
    rules: ['sys.add', 'sys.subtract'],
    mutate: (s) => mapEq(s, 1, (q, b) => ({ lhs: q.lhs, rhs: b?.rhs ?? q.rhs })),
  },
  {
    name: 'sign error when substituting',
    rules: ['sys.substitute'],
    mutate: (s) => {
      if (s.after.kind !== 'system' || s.before.kind !== 'system') return s;
      const i = s.after.eqs.findIndex(
        (q, j) => q !== (s.before as { eqs: readonly Equation[] }).eqs[j],
      );
      return i < 0 ? s : mapEq(s, i, (q) => ({ lhs: flipFirstOp(q.lhs), rhs: q.rhs }));
    },
  },
  {
    name: 'moving a term without changing its sign',
    rules: ['sys.move-terms'],
    mutate: (s) => {
      if (s.after.kind !== 'system' || s.before.kind !== 'system') return s;
      const i = s.after.eqs.findIndex(
        (q, j) => q !== (s.before as { eqs: readonly Equation[] }).eqs[j],
      );
      return i < 0 ? s : mapEq(s, i, (q) => ({ lhs: q.lhs, rhs: flipFirstOp(q.rhs) }));
    },
  },
  {
    name: 'check showing a wrong value',
    rules: ['check'],
    mutate: (s) =>
      s.info?.kind === 'substitute'
        ? {
            ...s,
            info: {
              ...s.info,
              rows: s.info.rows.map((r, i) =>
                i === 1
                  ? {
                      ...r,
                      rhsValue: {
                        k: 'add',
                        a: r.rhsValue,
                        b: { k: 'num', v: Rational.ONE },
                      } as Expr,
                    }
                  : r,
              ),
            },
          }
        : s,
  },
];

describe('T5 mutation tests', () => {
  it.each(MUTANTS)('verifier stops: $name', (m) => {
    let wrongMutants = 0;
    for (const input of T5_GOLDEN) {
      let wrong = false;
      const sol = solve(input, {
        tamper: (s) => {
          if (!m.rules.includes(s.rule) || wrong) return s;
          const out = m.mutate(s);
          if (out === s) return s;
          if (out.info) wrong = true;
          else {
            const vars = sol0vars(input);
            if (numericSet2(out.before, ...vars) !== numericSet2(out.after, ...vars)) wrong = true;
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

  it('a correct new system with a false row-operation certificate is rejected', () => {
    let tried = 0;
    for (const input of T5_GOLDEN) {
      let here = false;
      const sol = solve(input, {
        tamper: (s) => {
          if (s.rule !== 'sys.scale-one' && s.rule !== 'sys.scale-both') return s;
          here = true;
          // the equations are right, but the claimed matrix is the identity
          return {
            ...s,
            matrix: [
              [Rational.ONE, Rational.ZERO],
              [Rational.ZERO, Rational.ONE],
            ],
          };
        },
      });
      if (!here) continue;
      tried++;
      expect(sol.status, input).toBe('unverified');
      expect(sol.reason).toMatch(/combination/);
    }
    expect(tried).toBeGreaterThan(0);
  });
});

function sol0vars(input: string): [string, string] {
  const v = solve(input).vars;
  return [v[0] ?? 'x', v[1] ?? 'y'];
}
