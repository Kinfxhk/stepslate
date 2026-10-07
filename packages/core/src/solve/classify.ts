// SPDX-License-Identifier: AGPL-3.0-or-later
// Decide which kind of problem this is (T1–T5), or explain politely why it is not
// supported in this version.

import type { Equation, Expr, Problem } from '../ast';
import { hasVar, problemVariables } from '../ast';
import { LIMITS } from '../limits';
import type { Explanation } from '../state';
import { evalRational, Unverifiable } from '../verify/evaluate';
import { degreeBound, linearForm, univariateCoefficients } from '../verify/poly';
import { walk } from '../rules/tree';

export type ProblemType = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export type Classification =
  | { readonly ok: true; readonly type: ProblemType; readonly vars: readonly string[] }
  | { readonly ok: false; readonly status: 'unsupported' | 'error'; readonly message: Explanation };

const unsupported = (message: Explanation): Classification => ({
  ok: false,
  status: 'unsupported',
  message,
});
const error = (message: Explanation): Classification => ({ ok: false, status: 'error', message });

function exprs(p: Problem): Expr[] {
  if (p.kind === 'expr') return [p.expr];
  const eqs: readonly Equation[] = p.kind === 'equation' ? [p.eq] : p.eqs;
  return eqs.flatMap((q) => [q.lhs, q.rhs]);
}

function structural(e: Expr): Classification | null {
  let problem: Classification | null = null;
  walk(e, (n) => {
    if (problem) return;
    if (n.k === 'sqrt') problem = unsupported({ key: 'unsupported.root' });
    else if (n.k === 'pm') problem = unsupported({ key: 'unsupported.pm' });
    else if (n.k === 'pow') {
      const b = n.b;
      if (!(
        b.k === 'num' &&
        b.text === undefined &&
        b.v.isInteger() &&
        b.v.n <= BigInt(LIMITS.maxExponent)
      ))
        problem = unsupported({ key: 'unsupported.exponent', params: { max: LIMITS.maxExponent } });
    } else if (n.k === 'div') {
      if (hasVar(n.b)) problem = unsupported({ key: 'unsupported.var-denominator' });
      else {
        try {
          if (evalRational(n.b, new Map()).isZero()) problem = error({ key: 'error.div-zero' });
        } catch {
          problem = error({ key: 'error.div-zero' });
        }
      }
    }
  });
  return problem;
}

export function classify(p: Problem): Classification {
  for (const e of exprs(p)) {
    const s = structural(e);
    if (s) return s;
  }
  for (const e of exprs(p)) {
    try {
      if (degreeBound(e) > LIMITS.maxDegree)
        return unsupported({ key: 'unsupported.degree', params: { max: LIMITS.maxDegree } });
    } catch (err) {
      if (err instanceof Unverifiable) return unsupported({ key: 'unsupported.var-denominator' });
      throw err;
    }
  }
  const vars = problemVariables(p);
  if (p.kind === 'expr') {
    if (vars.length === 0) return { ok: true, type: 'T1', vars };
    if (vars.length > 2) return unsupported({ key: 'unsupported.too-many-vars' });
    return { ok: true, type: 'T2', vars };
  }
  if (p.kind === 'equation') {
    if (vars.length === 0) return unsupported({ key: 'unsupported.no-unknown' });
    if (vars.length > 1)
      return unsupported({ key: 'unsupported.equation-vars', params: { n: vars.length } });
    const coeffs = univariateCoefficients({ k: 'sub', a: p.eq.lhs, b: p.eq.rhs }, vars[0]!);
    const deg = coeffs.length - 1;
    if (deg > 2)
      return unsupported({ key: 'unsupported.degree', params: { max: LIMITS.maxDegree } });
    return { ok: true, type: deg === 2 ? 'T4' : 'T3', vars };
  }
  // system
  if (p.eqs.length !== 2 || vars.length !== 2) return unsupported({ key: 'unsupported.system' });
  for (const q of p.eqs) {
    try {
      linearForm({ k: 'sub', a: q.lhs, b: q.rhs }, vars[0]!, vars[1]!);
    } catch (err) {
      if (err instanceof Unverifiable) return unsupported({ key: 'unsupported.system' });
      throw err;
    }
  }
  return { ok: true, type: 'T5', vars };
}
