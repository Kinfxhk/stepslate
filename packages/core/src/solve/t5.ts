// SPDX-License-Identifier: AGPL-3.0-or-later
// T5 strategy: two linear equations in two unknowns, by elimination. Every system step
// carries a row-operation matrix that the verifier checks (plus the solution set).

import type { Equation, Expr, Problem } from '../ast';
import { eqn, mul, ratExpr, v } from '../ast';
import { abs, lcm } from '../numbers/bigint';
import { Rational } from '../numbers/rational';
import { Surd } from '../numbers/surd';
import { decimalsToFractions } from '../rules/arith';
import {
  isVarTerm,
  lcmOfDenominators,
  monosExpr,
  scaleMonos,
  sideMonos,
  termsExpr,
} from '../rules/equation';
import { buildSum, monoTerm, nextPolyStep, type Mono, type SignedTerm } from '../rules/poly';
import { diffPaths } from '../rules/tree';
import type { Explanation, Matrix2, Path } from '../state';
import { pushCheck } from './check';
import type { Run } from './run';
import { explanationOf } from './sides';

const R0 = Rational.ZERO;
const R1 = Rational.ONE;
const IDENTITY: Matrix2 = [
  [R1, R0],
  [R0, R1],
];

function diag(i: number, k: Rational): Matrix2 {
  return i === 0
    ? [
        [k, R0],
        [R0, R1],
      ]
    : [
        [R1, R0],
        [R0, k],
      ];
}

function eqs(run: Run): Equation[] {
  const s = run.state;
  return s.kind === 'system' ? [...s.eqs] : [];
}

function pushSys(
  run: Run,
  next: Equation[],
  explain: Explanation,
  highlight: Path[],
  matrix: Matrix2 = IDENTITY,
): void {
  run.push({
    after: { kind: 'system', eqs: next },
    rule: explain.key,
    explain,
    highlight,
    matrix,
  });
}

function replaceEq(run: Run, i: number, q: Equation): Equation[] {
  const next = eqs(run);
  next[i] = q;
  return next;
}

function decimals(run: Run): void {
  const cur = eqs(run);
  const paths: Path[] = [];
  let changed = false;
  const next = cur.map((q, i) => {
    const l = decimalsToFractions(q.lhs);
    const r = decimalsToFractions(q.rhs);
    if (l || r) changed = true;
    paths.push(...(l?.paths ?? []).map((p) => ['eqs', i, 'lhs', ...p]));
    paths.push(...(r?.paths ?? []).map((p) => ['eqs', i, 'rhs', ...p]));
    return eqn(l?.expr ?? q.lhs, r?.expr ?? q.rhs);
  });
  if (changed) pushSys(run, next, { key: 'arith.decimals' }, paths);
}

function simplifyEq(run: Run, i: number, vars: readonly string[]): void {
  for (const side of ['lhs', 'rhs'] as const) {
    for (let guard = 0; guard < 200; guard++) {
      const q = eqs(run)[i];
      if (!q) return;
      const d = nextPolyStep(q[side], vars);
      if (!d) break;
      const paths = d.paths ?? diffPaths(q[side], d.expr);
      const nq = side === 'lhs' ? eqn(d.expr, q.rhs) : eqn(q.lhs, d.expr);
      pushSys(
        run,
        replaceEq(run, i, nq),
        explanationOf(d.key, d.params),
        paths.map((p) => ['eqs', i, side, ...p]),
      );
    }
  }
}

function monos(q: Equation): { L: Mono[]; R: Mono[] } {
  const live = (ms: Mono[] | undefined) => (ms ?? []).filter((m) => !m.c.isZero());
  return { L: live(sideMonos(q.lhs)), R: live(sideMonos(q.rhs)) };
}

/** Bring equation i to "ax + by = c" with integer coefficients. */
function standardForm(run: Run, i: number, vars: readonly string[], clearFractions = true): void {
  simplifyEq(run, i, vars);
  let { L, R } = monos(eqs(run)[i]!);
  const VL = L.filter(isVarTerm);
  const CL = L.filter((m) => !isVarTerm(m));
  const VR = R.filter(isVarTerm);
  const CR = R.filter((m) => !isVarTerm(m));
  if (CL.length > 0 || VR.length > 0) {
    const neg1 = R1.neg();
    pushSys(
      run,
      replaceEq(
        run,
        i,
        eqn(
          termsExpr([...VL, ...scaleMonos(VR, neg1)]),
          termsExpr([...CR, ...scaleMonos(CL, neg1)]),
        ),
      ),
      { key: 'sys.move-terms', params: { i: i + 1, x: v(vars[0]!), y: v(vars[1]!) } },
      [
        ['eqs', i, 'lhs'],
        ['eqs', i, 'rhs'],
      ],
    );
    simplifyEq(run, i, vars);
    ({ L, R } = monos(eqs(run)[i]!));
  }
  const den = Rational.of(lcmOfDenominators([...L, ...R]));
  if (clearFractions && !den.isOne())
    pushSys(
      run,
      replaceEq(run, i, eqn(monosExpr(scaleMonos(L, den)), monosExpr(scaleMonos(R, den)))),
      { key: 'sys.multiply-lcd', params: { i: i + 1, lcd: den.toString() } },
      [
        ['eqs', i, 'lhs'],
        ['eqs', i, 'rhs'],
      ],
      diag(i, den),
    );
}

interface Row {
  readonly a: Rational;
  readonly b: Rational;
  readonly c: Rational;
}

function rowOf(q: Equation, x: string, y: string): Row {
  const { L, R } = monos(q);
  const co = (ms: Mono[], name: string | undefined) => {
    let s = R0;
    for (const m of ms)
      if (name === undefined ? m.p.size === 0 : m.p.size === 1 && m.p.get(name) === 1)
        s = s.add(m.c);
    return s;
  };
  return { a: co(L, x), b: co(L, y), c: co(R, undefined) };
}

function rowEq(r: Row, x: string, y: string): Equation {
  const ms: Mono[] = [];
  if (!r.a.isZero()) ms.push({ c: r.a, p: new Map([[x, 1]]) });
  if (!r.b.isZero()) ms.push({ c: r.b, p: new Map([[y, 1]]) });
  return eqn(monosExpr(ms), ratExpr(r.c));
}

/** If an equation has no unknown left, finish (no solution / infinitely many). */
function concludeIfDegenerate(run: Run, x: string, y: string): boolean {
  const cur = eqs(run);
  const rows = cur.map((q) => rowOf(q, x, y));
  const dead = rows.map((r) => r.a.isZero() && r.b.isZero());
  const k = dead.findIndex((d, i) => d && !rows[i]!.c.isZero());
  if (k >= 0) {
    run.push({
      after: { kind: 'none' },
      rule: 'sys.no-solution',
      explain: { key: 'sys.no-solution' },
    });
    return true;
  }
  if (dead[0] && dead[1]) {
    run.push({ after: { kind: 'all' }, rule: 'sys.all', explain: { key: 'sys.all' } });
    return true;
  }
  const z = dead.indexOf(true);
  if (z >= 0) {
    run.push({
      after: { kind: 'infinite', eq: cur[1 - z]! },
      rule: 'sys.infinite',
      explain: { key: 'sys.infinite' },
    });
    return true;
  }
  return false;
}

const single = (r: Row): 'a' | 'b' | undefined =>
  r.a.isZero() === r.b.isZero() ? undefined : r.a.isZero() ? 'b' : 'a';

/** Value expression shown when substituting: 3(−2), 3 × 2, (−2). */
function substitutedTerm(coef: Rational, value: Rational): SignedTerm {
  const val = ratExpr(value);
  const mag = coef.abs();
  const term: Expr = mag.isOne() ? val : mul(ratExpr(mag), val);
  return { sign: coef.sign() < 0 ? -1 : 1, term };
}

export function solveSystem(run: Run, problem: Problem, vars: readonly string[]): void {
  if (problem.kind !== 'system') return;
  const [x, y] = vars as [string, string];
  const name = (k: 'a' | 'b') => (k === 'a' ? x : y);

  decimals(run);
  standardForm(run, 0, vars);
  standardForm(run, 1, vars);
  if (concludeIfDegenerate(run, x, y)) return;

  let rows = eqs(run).map((q) => rowOf(q, x, y)) as [Row, Row];
  let k: 0 | 1 | undefined = single(rows[0]) ? 0 : single(rows[1]) ? 1 : undefined;

  if (k === undefined) {
    // Eliminate one unknown: make its coefficients equal in size, then add or subtract.
    const cost = (key: 'a' | 'b') => {
      const p = abs(rows[0][key].n);
      const q = abs(rows[1][key].n);
      const L = lcm(p, q);
      return { key, m0: L / p, m1: L / q, opposite: rows[0][key].sign() !== rows[1][key].sign() };
    };
    const cx = cost('a');
    const cy = cost('b');
    const sx = cx.m0 + cx.m1;
    const sy = cy.m0 + cy.m1;
    const pick = sx < sy ? cx : sy < sx ? cy : cx.opposite && !cy.opposite ? cx : cy;
    const w = v(name(pick.key));
    if (pick.m0 !== 1n || pick.m1 !== 1n) {
      const m0 = Rational.of(pick.m0);
      const m1 = Rational.of(pick.m1);
      const scaled = rows.map((r, i) => {
        const m = i === 0 ? m0 : m1;
        return { a: r.a.mul(m), b: r.b.mul(m), c: r.c.mul(m) };
      });
      const both = pick.m0 !== 1n && pick.m1 !== 1n;
      const i = pick.m0 !== 1n ? 0 : 1;
      pushSys(
        run,
        scaled.map((r) => rowEq(r, x, y)),
        both
          ? { key: 'sys.scale-both', params: { m1: m0.toString(), m2: m1.toString(), v: w } }
          : { key: 'sys.scale-one', params: { i: i + 1, m: (i === 0 ? m0 : m1).toString(), v: w } },
        both
          ? [
              ['eqs', 0],
              ['eqs', 1],
            ]
          : [['eqs', i]],
        [
          [m0, R0],
          [R0, m1],
        ],
      );
      rows = eqs(run).map((q) => rowOf(q, x, y)) as [Row, Row];
    }
    const sign = pick.opposite ? R1 : R1.neg();
    const combined: Row = {
      a: rows[1].a.add(sign.mul(rows[0].a)),
      b: rows[1].b.add(sign.mul(rows[0].b)),
      c: rows[1].c.add(sign.mul(rows[0].c)),
    };
    pushSys(
      run,
      [eqs(run)[0]!, rowEq(combined, x, y)],
      { key: pick.opposite ? 'sys.add' : 'sys.subtract', params: { i: 2, j: 1, v: w } },
      [['eqs', 1]],
      [
        [R1, R0],
        [sign, R1],
      ],
    );
    if (concludeIfDegenerate(run, x, y)) return;
    rows = eqs(run).map((q) => rowOf(q, x, y)) as [Row, Row];
    k = 1;
  }

  // Row k has one unknown u: solve it, substitute into the other row, solve that.
  const solveRow = (i: number): void => {
    const r = eqs(run).map((q) => rowOf(q, x, y))[i]!;
    const key = single(r)!;
    const alpha = r[key];
    if (alpha.isOne()) return;
    const next = replaceEq(
      run,
      i,
      rowEq({ a: r.a.div(alpha), b: r.b.div(alpha), c: r.c.div(alpha) }, x, y),
    );
    pushSys(
      run,
      next,
      alpha.eq(R1.neg())
        ? { key: 'sys.negate', params: { i: i + 1 } }
        : { key: 'sys.divide', params: { i: i + 1, a: ratExpr(alpha) } },
      [['eqs', i]],
      diag(i, R1.div(alpha)),
    );
  };
  solveRow(k);
  const j: 0 | 1 = k === 0 ? 1 : 0;
  rows = eqs(run).map((q) => rowOf(q, x, y)) as [Row, Row];
  const uKey = single(rows[k])!;
  const value = rows[k].c;
  const beta = rows[j][uKey];
  if (!beta.isZero()) {
    const target = eqs(run)[j]!;
    const { L } = monos(target);
    const u = name(uKey);
    const terms: SignedTerm[] = L.map((m) =>
      m.p.get(u) === 1 ? substitutedTerm(m.c, value) : monoTerm(m),
    );
    const m: Matrix2 =
      j === 0
        ? [
            [R1, beta.neg()],
            [R0, R1],
          ]
        : [
            [R1, R0],
            [beta.neg(), R1],
          ];
    pushSys(
      run,
      replaceEq(run, j, eqn(buildSum(terms), target.rhs)),
      { key: 'sys.substitute', params: { i: j + 1, value: eqs(run)[k]! } },
      [['eqs', j, 'lhs']],
      m,
    );
    standardForm(run, j, vars, false);
    if (concludeIfDegenerate(run, x, y)) return;
  }
  solveRow(j);

  // Answer with x first.
  rows = eqs(run).map((q) => rowOf(q, x, y)) as [Row, Row];
  if (single(rows[0]) === 'b') {
    const cur = eqs(run);
    pushSys(
      run,
      [cur[1]!, cur[0]!],
      { key: 'sys.order', params: { x: v(x) } },
      [],
      [
        [R0, R1],
        [R1, R0],
      ],
    );
    rows = [rows[1], rows[0]];
  }
  pushCheck(run, problem.eqs, { [x]: Surd.rational(rows[0].c), [y]: Surd.rational(rows[1].c) });
}
