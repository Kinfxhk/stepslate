// SPDX-License-Identifier: AGPL-3.0-or-later
// Helpers for equation rules: monomial lists per side, values as expressions.

import type { Equation, Expr } from '../ast';
import { div, eqn, mul, neg, num, ratExpr, sqrt, sub, add } from '../ast';
import { abs, lcm } from '../numbers/bigint';
import { Rational } from '../numbers/rational';
import type { Surd } from '../numbers/surd';
import { degree, monoTerm, buildSum, readCanonical, type Mono } from './poly';

export function sideMonos(e: Expr): Mono[] | undefined {
  return readCanonical(e);
}

export function scaleMonos(ms: readonly Mono[], k: Rational): Mono[] {
  return ms.map((m) => ({ c: m.c.mul(k), p: m.p }));
}

export function monosExpr(ms: readonly Mono[]): Expr {
  const live = ms.filter((m) => !m.c.isZero());
  return buildSum(live.map(monoTerm));
}

/** Like monosExpr, but keeps every term as written (used to show moved terms). */
export function termsExpr(ms: readonly Mono[]): Expr {
  return ms.length === 0 ? num(0) : buildSum(ms.map(monoTerm));
}

export function lcmOfDenominators(ms: readonly Mono[]): bigint {
  let L = 1n;
  for (const m of ms) L = lcm(L, m.c.d);
  return L;
}

export const isVarTerm = (m: Mono): boolean => degree(m.p) > 0;

/** An exact value a + b√r as a readable expression: 3, -3/4, 2√3, (5 + √13)/2. */
export function surdExpr(s: Surd): Expr {
  if (s.isRational()) return ratExpr(s.a);
  const d = lcm(s.a.d, s.b.d);
  const p = s.a.mul(Rational.of(d)).n; // integer
  const q = s.b.mul(Rational.of(d)).n; // integer, non-zero
  const root = sqrt(num(s.r));
  const qAbs = abs(q);
  const rootTerm = qAbs === 1n ? root : mul(num(qAbs), root, true);
  let numerator: Expr;
  if (p === 0n) numerator = q < 0n ? neg(rootTerm) : rootTerm;
  else {
    const pe = ratExpr(Rational.of(p));
    numerator = q < 0n ? sub(pe, rootTerm) : add(pe, rootTerm);
  }
  return d === 1n ? numerator : div(numerator, num(d));
}

export function swapSides(q: Equation): Equation {
  return eqn(q.rhs, q.lhs);
}
