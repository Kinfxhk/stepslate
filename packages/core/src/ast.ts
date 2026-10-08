// SPDX-License-Identifier: AGPL-3.0-or-later
// Expression tree. Binary operators are left-associative as parsed; there are no
// parenthesis nodes (printers add brackets where precedence requires them).

import { Rational } from './numbers/rational';

export type Expr =
  /** Non-negative number literal. `text` keeps a decimal spelling such as "0.5". */
  | { readonly k: 'num'; readonly v: Rational; readonly text?: string }
  | { readonly k: 'var'; readonly name: string }
  | { readonly k: 'neg'; readonly a: Expr }
  | { readonly k: 'add'; readonly a: Expr; readonly b: Expr }
  | { readonly k: 'sub'; readonly a: Expr; readonly b: Expr }
  | { readonly k: 'mul'; readonly a: Expr; readonly b: Expr; readonly implicit?: boolean }
  | { readonly k: 'div'; readonly a: Expr; readonly b: Expr }
  | { readonly k: 'pow'; readonly a: Expr; readonly b: Expr }
  | { readonly k: 'sqrt'; readonly a: Expr }
  /** a ± b (only in answers / quadratic formula steps). */
  | { readonly k: 'pm'; readonly a: Expr; readonly b: Expr };

export interface Equation {
  readonly lhs: Expr;
  readonly rhs: Expr;
}

/** Inequality sign. `<=` is ≤ and `>=` is ≥. */
export type Rel = '<' | '<=' | '>' | '>=';

export type Problem =
  | { readonly kind: 'expr'; readonly expr: Expr }
  | { readonly kind: 'equation'; readonly eq: Equation }
  | { readonly kind: 'inequality'; readonly lhs: Expr; readonly rhs: Expr; readonly rel: Rel }
  | { readonly kind: 'system'; readonly eqs: readonly Equation[] };

// ---- constructors -------------------------------------------------------------------

export const num = (v: Rational | number | bigint, text?: string): Expr => {
  const q = v instanceof Rational ? v : Rational.of(v);
  if (q.sign() < 0 || (!q.isInteger() && text === undefined))
    throw new RangeError(
      'num() takes non-negative integers (or decimals with text); use ratExpr()',
    );
  return text === undefined ? { k: 'num', v: q } : { k: 'num', v: q, text };
};
export const v = (name: string): Expr => ({ k: 'var', name });
export const neg = (a: Expr): Expr => ({ k: 'neg', a });
export const add = (a: Expr, b: Expr): Expr => ({ k: 'add', a, b });
export const sub = (a: Expr, b: Expr): Expr => ({ k: 'sub', a, b });
export const mul = (a: Expr, b: Expr, implicit?: boolean): Expr =>
  implicit ? { k: 'mul', a, b, implicit } : { k: 'mul', a, b };
export const div = (a: Expr, b: Expr): Expr => ({ k: 'div', a, b });
export const pow = (a: Expr, b: Expr): Expr => ({ k: 'pow', a, b });
export const sqrt = (a: Expr): Expr => ({ k: 'sqrt', a });
export const pm = (a: Expr, b: Expr): Expr => ({ k: 'pm', a, b });
export const eqn = (lhs: Expr, rhs: Expr): Equation => ({ lhs, rhs });

/** A rational value as an expression: 3, 3/4 (fraction), -3, -(3/4). */
export function ratExpr(q: Rational): Expr {
  const a = q.abs();
  const pos = a.isInteger() ? num(a) : div(num(a.n), num(a.d));
  return q.sign() < 0 ? neg(pos) : pos;
}

// ---- inspection ---------------------------------------------------------------------

export function children(e: Expr): Expr[] {
  switch (e.k) {
    case 'num':
    case 'var':
      return [];
    case 'neg':
    case 'sqrt':
      return [e.a];
    default:
      return [e.a, e.b];
  }
}

export function countNodes(e: Expr): number {
  return 1 + children(e).reduce((s, c) => s + countNodes(c), 0);
}

export function variables(e: Expr, out: Set<string> = new Set()): Set<string> {
  if (e.k === 'var') out.add(e.name);
  for (const c of children(e)) variables(c, out);
  return out;
}

export function problemVariables(p: Problem): string[] {
  const s = new Set<string>();
  if (p.kind === 'expr') variables(p.expr, s);
  else if (p.kind === 'inequality') {
    variables(p.lhs, s);
    variables(p.rhs, s);
  } else
    for (const q of p.kind === 'equation' ? [p.eq] : p.eqs) {
      variables(q.lhs, s);
      variables(q.rhs, s);
    }
  return [...s].sort();
}

export function hasVar(e: Expr): boolean {
  return e.k === 'var' || children(e).some(hasVar);
}

/** Structural equality, ignoring the implicit-multiplication flag and decimal spelling. */
export function exprEqual(x: Expr, y: Expr): boolean {
  if (x.k !== y.k) return false;
  switch (x.k) {
    case 'num':
      return x.v.eq((y as typeof x).v);
    case 'var':
      return x.name === (y as typeof x).name;
    case 'neg':
    case 'sqrt':
      return exprEqual(x.a, (y as typeof x).a);
    default: {
      const yy = y as typeof x;
      return exprEqual(x.a, yy.a) && exprEqual(x.b, yy.b);
    }
  }
}

/**
 * Write "-0" as "0" everywhere in e (value-preserving). Used for displayed substitutions,
 * e.g. checking x = 0 in -x shows 0 rather than -0.
 */
export function dropNegZero(e: Expr): Expr {
  switch (e.k) {
    case 'num':
    case 'var':
      return e;
    case 'neg': {
      const a = dropNegZero(e.a);
      return a.k === 'num' && a.v.isZero() ? a : a === e.a ? e : neg(a);
    }
    case 'sqrt': {
      const a = dropNegZero(e.a);
      return a === e.a ? e : sqrt(a);
    }
    default: {
      const a = dropNegZero(e.a);
      const b = dropNegZero(e.b);
      return a === e.a && b === e.b ? e : ({ ...e, a, b } as Expr);
    }
  }
}

/** Replace every occurrence of variable `name` by `value`. */
export function substitute(e: Expr, name: string, value: Expr): Expr {
  switch (e.k) {
    case 'num':
      return e;
    case 'var':
      return e.name === name ? value : e;
    case 'neg':
      return neg(substitute(e.a, name, value));
    case 'sqrt':
      return sqrt(substitute(e.a, name, value));
    case 'mul':
      return mul(substitute(e.a, name, value), substitute(e.b, name, value), e.implicit);
    default:
      return { k: e.k, a: substitute(e.a, name, value), b: substitute(e.b, name, value) };
  }
}
