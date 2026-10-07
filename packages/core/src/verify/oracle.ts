// SPDX-License-Identifier: AGPL-3.0-or-later
// Direct solvers ("oracles") used only for checking: closed formulas, no step logic.

import type { Equation, Expr } from '../ast';
import { Rational } from '../numbers/rational';
import { Surd } from '../numbers/surd';
import type { State } from '../state';
import { evalSurd, expandPm, Unverifiable } from './evaluate';
import { linearForm, univariateCoefficients } from './poly';

export type SolSet1 =
  { readonly kind: 'all' } | { readonly kind: 'finite'; readonly values: readonly Surd[] };

function containsRootOrPm(e: Expr): boolean {
  if (e.k === 'sqrt' || e.k === 'pm') return true;
  if (e.k === 'num' || e.k === 'var') return false;
  if (e.k === 'neg') return containsRootOrPm(e.a);
  return containsRootOrPm(e.a) || containsRootOrPm(e.b);
}

function hasVariable(e: Expr): boolean {
  if (e.k === 'var') return true;
  if (e.k === 'num') return false;
  if (e.k === 'neg' || e.k === 'sqrt') return hasVariable(e.a);
  return hasVariable(e.a) || hasVariable(e.b);
}

function dedupe(values: Surd[]): Surd[] {
  const m = new Map<string, Surd>();
  for (const v of values) m.set(v.key(), v);
  return [...m.values()].sort((p, q) => p.cmp(q));
}

/** Real solution set of one equation in the unknown x (degree <= 2, or x = value). */
export function solveEquation1(eq: Equation, x: string): SolSet1 {
  if (containsRootOrPm(eq.lhs) || containsRootOrPm(eq.rhs)) {
    const [side, other] =
      eq.lhs.k === 'var' && eq.lhs.name === x ? [eq.lhs, eq.rhs] : [eq.rhs, eq.lhs];
    if (!(side.k === 'var' && side.name === x) || hasVariable(other))
      throw new Unverifiable('roots are only allowed in "x = value" form');
    return { kind: 'finite', values: dedupe(expandPm(other).map((b) => evalSurd(b, new Map()))) };
  }
  const p = univariateCoefficients({ k: 'sub', a: eq.lhs, b: eq.rhs }, x);
  const deg = p.length - 1;
  if (deg === 0) return p[0]!.isZero() ? { kind: 'all' } : { kind: 'finite', values: [] };
  if (deg === 1) return { kind: 'finite', values: [Surd.rational(p[0]!.neg().div(p[1]!))] };
  if (deg === 2) {
    const [c, b, a] = p as [Rational, Rational, Rational];
    const D = b.mul(b).sub(Rational.of(4).mul(a).mul(c));
    if (D.sign() < 0) return { kind: 'finite', values: [] };
    const root = Surd.sqrt(D);
    const twoA = Surd.rational(a.mul(Rational.of(2)));
    const mb = Surd.rational(b.neg());
    return { kind: 'finite', values: dedupe([mb.add(root).div(twoA), mb.sub(root).div(twoA)]) };
  }
  throw new Unverifiable('degree above 2');
}

export function solutionSet1(s: State, x: string): SolSet1 {
  switch (s.kind) {
    case 'equation':
      return solveEquation1(s.eq, x);
    case 'or': {
      const all: Surd[] = [];
      for (const q of s.eqs) {
        const r = solveEquation1(q, x);
        if (r.kind === 'all') return r;
        all.push(...r.values);
      }
      return { kind: 'finite', values: dedupe(all) };
    }
    case 'none':
      return { kind: 'finite', values: [] };
    case 'all':
      return { kind: 'all' };
    default:
      throw new Unverifiable(`not a one-unknown state: ${s.kind}`);
  }
}

export function sameSet1(p: SolSet1, q: SolSet1): boolean {
  if (p.kind !== q.kind) return false;
  if (p.kind === 'all') return true;
  const qv = (q as { values: readonly Surd[] }).values;
  return p.values.length === qv.length && p.values.every((v, i) => v.eq(qv[i]!));
}

// ---- systems of two linear equations -----------------------------------------------------

export type SolSet2 =
  | { readonly kind: 'none' }
  | { readonly kind: 'all' }
  | { readonly kind: 'unique'; readonly x: Rational; readonly y: Rational }
  | { readonly kind: 'line'; readonly a: Rational; readonly b: Rational; readonly c: Rational };

type Row = { a: Rational; b: Rational; c: Rational };

function rowOf(eq: Equation, x: string, y: string): Row {
  return linearForm({ k: 'sub', a: eq.lhs, b: eq.rhs }, x, y);
}

function classify(rows: Row[]): SolSet2 {
  const live: Row[] = [];
  for (const r of rows) {
    if (r.a.isZero() && r.b.isZero()) {
      if (!r.c.isZero()) return { kind: 'none' };
    } else live.push(r);
  }
  if (live.length === 0) return { kind: 'all' };
  const norm = (r: Row): SolSet2 => {
    const k = r.a.isZero() ? r.b : r.a;
    return { kind: 'line', a: r.a.div(k), b: r.b.div(k), c: r.c.div(k) };
  };
  if (live.length === 1) return norm(live[0]!);
  if (live.length > 2) throw new Unverifiable('more than two equations');
  const [r1, r2] = live as [Row, Row];
  const det = r1.a.mul(r2.b).sub(r2.a.mul(r1.b));
  if (!det.isZero()) {
    return {
      kind: 'unique',
      x: r1.b.mul(r2.c).sub(r2.b.mul(r1.c)).div(det),
      y: r2.a.mul(r1.c).sub(r1.a.mul(r2.c)).div(det),
    };
  }
  const consistent =
    r1.a.mul(r2.c).sub(r2.a.mul(r1.c)).isZero() && r1.b.mul(r2.c).sub(r2.b.mul(r1.c)).isZero();
  return consistent ? norm(r1) : { kind: 'none' };
}

export function solutionSet2(s: State, x: string, y: string): SolSet2 {
  switch (s.kind) {
    case 'system':
      return classify(s.eqs.map((q) => rowOf(q, x, y)));
    case 'equation':
      return classify([rowOf(s.eq, x, y)]);
    case 'infinite':
      return classify([rowOf(s.eq, x, y)]);
    case 'none':
      return { kind: 'none' };
    case 'all':
      return { kind: 'all' };
    default:
      throw new Unverifiable(`not a system state: ${s.kind}`);
  }
}

export function sameSet2(p: SolSet2, q: SolSet2): boolean {
  if (p.kind !== q.kind) return false;
  switch (p.kind) {
    case 'unique': {
      const o = q as typeof p;
      return p.x.eq(o.x) && p.y.eq(o.y);
    }
    case 'line': {
      const o = q as typeof p;
      return p.a.eq(o.a) && p.b.eq(o.b) && p.c.eq(o.c);
    }
    default:
      return true;
  }
}

export { rowOf as linearRow };
