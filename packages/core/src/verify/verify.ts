// SPDX-License-Identifier: AGPL-3.0-or-later
// The independent step verifier. A step is shown to the user only if verifyStep()
// accepts it. This module never imports the rule engine (packages/core/src/rules).

import type { Equation, Expr, Problem, Rel } from '../ast';
import { dropNegZero, exprEqual, substitute, variables } from '../ast';
import { Rational } from '../numbers/rational';
import type { State, Step } from '../state';
import { evalRational, evalSurd, Unverifiable } from './evaluate';
import {
  flipRel,
  linearRow,
  sameIneq,
  sameSet1,
  sameSet2,
  solutionSet1,
  solutionSet2,
  solutionSetIneq,
} from './oracle';
import { constantMultiple, identical, univariateCoefficients } from './poly';

export type VerifyResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface VerifyContext {
  /** The original problem (for substitution checks). */
  readonly problem: Problem;
  /** Unknowns of the problem, sorted. */
  readonly vars: readonly string[];
}

const ok: VerifyResult = { ok: true };
const fail = (reason: string): VerifyResult => ({ ok: false, reason });

const ONE_VAR = new Set(['equation', 'or', 'none', 'all']);
const SYSTEM = new Set(['system', 'none', 'infinite', 'all']);

const diff = (q: Equation): Expr => ({ k: 'sub', a: q.lhs, b: q.rhs });
const diffIneq = (s: { lhs: Expr; rhs: Expr; rel: Rel }): Expr => ({
  k: 'sub',
  a: s.lhs,
  b: s.rhs,
});

export function stateVars(s: State): string[] {
  const out = new Set<string>();
  const addEq = (q: Equation) => {
    variables(q.lhs, out);
    variables(q.rhs, out);
  };
  if (s.kind === 'expr') variables(s.expr, out);
  else if (s.kind === 'equation' || s.kind === 'infinite') addEq(s.eq);
  else if (s.kind === 'inequality') {
    variables(s.lhs, out);
    variables(s.rhs, out);
  } else if (s.kind === 'or' || s.kind === 'system') s.eqs.forEach(addEq);
  return [...out].sort();
}

export function sameState(p: State, q: State): boolean {
  if (p.kind !== q.kind) return false;
  const eqEq = (a: Equation, b: Equation) => exprEqual(a.lhs, b.lhs) && exprEqual(a.rhs, b.rhs);
  switch (p.kind) {
    case 'expr':
      return exprEqual(p.expr, (q as typeof p).expr);
    case 'equation':
    case 'infinite':
      return eqEq(p.eq, (q as typeof p).eq);
    case 'or':
    case 'system': {
      const o = q as typeof p;
      return p.eqs.length === o.eqs.length && p.eqs.every((e, i) => eqEq(e, o.eqs[i]!));
    }
    case 'inequality': {
      const o = q as typeof p;
      return p.rel === o.rel && exprEqual(p.lhs, o.lhs) && exprEqual(p.rhs, o.rhs);
    }
    default:
      return true;
  }
}

function verifySubstitution(step: Step, ctx: VerifyContext): VerifyResult {
  const info = step.info;
  if (info?.kind !== 'substitute') return fail('missing substitution data');
  if (!sameState(step.before, step.after)) return fail('a check step must not change the state');
  const originals =
    ctx.problem.kind === 'equation'
      ? [ctx.problem.eq]
      : ctx.problem.kind === 'system'
        ? ctx.problem.eqs
        : [];
  if (originals.length === 0 || info.rows.length !== originals.length)
    return fail('substitution rows do not match the problem');
  for (const v of ctx.vars) {
    const val = info.values[v];
    if (!val) return fail(`no value substituted for ${v}`);
    evalSurd(val, new Map()); // must be an exact constant
  }
  for (let i = 0; i < originals.length; i++) {
    const orig = originals[i]!;
    const row = info.rows[i]!;
    let lhs = orig.lhs;
    let rhs = orig.rhs;
    for (const v of ctx.vars) {
      lhs = substitute(lhs, v, info.values[v]!);
      rhs = substitute(rhs, v, info.values[v]!);
    }
    // The shown substitution may write -0 as 0 (same value); nothing else may differ.
    lhs = dropNegZero(lhs);
    rhs = dropNegZero(rhs);
    if (!exprEqual(lhs, row.lhs) || !exprEqual(rhs, row.rhs))
      return fail('substituted expression does not match the original equation');
    const lv = evalSurd(row.lhs, new Map());
    const rv = evalSurd(row.rhs, new Map());
    if (!lv.eq(evalSurd(row.lhsValue, new Map())) || !rv.eq(evalSurd(row.rhsValue, new Map())))
      return fail('displayed value is wrong');
    if (!lv.eq(rv)) return fail('left and right sides differ: not a solution');
  }
  return ok;
}

function verifyDiscriminant(step: Step, ctx: VerifyContext): VerifyResult {
  const info = step.info;
  if (info?.kind !== 'discriminant') return fail('missing discriminant data');
  if (!sameState(step.before, step.after) || step.before.kind !== 'equation')
    return fail('discriminant step must not change the state');
  const x = ctx.vars[0] ?? 'x';
  const eq = step.before.eq;
  if (!(eq.rhs.k === 'num' && eq.rhs.v.isZero()))
    return fail('equation is not in the form ... = 0');
  const p = univariateCoefficients(eq.lhs, x);
  if (p.length !== 3) return fail('not a quadratic');
  const env = new Map<string, Rational>();
  const [c, b, a] = p as [Rational, Rational, Rational];
  if (
    !evalRational(info.a, env).eq(a) ||
    !evalRational(info.b, env).eq(b) ||
    !evalRational(info.c, env).eq(c)
  )
    return fail('wrong coefficients');
  const D = b.mul(b).sub(Rational.of(4).mul(a).mul(c));
  if (!evalRational(info.working, env).eq(D) || !evalRational(info.value, env).eq(D))
    return fail('wrong discriminant');
  return ok;
}

function verifyInner(step: Step, ctx: VerifyContext): VerifyResult {
  if (step.info?.kind === 'substitute') return verifySubstitution(step, ctx);
  if (step.info?.kind === 'discriminant') return verifyDiscriminant(step, ctx);
  const { before, after } = step;

  if (before.kind === 'expr' || after.kind === 'expr') {
    if (before.kind !== 'expr' || after.kind !== 'expr')
      return fail('expression/equation mismatch');
    const vars = [...new Set([...stateVars(before), ...stateVars(after)])].sort();
    if (vars.length === 0) {
      return evalRational(before.expr, new Map()).eq(evalRational(after.expr, new Map()))
        ? ok
        : fail('value changed');
    }
    return identical(before.expr, after.expr, vars) ? ok : fail('not an identity');
  }

  if (ctx.problem.kind === 'inequality') {
    const x = ctx.vars[0] ?? 'x';
    const ineqState = (k: string) => k === 'inequality' || k === 'none' || k === 'all';
    if (!ineqState(before.kind) || !ineqState(after.kind))
      return fail(`cannot go from ${before.kind} to ${after.kind}`);
    for (const s of [before, after])
      if (stateVars(s).some((v) => v !== x)) return fail('unexpected unknown');
    if (!sameIneq(solutionSetIneq(before, x), solutionSetIneq(after, x)))
      return fail('solution set changed');
    if (
      before.kind === 'inequality' &&
      after.kind === 'inequality' &&
      step.check !== 'solution-set'
    ) {
      const c = constantMultiple(diffIneq(after), diffIneq(before), [x]);
      if (!c) return fail('not a non-zero constant multiple of the previous inequality');
      const flipped = flipRel(before.rel) === after.rel;
      if (c.sign() > 0 && before.rel !== after.rel)
        return fail('inequality sign changed without a negative multiplier');
      if (c.sign() < 0 && !flipped)
        return fail('a negative multiplier must flip the inequality sign');
    }
    return ok;
  }

  const systemProblem = ctx.problem.kind === 'system';
  if (!systemProblem && ONE_VAR.has(before.kind) && ONE_VAR.has(after.kind)) {
    const x = ctx.vars[0] ?? 'x';
    for (const s of [before, after])
      if (stateVars(s).some((v) => v !== x)) return fail('unexpected unknown');
    if (!sameSet1(solutionSet1(before, x), solutionSet1(after, x)))
      return fail('solution set changed');
    if (before.kind === 'equation' && after.kind === 'equation' && step.check !== 'solution-set') {
      const c = constantMultiple(diff(after.eq), diff(before.eq), [x]);
      if (!c) return fail('not a non-zero constant multiple of the previous equation');
    }
    return ok;
  }

  if (systemProblem && SYSTEM.has(before.kind) && SYSTEM.has(after.kind)) {
    if (ctx.vars.length !== 2) return fail('systems need exactly two unknowns');
    const [x, y] = ctx.vars as [string, string];
    for (const s of [before, after])
      if (stateVars(s).some((v) => v !== x && v !== y)) return fail('unexpected unknown');
    if (!sameSet2(solutionSet2(before, x, y), solutionSet2(after, x, y)))
      return fail('solution set changed');
    if (
      before.kind === 'system' &&
      after.kind === 'system' &&
      before.eqs.length === 2 &&
      after.eqs.length === 2 &&
      step.check !== 'solution-set'
    ) {
      const m = step.matrix;
      if (!m) return fail('missing row-operation matrix');
      const det = m[0][0].mul(m[1][1]).sub(m[0][1].mul(m[1][0]));
      if (det.isZero()) return fail('row operation is not invertible');
      const old = before.eqs.map((q) => linearRow(q, x, y));
      for (let i = 0; i < 2; i++) {
        const nw = linearRow(after.eqs[i]!, x, y);
        const [m0, m1] = m[i]!;
        for (const key of ['a', 'b', 'c'] as const) {
          const combo = m0.mul(old[0]![key]).add(m1.mul(old[1]![key]));
          if (!combo.eq(nw[key])) return fail('equation is not the stated combination');
        }
      }
    }
    return ok;
  }
  return fail(`cannot go from ${before.kind} to ${after.kind}`);
}

/** Verify one step. Never throws: anything that cannot be checked is rejected. */
export function verifyStep(step: Step, ctx: VerifyContext): VerifyResult {
  try {
    return verifyInner(step, ctx);
  } catch (e) {
    if (e instanceof Unverifiable) return fail(`unverifiable: ${e.message}`);
    return fail(`verifier error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
