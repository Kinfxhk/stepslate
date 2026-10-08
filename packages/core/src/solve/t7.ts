// SPDX-License-Identifier: AGPL-3.0-or-later
// T7 strategy: linear inequalities in one unknown.
// Every step keeps the same solution set, and (unless it only concludes "all" or
// "none") is a non-zero constant multiple of the previous difference. Multiplying
// by a negative number flips the sign; the verifier rejects a missed flip.

import type { Problem, Rel } from '../ast';
import { ratExpr, v } from '../ast';
import { Rational } from '../numbers/rational';
import { decimalsToFractions } from '../rules/arith';
import {
  isVarTerm,
  lcmOfDenominators,
  monosExpr,
  scaleMonos,
  sideMonos,
  termsExpr,
} from '../rules/equation';
import type { Mono } from '../rules/poly';
import { nextPolyStep } from '../rules/poly';
import { diffPaths } from '../rules/tree';
import type { Run } from './run';
import { explanationOf } from './sides';

function flip(rel: Rel): Rel {
  switch (rel) {
    case '<':
      return '>';
    case '<=':
      return '>=';
    case '>':
      return '<';
    case '>=':
      return '<=';
  }
}

function sides(run: Run): { L: Mono[]; R: Mono[]; rel: Rel } | undefined {
  const s = run.state;
  if (s.kind !== 'inequality') return undefined;
  const L = sideMonos(s.lhs);
  const R = sideMonos(s.rhs);
  if (!L || !R) return undefined;
  return {
    L: L.filter((m) => !m.c.isZero()),
    R: R.filter((m) => !m.c.isZero()),
    rel: s.rel,
  };
}

function simplifySides(run: Run, vars: readonly string[]): void {
  for (const side of ['lhs', 'rhs'] as const) {
    for (let guard = 0; guard < 200; guard++) {
      const s = run.state;
      if (s.kind !== 'inequality') return;
      const cur = s[side];
      const d = nextPolyStep(cur, vars);
      if (!d) break;
      const paths = d.paths ?? diffPaths(cur, d.expr);
      run.push({
        after: {
          kind: 'inequality',
          rel: s.rel,
          lhs: side === 'lhs' ? d.expr : s.lhs,
          rhs: side === 'rhs' ? d.expr : s.rhs,
        },
        rule: d.rule,
        explain: explanationOf(d.key, d.params),
        highlight: paths.map((p) => [side, ...p]),
      });
    }
  }
}

function convertDecimals(run: Run): void {
  const s = run.state;
  if (s.kind !== 'inequality') return;
  const l = decimalsToFractions(s.lhs);
  const r = decimalsToFractions(s.rhs);
  if (!l && !r) return;
  run.push({
    after: {
      kind: 'inequality',
      rel: s.rel,
      lhs: l?.expr ?? s.lhs,
      rhs: r?.expr ?? s.rhs,
    },
    rule: 'arith.decimals',
    explain: { key: 'arith.decimals' },
    highlight: [
      ...(l?.paths ?? []).map((p) => ['lhs', ...p]),
      ...(r?.paths ?? []).map((p) => ['rhs', ...p]),
    ],
  });
}

function sumConst(ms: readonly Mono[]): Rational {
  let c = Rational.ZERO;
  for (const m of ms) c = c.add(m.c);
  return c;
}

/** True when 0 rel d. */
function constantHolds(rel: Rel, d: Rational): boolean {
  const s = d.sign();
  if (rel === '<') return s > 0;
  if (rel === '<=') return s >= 0;
  if (rel === '>') return s < 0;
  return s <= 0;
}

function concludeConstant(run: Run, rel: Rel, d: Rational, x: string, named: boolean): void {
  const holds = constantHolds(rel, d);
  run.push({
    after: { kind: holds ? 'all' : 'none' },
    rule: holds ? 'ineq.all-solutions' : 'ineq.no-solution',
    explain: named
      ? { key: holds ? 'ineq.all-solutions' : 'ineq.no-solution', params: { x: v(x) } }
      : { key: holds ? 'ineq.all-const' : 'ineq.none-const' },
  });
}

export function solveLinearInequality(run: Run, problem: Problem, vars: readonly string[]): void {
  if (problem.kind !== 'inequality') return;
  const x = vars[0] ?? 'x';
  const named = vars.length > 0;
  convertDecimals(run);
  simplifySides(run, vars);
  let cur = sides(run);
  if (!cur) return;

  const den = Rational.of(lcmOfDenominators([...cur.L, ...cur.R]));
  if (!den.isOne()) {
    run.push({
      after: {
        kind: 'inequality',
        rel: cur.rel,
        lhs: monosExpr(scaleMonos(cur.L, den)),
        rhs: monosExpr(scaleMonos(cur.R, den)),
      },
      rule: 'eq.multiply-lcd',
      explain: { key: 'eq.multiply-lcd', params: { lcd: den.toString() } },
      highlight: [['lhs'], ['rhs']],
    });
    cur = sides(run);
    if (!cur) return;
  }

  if (!cur.L.some(isVarTerm) && !cur.R.some(isVarTerm)) {
    concludeConstant(run, cur.rel, sumConst(cur.R).sub(sumConst(cur.L)), x, named);
    return;
  }

  if (!cur.L.some(isVarTerm) && cur.R.some(isVarTerm)) {
    const s = run.state;
    if (s.kind !== 'inequality') return;
    run.push({
      after: { kind: 'inequality', rel: flip(s.rel), lhs: s.rhs, rhs: s.lhs },
      rule: 'ineq.swap',
      explain: { key: 'ineq.swap' },
      highlight: [['lhs'], ['rhs']],
    });
    cur = sides(run);
    if (!cur) return;
  }

  const VL = cur.L.filter(isVarTerm);
  const CL = cur.L.filter((m) => !isVarTerm(m));
  const VR = cur.R.filter(isVarTerm);
  const CR = cur.R.filter((m) => !isVarTerm(m));
  if (CL.length > 0 || VR.length > 0) {
    const neg1 = Rational.ONE.neg();
    run.push({
      after: {
        kind: 'inequality',
        rel: cur.rel,
        lhs: termsExpr([...VL, ...scaleMonos(VR, neg1)]),
        rhs: termsExpr([...CR, ...scaleMonos(CL, neg1)]),
      },
      rule: 'ineq.move-terms',
      explain: { key: 'ineq.move-terms', params: { x: v(x) } },
      highlight: [['lhs'], ['rhs']],
    });
    simplifySides(run, vars);
    cur = sides(run);
    if (!cur) return;
  }

  if (!cur.L.some(isVarTerm)) {
    concludeConstant(run, cur.rel, sumConst(cur.R).sub(sumConst(cur.L)), x, named);
    return;
  }
  if (cur.L.length !== 1 || (cur.L[0]!.p.get(x) ?? 0) !== 1) return;
  const a = cur.L[0]!.c;
  const d = cur.R[0]?.c ?? Rational.ZERO;
  if (a.isZero()) {
    concludeConstant(run, cur.rel, d, x, named);
    return;
  }
  // "x rel number" is already the answer.
  if (a.isOne()) return;
  const bound = d.div(a);
  const rel = a.sign() < 0 ? flip(cur.rel) : cur.rel;
  const negative = a.sign() < 0;
  run.push({
    after: { kind: 'inequality', rel, lhs: v(x), rhs: ratExpr(bound) },
    rule: negative ? 'ineq.divide-negative' : 'ineq.divide',
    explain: negative
      ? { key: 'ineq.divide-negative', params: { a: ratExpr(a) } }
      : { key: 'ineq.divide', params: { a: ratExpr(a) } },
    highlight: [['lhs'], ['rhs']],
  });
}
