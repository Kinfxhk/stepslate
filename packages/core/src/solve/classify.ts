// SPDX-License-Identifier: AGPL-3.0-or-later
// Decide which kind of problem this is (T1–T5), or explain politely why it is not
// supported in this version.

import type { Equation, Expr, Problem } from '../ast';
import { hasVar, problemVariables } from '../ast';
import { LIMITS } from '../limits';
import type { Command } from '../parse/lexer';
import type { Rational } from '../numbers/rational';
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

/** Whole-number literal exponent, possibly negative ("2^-3"), or undefined. */
function literalExponent(b: Expr): bigint | undefined {
  if (b.k === 'num' && b.text === undefined && b.v.isInteger()) return b.v.n;
  if (b.k === 'neg' && b.a.k === 'num' && b.a.text === undefined && b.a.v.isInteger())
    return -b.a.v.n;
  return undefined;
}

const bitLength = (n: bigint): number => (n < 0n ? -n : n).toString(2).length;
const tooBig = (q: Rational): boolean => Math.max(bitLength(q.n), bitLength(q.d)) > LIMITS.maxBits;

/**
 * Evaluate a number-only problem with a size guard, so that powers such as 9^20^20
 * are refused politely before any big number is built.
 */
function arithmeticSize(e: Expr): 'ok' | 'too-large' | 'div-zero' {
  class Stop extends Error {
    constructor(readonly why: 'too-large' | 'div-zero') {
      super(why);
    }
  }
  const val = (n: Expr): Rational => {
    let out: Rational;
    switch (n.k) {
      case 'num':
        out = n.v;
        break;
      case 'neg':
        out = val(n.a).neg();
        break;
      case 'add':
        out = val(n.a).add(val(n.b));
        break;
      case 'sub':
        out = val(n.a).sub(val(n.b));
        break;
      case 'mul':
        out = val(n.a).mul(val(n.b));
        break;
      case 'div': {
        const d = val(n.b);
        if (d.isZero()) throw new Stop('div-zero');
        out = val(n.a).div(d);
        break;
      }
      case 'pow': {
        const b = val(n.a);
        const k = Number(literalExponent(n.b) ?? 0n);
        if (k < 0 && b.isZero()) throw new Stop('div-zero');
        if (Math.max(bitLength(b.n), bitLength(b.d)) * Math.abs(k) > LIMITS.maxBits + 64)
          throw new Stop('too-large');
        out = b.pow(k);
        break;
      }
      default:
        throw new Stop('too-large'); // not reached: checked by structural()
    }
    if (tooBig(out)) throw new Stop('too-large');
    return out;
  };
  try {
    val(e);
    return 'ok';
  } catch (err) {
    if (err instanceof Stop) return err.why;
    throw err;
  }
}

function structural(e: Expr, arithmetic: boolean): Classification | null {
  let problem: Classification | null = null;
  walk(e, (n) => {
    if (problem) return;
    if (n.k === 'sqrt') problem = unsupported({ key: 'unsupported.root' });
    else if (n.k === 'pm') problem = unsupported({ key: 'unsupported.pm' });
    else if (n.k === 'pow' && arithmetic) {
      const k = literalExponent(n.b);
      const max = BigInt(LIMITS.maxArithmeticExponent);
      if (k === undefined || k > max || k < -max)
        problem = unsupported({
          key: 'unsupported.exponent-arith',
          params: { max: LIMITS.maxArithmeticExponent },
        });
    } else if (arithmetic && n.k === 'div') {
      // checked exactly (with a size guard) by arithmeticSize()
    } else if (n.k === 'pow') {
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

/** Check that an optional command fits the problem ("solve" needs an equation, ...). */
function commandCheck(command: Command | undefined, p: Problem): Classification | null {
  if (command === 'factor' && p.kind === 'expr') return unsupported({ key: 'unsupported.factor' });
  if (command === 'solve' && p.kind === 'expr')
    return error({ key: 'command.solve-needs-equation' });
  if (command === 'simplify' && p.kind !== 'expr')
    return error({ key: 'command.simplify-needs-expression' });
  return null;
}

export function classify(p: Problem, command?: Command): Classification {
  const c = commandCheck(command, p);
  if (c) return c;
  const arithmetic = p.kind === 'expr' && !hasVar(p.expr);
  for (const e of exprs(p)) {
    const s = structural(e, arithmetic);
    if (s) return s;
  }
  if (arithmetic) {
    const size = arithmeticSize(p.expr);
    if (size === 'div-zero') return error({ key: 'error.div-zero' });
    if (size === 'too-large') return error({ key: 'error.too-large' });
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
