// SPDX-License-Identifier: AGPL-3.0-or-later
// T3 strategy: linear equations in one unknown.

import type { Problem } from '../ast';
import { eqn, ratExpr, v } from '../ast';
import { Rational } from '../numbers/rational';
import { Surd } from '../numbers/surd';
import {
  isVarTerm,
  lcmOfDenominators,
  monosExpr,
  scaleMonos,
  sideMonos,
  swapSides,
  termsExpr,
} from '../rules/equation';
import type { Mono } from '../rules/poly';
import { decimalsToFractions } from '../rules/arith';
import { pushCheck } from './check';
import type { Run } from './run';
import { simplifyEquationSides } from './sides';

function current(run: Run): { L: Mono[]; R: Mono[] } | undefined {
  const s = run.state;
  if (s.kind !== 'equation') return undefined;
  const L = sideMonos(s.eq.lhs);
  const R = sideMonos(s.eq.rhs);
  return L && R
    ? { L: L.filter((m) => !m.c.isZero()), R: R.filter((m) => !m.c.isZero()) }
    : undefined;
}

/** Replace decimals on both sides by fractions in one step. */
export function convertDecimals(run: Run): void {
  const s = run.state;
  if (s.kind !== 'equation') return;
  const l = decimalsToFractions(s.eq.lhs);
  const r = decimalsToFractions(s.eq.rhs);
  if (!l && !r) return;
  run.push({
    after: { kind: 'equation', eq: eqn(l?.expr ?? s.eq.lhs, r?.expr ?? s.eq.rhs) },
    rule: 'arith.decimals',
    explain: { key: 'arith.decimals' },
    highlight: [
      ...(l?.paths ?? []).map((p) => ['lhs', ...p]),
      ...(r?.paths ?? []).map((p) => ['rhs', ...p]),
    ],
  });
}

/** Bring a simplified equation to "ax = d" (or "0 = d"); shared with T4's linear fallback. */
export function clearFractionsAndCollect(run: Run, vars: readonly string[]): void {
  const x = vars[0]!;
  convertDecimals(run);
  simplifyEquationSides(run, vars);
  let cur = current(run);
  if (!cur) return;
  // Clear fractions.
  const den = Rational.of(lcmOfDenominators([...cur.L, ...cur.R]));
  if (!den.isOne()) {
    run.push({
      after: {
        kind: 'equation',
        eq: eqn(monosExpr(scaleMonos(cur.L, den)), monosExpr(scaleMonos(cur.R, den))),
      },
      rule: 'eq.multiply-lcd',
      explain: { key: 'eq.multiply-lcd', params: { lcd: den.toString() } },
      highlight: [['lhs'], ['rhs']],
    });
    cur = current(run)!;
  }
  // Unknown only on the right: swap sides.
  if (!cur.L.some(isVarTerm) && cur.R.some(isVarTerm) && run.state.kind === 'equation') {
    run.push({
      after: { kind: 'equation', eq: swapSides(run.state.eq) },
      rule: 'eq.swap',
      explain: { key: 'eq.swap' },
      highlight: [['lhs'], ['rhs']],
    });
    cur = current(run)!;
  }
  const VL = cur.L.filter(isVarTerm);
  const CL = cur.L.filter((m) => !isVarTerm(m));
  const VR = cur.R.filter(isVarTerm);
  const CR = cur.R.filter((m) => !isVarTerm(m));
  if (CL.length > 0 || VR.length > 0) {
    const neg1 = Rational.ONE.neg();
    run.push({
      after: {
        kind: 'equation',
        eq: eqn(
          termsExpr([...VL, ...scaleMonos(VR, neg1)]),
          termsExpr([...CR, ...scaleMonos(CL, neg1)]),
        ),
      },
      rule: 'eq.move-terms',
      explain: { key: 'eq.move-terms', params: { x: v(x) } },
      highlight: [['lhs'], ['rhs']],
    });
    simplifyEquationSides(run, vars);
  }
}

export function solveLinear(run: Run, problem: Problem, vars: readonly string[]): void {
  if (problem.kind !== 'equation') return;
  const x = vars[0]!;
  clearFractionsAndCollect(run, vars);
  finishLinear(run, problem, x);
}

/** From "ax = d" or "0 = d" to the answer, then check. */
export function finishLinear(run: Run, problem: Problem, x: string): void {
  if (problem.kind !== 'equation') return;
  const cur = current(run);
  if (!cur) return;
  if (cur.L.length === 0) {
    const d = cur.R[0]?.c ?? Rational.ZERO;
    if (d.isZero())
      run.push({
        after: { kind: 'all' },
        rule: 'eq.all-solutions',
        explain: { key: 'eq.all-solutions', params: { x: v(x) } },
      });
    else
      run.push({
        after: { kind: 'none' },
        rule: 'eq.no-solution',
        explain: { key: 'eq.no-solution', params: { x: v(x) } },
      });
    return;
  }
  if (cur.L.length !== 1 || cur.L[0]!.p.get(x) !== 1) return; // not linear: leave for the caller
  const a = cur.L[0]!.c;
  const d = cur.R[0]?.c ?? Rational.ZERO;
  if (!a.isOne()) {
    const value = d.div(a);
    run.push({
      after: { kind: 'equation', eq: eqn(v(x), ratExpr(value)) },
      rule: a.eq(Rational.ONE.neg()) ? 'eq.negate' : 'eq.divide',
      explain: a.eq(Rational.ONE.neg())
        ? { key: 'eq.negate' }
        : { key: 'eq.divide', params: { a: ratExpr(a) } },
      highlight: [['lhs'], ['rhs']],
    });
  }
  pushCheck(run, [problem.eq], { [x]: Surd.rational(d.div(a)) });
}
